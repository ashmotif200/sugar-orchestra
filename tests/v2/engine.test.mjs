#!/usr/bin/env node
/**
 * Tests ciblés du moteur V2.
 *
 * Couvre les critères d'acceptation qui ne se voient pas à l'œil :
 *   - déterminisme du plan (même seed → même plan, bit pour bit)
 *   - invariant de hauteur (note écrite = note produite, ≤ 10 cents)
 *   - couverture (chaque son sélectionné a une apparition reconnaissable)
 *   - validation stricte côté serveur (plan malformé refusé)
 *   - rendu réel : durée, true peak ≤ −1 dBTP, absence de NaN
 *
 *   node tests/v2/engine.test.mjs [--api http://127.0.0.1:5182]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const BUILD = join(ROOT, '.v2build/engine-v2')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d }
const API = arg('api', 'http://127.0.0.1:5182')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + String(detail).slice(0, 150) : ''}`)
}

const cents = (a, b) => Math.abs(1200 * Math.log2(a / b))

async function main() {
  execFileSync(process.execPath, [join(ROOT, 'node_modules/typescript/bin/tsc'),
    ...['types', 'profiles', 'capabilities', 'plan'].map((f) => join(ROOT, 'src/engine-v2', `${f}.ts`)),
    '--outDir', join(ROOT, '.v2build'), '--target', 'es2022', '--module', 'esnext',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--strict'], { stdio: 'inherit' })
  for (const f of readdirSync(BUILD).filter((x) => x.endsWith('.js'))) {
    const p = join(BUILD, f)
    writeFileSync(p, readFileSync(p, 'utf8').replace(/from '\.\/([a-zA-Z-]+)'/g, "from './$1.js'"))
  }

  const { buildPlan, summarisePlan } = await import(join(BUILD, 'plan.js'))
  const { PROFILES } = await import(join(BUILD, 'profiles.js'))
  const { setCapabilityMatrix } = await import(join(BUILD, 'capabilities.js'))
  setCapabilityMatrix(JSON.parse(readFileSync(join(ROOT, 'src/data/capability-matrix.json'), 'utf8')))

  const catalog = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))
  const byId = new Map(catalog.sounds.map((s) => [s.id, s]))
  const ids = ['01_01', '01_03', '04_02', '04_09', '06_04', '05_01']
  const selection = ids.map((id) => byId.get(id)).filter(Boolean)
  const profile = PROFILES.find((p) => p.id === 'electro-sega')

  /* ---------------------------------------------------- 1. déterminisme */
  const a = buildPlan({ profile, seed: 12345, selection })
  const b = buildPlan({ profile, seed: 12345, selection })
  const c = buildPlan({ profile, seed: 12346, selection })
  check('plan_deterministic_same_seed', isDeepStrictEqual(a, b), `${a.notes.length} notes`)
  check('plan_differs_with_new_seed', !isDeepStrictEqual(a, c), `${a.notes.length} vs ${c.notes.length} notes`)

  /* ------------------------------------------------- 2. invariant hauteur */
  let worst = 0
  let pitched = 0
  for (const n of a.notes.filter((x) => x.writtenMidi != null)) {
    pitched++
    const target = 440 * Math.pow(2, (n.writtenMidi - 69) / 12)
    worst = Math.max(worst, cents(n.realizedHz, target))
  }
  check('pitch_invariant_within_10_cents', pitched > 0 && worst <= 10, `${pitched} notes tonales, écart max ${worst.toFixed(2)} cents`)
  const tooFar = a.notes.filter((n) => Math.abs(12 * Math.log2(n.playbackRate)) > 7.001)
  check('no_transposition_beyond_profile_limit', tooFar.length === 0, `${tooFar.length} note(s) hors limite`)

  /* ------------------------------------------------------ 3. couverture */
  const recognised = new Set(a.notes.filter((n) => n.recognisable).map((n) => n.sourceId))
  const uncovered = ids.filter((id) => !recognised.has(id))
  check('every_selected_sound_recognisable', uncovered.length === 0, uncovered.join(', ') || `${ids.length}/${ids.length}`)

  /* ------------------------------------------------- 4. temps musical */
  const s = summarisePlan(a)
  const expected = a.bars * a.time.barSeconds
  check('duration_from_bar_model', Math.abs(s.durationS - expected) < 0.01,
    `${s.bars} mesures × ${a.time.barSeconds} s = ${expected.toFixed(2)} s`)
  check('ternary_grid_preserved', a.time.subdivision === 3 && a.time.beatsPerBar === 4,
    `${a.time.beatsPerBar} temps, subdivision ${a.time.subdivision}`)

  /* ------------------------------------------ 5. politique v2 (04_02) */
  const sensitiveUsed = a.notes.some((n) => n.sourceId === '04_02')
  check('historically_sensitive_sound_is_usable', sensitiveUsed,
    '04_02 présent dans le plan (politique v2)')

  /* ------------------------------------------------- 6. validation serveur */
  const bad = { ...a, time: { ...a.time, beatsPerBar: 5 } }
  let res = await fetch(`${API}/api/v2/render`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-so-admin': '1' }, body: JSON.stringify({ plan: bad }) })
  check('server_rejects_invalid_time_model', res.status === 400, `HTTP ${res.status}`)

  const badSource = { ...a, notes: [{ ...a.notes[0], sourceId: '../../etc/passwd' }] }
  res = await fetch(`${API}/api/v2/render`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-so-admin': '1' }, body: JSON.stringify({ plan: badSource }) })
  check('server_rejects_path_as_sound_id', res.status === 400, `HTTP ${res.status}`)

  res = await fetch(`${API}/api/v2/render`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan: a }) })
  check('server_requires_csrf_header', res.status === 403, `HTTP ${res.status}`)

  /* ------------------------------------------------------- 7. rendu réel */
  const t0 = Date.now()
  res = await fetch(`${API}/api/v2/render`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-so-admin': '1' }, body: JSON.stringify({ plan: a }) })
  const meta = await res.json()
  const elapsed = Date.now() - t0
  check('render_succeeds', res.status === 201 && !!meta.id, `HTTP ${res.status} en ${elapsed} ms`)
  if (res.status === 201) {
    const v = meta.verification
    check('render_true_peak_under_ceiling', v.truePeakDb != null && v.truePeakDb <= -1.0, `${v.truePeakDb} dBTP`)
    check('render_duration_matches_plan', Math.abs((v.durationS ?? 0) - expected) < 0.15, `${v.durationS} s vs ${expected.toFixed(2)} s`)
    check('render_stereo_44k1', v.channels === 2 && v.sampleRate === 44100, `${v.sampleRate} Hz ${v.channels}ch`)
    check('render_no_nan', v.hasNaN === false, 'aucun NaN')
    check('render_verified_by_ffmpeg', v.lufs != null && v.lufs > -60, `LUFS ${v.lufs}`)

    // déterminisme de bout en bout : même plan → même fichier
    const res2 = await fetch(`${API}/api/v2/render`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-so-admin': '1' }, body: JSON.stringify({ plan: a }) })
    const meta2 = await res2.json()
    const bufA = Buffer.from(await (await fetch(`${API}/api/v2/render/${meta.id}`)).arrayBuffer())
    const bufB = Buffer.from(await (await fetch(`${API}/api/v2/render/${meta2.id}`)).arrayBuffer())
    check('render_byte_identical_for_same_plan', Buffer.compare(bufA, bufB) === 0, `${bufA.length} octets`)
  }

  rmSync(join(ROOT, '.v2build'), { recursive: true, force: true })
  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} contrôles V2 OK`)
  return passed === results.length ? 0 : 1
}

main().then((c) => process.exit(c)).catch((e) => { console.error('échec:', e.message); process.exit(1) })
