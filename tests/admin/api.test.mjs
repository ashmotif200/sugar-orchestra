#!/usr/bin/env node
/**
 * Super Admin API integration test.
 *
 * Runs the real server against a throwaway database in a temp directory, provisions
 * a real account through the real CLI, then exercises every guarantee the brief
 * asks for. Nothing here touches data/admin or the visitor bundle.
 *
 *   npm run admin:test            (add --verbose for request logs)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

const ROOT = process.cwd()
const tmp = mkdtempSync(join(tmpdir(), 'so-admin-test-'))
const PORT = 5300 + Math.floor(Math.random() * 500)
const BASE = `http://127.0.0.1:${PORT}`
const VERBOSE = process.argv.includes('--verbose')
const results = []
const says = (s) => process.stdout.write(s)

function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail: String(detail).slice(0, 300) })
  says(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + String(detail).slice(0, 160) : ''}\n`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitReady(timeoutMs = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return true
    } catch { /* not up yet */ }
    await sleep(120)
  }
  return false
}

let CODE = 0

async function main() {
  const server = spawn(process.execPath, ['server/admin-server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, SO_DATA_DIR: join(tmp, 'data'), SO_PORT: String(PORT), SO_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverLog = ''
  server.stdout.on('data', (d) => { serverLog += d })
  server.stderr.on('data', (d) => { serverLog += d })

  try {
    if (!await waitReady()) throw new Error(`le serveur n’a pas démarré:\n${serverLog.slice(-800)}`)
    check('server_starts_and_health_is_public', true, `port ${PORT}`)

    /* ---------------------------------------------------- unauthenticated */
    let r = await fetch(`${BASE}/api/dashboard`)
    check('dashboard_requires_auth', r.status === 401, `HTTP ${r.status}`)
    r = await fetch(`${BASE}/api/sounds`)
    check('sounds_require_auth', r.status === 401, `HTTP ${r.status}`)
    r = await fetch(`${BASE}/api/auth/me`)
    check('me_requires_auth', r.status === 401, `HTTP ${r.status}`)
    r = await fetch(`${BASE}/api/system/diagnostics`)
    check('diagnostics_require_auth', r.status === 401, `HTTP ${r.status}`)

    /* ------------------------------------------------------- provisioning */
    const email = `test-admin-${randomBytes(3).toString('hex')}@example.org`
    const password = `Tt${randomBytes(9).toString('hex')}!Aa1`
    const prov = spawn(process.execPath, ['scripts/admin/provision.mjs', '--email', email,
      '--name', 'Test Admin', '--password-stdin'], {
      cwd: ROOT,
      env: { ...process.env, SO_DATA_DIR: join(tmp, 'data') },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    prov.stdin.write(`${password}\n`)
    prov.stdin.end()
    let provOut = ''
    prov.stdout.on('data', (d) => { provOut += d })
    prov.stderr.on('data', (d) => { provOut += d })
    const provCode = await new Promise((res) => prov.on('close', res))
    check('provision_creates_first_admin', provCode === 0 && provOut.includes('compte créé'),
      provOut.split('\n')[0])
    check('provision_does_not_echo_password', !provOut.includes(password), 'mdp absent de la sortie')

    // second super_admin without --force must be refused
    const prov2 = spawn(process.execPath, ['scripts/admin/provision.mjs', '--email', 'x@y.z',
      '--password-stdin'], { cwd: ROOT, env: { ...process.env, SO_DATA_DIR: join(tmp, 'data') },
      stdio: ['pipe', 'pipe', 'pipe'] })
    prov2.stdin.write('Another!Passw0rd123\n'); prov2.stdin.end()
    const prov2Code = await new Promise((res) => prov2.on('close', res))
    check('provision_refuses_second_super_admin', prov2Code === 1, `exit ${prov2Code}`)

    /* --------------------------------------------------------------- login */
    r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password-1234' }),
    })
    check('login_rejects_bad_password', r.status === 401, `HTTP ${r.status}`)

    r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const setCookie = r.headers.get('set-cookie') ?? ''
    check('login_succeeds', r.status === 200, `HTTP ${r.status}`)
    check('session_cookie_is_httponly_samesite', /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie),
      setCookie.split(';').slice(1).join(';').trim())
    const cookie = setCookie.split(';')[0]
    const authed = (path, init = {}) => fetch(`${BASE}${path}`, {
      ...init, headers: { cookie, 'x-so-admin': '1', ...(init.headers ?? {}) },
    })

    r = await authed('/api/auth/me')
    const me = await r.json()
    check('me_returns_super_admin', r.status === 200 && me.user.role === 'super_admin', me.user.role)
    check('me_returns_permission_list', Array.isArray(me.permissions) && me.permissions.length > 5,
      `${me.permissions?.length} permissions`)

    /* ------------------------------------------------------------ dashboard */
    r = await authed('/api/dashboard')
    const dash = await r.json()
    check('dashboard_reports_real_counts',
      dash.sounds === 40 && dash.steps === 7 && dash.sensitive === 3,
      `sounds=${dash.sounds} steps=${dash.steps} sensitive=${dash.sensitive} selected=${dash.selectedSounds}`)
    check('dashboard_lists_four_universes', dash.universes?.length === 4,
      dash.universes?.map((u) => u.id).join(', '))

    r = await authed('/api/sounds')
    const sounds = await r.json()
    check('sounds_list_40', sounds.count === 40, sounds.count)
    const sensitive = sounds.sounds.filter((s) => s.sensitive)
    check('sensitive_sounds_flagged', sensitive.length === 3,
      sensitive.map((s) => s.code).join(','))

    /* -------------------------------------------------------- CSRF refusal */
    r = await fetch(`${BASE}/api/steps/1`, {
      method: 'PATCH', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ name_fr: 'test' }),
    })
    check('mutation_without_csrf_header_refused', r.status === 403, `HTTP ${r.status}`)

    /* -------------------------------------------------------- permissions */
    r = await authed('/api/users', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@example.org', name: 'Viewer', role: 'viewer',
        password: 'Viewer!Passw0rd12' }),
    })
    const viewer = await r.json()
    check('super_admin_can_create_user', r.status === 201, viewer.user?.role ?? JSON.stringify(viewer))

    const vr = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@example.org', password: 'Viewer!Passw0rd12' }),
    })
    const vCookie = (vr.headers.get('set-cookie') ?? '').split(';')[0]
    const vAuthed = (path, init = {}) => fetch(`${BASE}${path}`, {
      ...init, headers: { cookie: vCookie, 'x-so-admin': '1', ...(init.headers ?? {}) },
    })
    check('viewer_can_login', vr.status === 200, `HTTP ${vr.status}`)
    r = await vAuthed('/api/sounds')
    check('viewer_can_read_sounds', r.status === 200, `HTTP ${r.status}`)
    r = await vAuthed('/api/users', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.co', name: 'x', role: 'super_admin', password: 'Nope!Passw0rd12' }) })
    check('viewer_cannot_create_users', r.status === 403, `HTTP ${r.status}`)
    r = await vAuthed('/api/steps/1', { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name_fr: 'hacked' }) })
    check('viewer_cannot_edit_steps', r.status === 403, `HTTP ${r.status}`)
    r = await vAuthed('/api/system/diagnostics')
    check('viewer_cannot_read_diagnostics', r.status === 403, `HTTP ${r.status}`)

    /* ------------------------------------------------- audio replacement */
    const wav = makeWav()
    r = await authed('/api/sounds/01_01/replacement', {
      method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav,
    })
    const rep = await r.json()
    check('replace_audio_creates_version_2', r.status === 201 && rep.version === 2,
      `HTTP ${r.status} version=${rep.version} ${rep.error ?? ''}`)
    check('replace_audio_marks_analysis_stale', rep.analysisState === 'stale', rep.analysisState)

    r = await authed('/api/sounds/01_01/replacement', {
      method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wav,
    })
    const dup = await r.json()
    check('replacement_refuses_identical_file', r.status === 409, `HTTP ${r.status} ${dup.error ?? ''}`)

    r = await authed('/api/sounds/01_01/replacement', {
      method: 'POST', headers: { 'content-type': 'audio/wav' }, body: Buffer.from('not a wav at all, definitely not audio') ,
    })
    check('replacement_rejects_non_audio', r.status === 400 || r.status === 413, `HTTP ${r.status}`)

    r = await authed('/api/sounds/01_01')
    const detail = await r.json()
    check('sound_detail_lists_versions', detail.versions?.length === 2,
      detail.versions?.map((v) => 'v' + v.version).join(', '))
    check('original_version_is_kept', detail.versions?.some((v) => v.version === 1),
      'v1 toujours présente')

    r = await authed('/api/sounds/01_01/restore/1', { method: 'POST' })
    const restored = await r.json()
    check('restore_creates_new_version', r.status === 201 && restored.version === 3,
      `v${restored.version} depuis v${restored.restoredFrom}`)

    const versionsOnDisk = existsSync(join(tmp, 'data', 'files', '01_01'))
      ? readdirSync(join(tmp, 'data', 'files', '01_01')).length : 0
    check('new_audio_versions_stored_on_disk', versionsOnDisk >= 1, `${versionsOnDisk} fichier(s) sous data/admin/files`)
    check('original_registered_as_v1_with_hash',
      detail.versions?.some((v) => v.version === 1 && !!v.sha256 && (v.file_path ?? '').includes('assets/originals')),
      detail.versions?.find((v) => v.version === 1)?.note ?? 'v1 absente')

    /* ------------------------------------------------------ content flow */
    r = await authed('/api/content/01_01:fr', { method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Le volcan', short_desc: 'Brouillard et lave.', story: 'Histoire test.' }) })
    check('content_saves_as_draft', r.status === 200, `HTTP ${r.status}`)

    r = await authed('/api/content/01_01:fr/transition', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: 'published' }) })
    check('content_cannot_skip_review', r.status === 409, `HTTP ${r.status}`)

    for (const to of ['review', 'approved', 'published']) {
      r = await authed('/api/content/01_01:fr/transition', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to }) })
    }
    check('content_reaches_published', r.status === 200, `HTTP ${r.status}`)
    const pub = await r.json()

    r = await authed('/api/content/01_01:fr')
    const cdetail = await r.json()
    check('content_versions_history', cdetail.versions?.length >= 3,
      `${cdetail.versions?.length} versions`)
    check('content_published_state', cdetail.content.status === 'published', cdetail.content.status)

    r = await authed('/api/content/01_01:fr/revert/1', { method: 'POST' })
    check('content_revert_works', r.status === 200, `HTTP ${r.status}`)

    /* ------------------------------------------------------- steps module */
    r = await authed('/api/steps')
    const steps = await r.json()
    check('steps_list_7', steps.steps?.length === 7, `${steps.steps?.length} étapes`)
    r = await authed('/api/steps/6', { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name_fr: 'De la canne au sucre (test)', status: 'draft' }) })
    check('step_update_persists', r.status === 200, `HTTP ${r.status}`)
    r = await authed('/api/steps/6')
    const step6 = await r.json()
    check('step_update_read_back', step6.step?.name_fr?.includes('(test)'), step6.step?.name_fr)

    /* ------------------------------------------- restrictions are immutable */
    r = await authed('/api/sounds')
    const before = (await r.json()).sounds.find((s) => s.id === '04_01')
    const routes = ['/api/sounds/04_01', '/api/restrictions/04_01']
    let restrictionRoute = null
    for (const p of routes) {
      const rr = await authed(p, { method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sensitive: false, availability: 'available' }) })
      if (rr.status !== 404) restrictionRoute = { p, status: rr.status }
    }
    const after = (await (await authed('/api/sounds')).json()).sounds.find((s) => s.id === '04_01')
    check('no_route_can_lift_a_restriction', restrictionRoute === null && before.sensitive === after.sensitive,
      restrictionRoute ? `route ${restrictionRoute.p} répond ${restrictionRoute.status}` : 'aucune route de levée')

    /* ------------------------------------------------------- diagnostics */
    r = await authed('/api/system/diagnostics')
    const diag = await r.json()
    check('diagnostics_real_values', diag.catalog?.sounds === 40 && diag.stepsConfig?.steps === 7,
      `catalogue ${diag.catalog?.sounds} sons, config ${diag.stepsConfig?.steps} étapes`)
    check('diagnostics_no_secrets',
      !JSON.stringify(diag).match(/password|secret|token/i),
      'aucun champ sensible')

    /* ------------------------------------------------------- publication */
    r = await authed('/api/publication/preview')
    const prev = await r.json()
    check('publication_preview_counts', prev.manifest?.sounds === 40, JSON.stringify(prev.manifest?.sounds))

    r = await authed('/api/publication/publish', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
    check('publish_requires_explicit_confirmation', r.status === 400, `HTTP ${r.status}`)

    r = await authed('/api/publication/publish', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: 'PUBLIER', note: 'test automatisé' }) })
    const published = await r.json()
    check('publish_creates_snapshot', r.status === 201 && published.id >= 1,
      `pub ${published.id} -> ${published.dir}`)
    check('publish_does_not_touch_visitor_bundle', published.applied === false,
      'applied=false, bundle intact')

    const bundle = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))
    check('visitor_catalog_unchanged_by_publish', bundle.sounds?.length === 40 && !bundle.source?.includes('admin publication'),
      `source=${bundle.source}`)

    /* ------------------------------------------------------------ audit */
    r = await authed('/api/audit?limit=50')
    const audit = await r.json()
    const actions = new Set((audit.entries ?? []).map((e) => e.action))
    check('audit_log_records_actions',
      ['auth.login', 'sound.replace', 'content.transition', 'publication.publish'].every((a) => actions.has(a)),
      [...actions].slice(0, 8).join(', '))
    check('audit_never_stores_passwords',
      !JSON.stringify(audit.entries).includes(password),
      'aucun mot de passe dans le journal')

    /* ----------------------------------------------------------- logout */
    r = await authed('/api/auth/logout', { method: 'POST' })
    check('logout_succeeds', r.status === 200, `HTTP ${r.status}`)
    r = await fetch(`${BASE}/api/dashboard`, { headers: { cookie, 'x-so-admin': '1' } })
    check('session_invalid_after_logout', r.status === 401, `HTTP ${r.status}`)

    /* ------------------------------------------------- visitor app intact */
    r = await fetch(`${BASE}/`)
    const html = await r.text()
    check('visitor_app_served', r.status === 200 && html.includes('<div id="root"'), 'index.html')
    const csp = r.headers.get('content-security-policy') ?? ''
    check('security_headers_present',
      csp.includes("default-src 'self'") && r.headers.get('x-frame-options') === 'DENY', 'CSP + frame-options')
  } finally {
    server.kill('SIGTERM')
    await sleep(200)
    if (serverLog && results.some((x) => !x.ok)) {
      console.log('\n--- server log (tail) ---\n' + serverLog.slice(-1200))
    }
    rmSync(tmp, { recursive: true, force: true })
  }

  const passed = results.filter((x) => x.ok).length
  says(`\n${passed}/${results.length} contrôles OK\n`)
  CODE = passed === results.length ? 0 : 1
}

function makeWav(seconds = 0.5, sr = 32000) {
  const n = Math.floor(seconds * sr)
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 12000)
    data.writeInt16LE(v, i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22); header.writeUInt32LE(sr, 24); header.writeUInt32LE(sr * 2, 28)
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

main().then(() => process.exit(CODE)).catch((e) => {
  console.error('test harness error:', e)
  process.exit(1)
})
