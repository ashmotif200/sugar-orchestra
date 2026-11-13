/**
 * Super Admin API. Every route below is authenticated except /api/health and
 * /api/auth/login, and every mutating route re-checks a permission server-side.
 */
import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { db, audit, nowIso, sha256, FILES_DIR, PUB_DIR, ROOT, writeJsonAtomic } from './db.mjs'
import { renderPlan, renderPath, renderMetaPath, SAMPLE_RATE, MAX_NOTES, MAX_BARS } from './v2-render.mjs'
import {
  can, createSession, destroySession, userFromToken, verifyPassword, loginBlocked,
  recordFailure, clearFailures, createUser, ROLES, PERMISSION_LIST, PERMISSIONS,
} from './auth.mjs'

const SESSION_COOKIE = 'so_admin'
/** limitation de débit par IP pour le rendu V2 public */
const renderHits = new Map()
const MAX_JSON = 1 << 20          // 1 MiB
const MAX_AUDIO = 25 << 20        // 25 MiB
const ALLOWED_AUDIO = {
  'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/wave': '.wav',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/flac': '.flac',
}

class HttpError extends Error {
  constructor(status, message, detail) { super(message); this.status = status; this.detail = detail }
}
const bad = (msg, detail) => { throw new HttpError(400, msg, detail) }
const denied = (msg = 'permission refusée') => { throw new HttpError(403, msg) }
const notFound = (msg = 'introuvable') => { throw new HttpError(404, msg) }
const conflict = (msg, detail) => { throw new HttpError(409, msg, detail) }

/* ------------------------------------------------------------------ helpers */
function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  })
  res.end(payload)
}

async function readBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > limit) throw new HttpError(413, `corps trop volumineux (max ${Math.round(limit / 1048576)} Mio)`)
    chunks.push(c)
  }
  return Buffer.concat(chunks)
}

async function readJson(req) {
  const buf = await readBody(req, MAX_JSON)
  if (!buf.length) return {}
  try { return JSON.parse(buf.toString('utf8')) } catch { bad('JSON invalide') }
}

function ffprobe(path) {
  return new Promise((res) => {
    const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=sample_rate,channels:format=duration',
      '-of', 'json', path])
    let out = ''
    p.stdout.on('data', (d) => { out += d })
    p.on('error', () => res(null))
    p.on('close', () => {
      try {
        const j = JSON.parse(out)
        const st = j.streams?.[0] ?? {}
        res({ duration_s: Number(j.format?.duration) || null, sample_rate: Number(st.sample_rate) || null,
          channels: Number(st.channels) || null })
      } catch { res(null) }
    })
  })
}

function sniffAudio(buf, ext) {
  const isWav = buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE'
  const isMp3 = buf.length > 2 && (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
  const isM4a = buf.length > 12 && buf.toString('ascii', 4, 8) === 'ftyp'
  const isFlac = buf.length > 4 && buf.toString('ascii', 0, 4) === 'fLaC'
  if (ext === '.wav') return isWav
  if (ext === '.mp3') return isMp3
  if (ext === '.m4a') return isM4a
  if (ext === '.flac') return isFlac
  return false
}

/* ------------------------------------------------------------------- router */
export async function handleApi(req, res, url) {
  const path = url.pathname.replace(/\/+$/, '') || '/api'
  const method = req.method.toUpperCase()
  const cookies = parseCookies(req.headers.cookie)
  const user = userFromToken(cookies[SESSION_COOKIE])
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method)

  // health is the only unauthenticated read
  if (path === '/api/health' && method === 'GET') {
    return json(res, 200, { ok: true, service: 'sugar-orchestra-admin', time: nowIso() })
  }

  /* --------------------------------------- contenu éditorial (public) */
  // Le parcours visiteur ne lisait aucun contenu éditorial : /api/content exige
  // la permission content.read et n'était appelé que par l'admin. Cette route
  // publique sert uniquement ce qui a été PUBLIÉ, jamais un brouillon.
  if (path === '/api/v2/public/content' && method === 'GET') {
    const locale = url.searchParams.get('locale') ?? 'fr'
    const d = db()
    const pub = d.prepare('SELECT id, dir, created_at FROM publications ORDER BY id DESC LIMIT 1').get()
    if (!pub) {
      return json(res, 200, {
        applied: false, publicationId: null, locale, items: [],
        note: 'aucune publication : le visiteur utilise les titres du catalogue',
      })
    }
    // le catalogue publié est dans catalog.json du snapshot ; manifest.json ne
    // contient que les compteurs
    const manifestPath = join(pub.dir, 'catalog.json')
    let items = []
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      const applied = (d.prepare("SELECT value FROM settings WHERE key='applied_publication'").get()?.value ?? null)
      items = (manifest.catalog?.sounds ?? [])
        .filter((s) => s.title || s.shortDesc || s.history)
        .map((s) => ({
          soundId: s.id, title: s.title ?? null, shortDesc: s.shortDesc ?? null,
          story: s.history ?? null, pedagogy: s.pedagogy ?? null, sources: s.sources ?? null,
        }))
      return json(res, 200, {
        applied: String(applied) === String(pub.id),
        publicationId: pub.id, publishedAt: pub.created_at, locale, items,
        note: 'contenu issu de la dernière publication ; crédits et licences restent ceux du catalogue',
      })
    } catch (e) {
      return json(res, 200, { applied: false, publicationId: pub.id, locale, items: [],
        note: `publication illisible : ${e.message}` })
    }
  }

  /* ------------------------------------------------- moteur V2 (public) */
  // Ces routes servent le parcours visiteur : elles ne demandent pas de session,
  // mais valident strictement le plan et ne résolvent jamais un chemin fourni par
  // le client. Limitation de débit par IP.
  if (path === '/api/v2/health' && method === 'GET') {
    return json(res, 200, {
      ok: true, engine: 'v2', sampleRate: SAMPLE_RATE,
      limits: { maxNotes: MAX_NOTES, maxBars: MAX_BARS, truePeakDb: -1 },
      renderer: 'server (mélangeur Float32 + ffmpeg pour le décodage et la vérification)',
    })
  }

  if (path === '/api/v2/render' && method === 'POST') {
    if (req.headers['x-so-admin'] !== '1') return json(res, 403, { error: 'en-tête anti-CSRF manquant' })
    const ip = req.socket.remoteAddress ?? 'unknown'
    const now = Date.now()
    const hits = (renderHits.get(ip) ?? []).filter((t) => now - t < 60000)
    if (hits.length >= 10) return json(res, 429, { error: 'trop de rendus demandés, réessayez dans une minute' })
    hits.push(now)
    renderHits.set(ip, hits)

    const body = await readJson(req)
    const plan = body?.plan
    const started = Date.now()
    try {
      const meta = await renderPlan(plan)
      audit(null, 'v2.render', 'plan', meta.id, {
        profileId: plan?.profileId, seed: plan?.seed, bars: plan?.bars,
        notes: plan?.notes?.length, totalMs: meta.timing.totalMs,
      })
      return json(res, 201, { ...meta, url: `/api/v2/render/${meta.id}` })
    } catch (e) {
      const status = e.status ?? 500
      return json(res, status, {
        error: e.message, detail: e.detail ?? null, elapsedMs: Date.now() - started,
      })
    }
  }

  const v2Match = path.match(/^\/api\/v2\/render\/([a-f0-9]{24})(\/meta)?$/)
  if (v2Match && method === 'GET') {
    const [, id, metaSuffix] = v2Match
    if (metaSuffix) {
      const p = renderMetaPath(id)
      if (!p || !existsSync(p)) return notFound('rendu introuvable')
      return json(res, 200, JSON.parse(readFileSync(p, 'utf8')))
    }
    const file = renderPath(id)
    if (!file || !existsSync(file)) return notFound('rendu introuvable')
    return streamFile(req, res, file)
  }

  if (path === '/api/auth/login' && method === 'POST') {
    const { email, password } = await readJson(req)
    if (typeof email !== 'string' || typeof password !== 'string') bad('email et mot de passe requis')
    const ip = req.socket.remoteAddress ?? ''
    const key = `${email.toLowerCase()}|${ip}`
    const wait = loginBlocked(key)
    if (wait > 0) return json(res, 429, { error: `trop de tentatives, réessayez dans ${wait}s` })

    const row = db().prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!row || !row.is_active || !verifyPassword(password, row.password_hash, row.password_salt)) {
      recordFailure(key)
      audit({ email }, 'auth.login_failed', 'user', row?.id ?? null, { ip })
      return json(res, 401, { error: 'identifiants invalides' })
    }
    clearFailures(key)
    const { token, expires } = createSession(row, { ip, userAgent: req.headers['user-agent'] })
    return json(res, 200, {
      user: { id: row.id, email: row.email, name: row.name, role: row.role,
        mustChangePassword: !!row.must_change_password },
      expiresAt: expires,
    }, {
      'set-cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 3600}`
        + (process.env.SO_HTTPS === '1' ? '; Secure' : ''),
    })
  }

  // everything below requires a live session
  if (path.startsWith('/api/auth/') && path !== '/api/auth/me' && path !== '/api/auth/logout') {
    notFound()
  }
  if (!user) {
    return json(res, 401, { error: 'authentification requise' })
  }
  // CSRF defence in depth: mutating requests must carry the admin header.
  // The cookie is SameSite=Strict already; this also blocks naive form posts.
  if (mutating && req.headers['x-so-admin'] !== '1') {
    return json(res, 403, { error: 'en-tête anti-CSRF manquant' })
  }
  const require = (perm) => { if (!can(user.role, perm)) denied(`permission requise: ${perm}`) }

  if (path === '/api/auth/me' && method === 'GET') {
    return json(res, 200, { user, permissions: PERMISSION_LIST.filter((p) => can(user.role, p)),
      rolePermissions: PERMISSIONS[user.role] })
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    destroySession(cookies[SESSION_COOKIE], user)
    return json(res, 200, { ok: true }, {
      'set-cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    })
  }

  /* ------------------------------------------------------------- dashboard */
  if (path === '/api/dashboard' && method === 'GET') {
    require('sounds.read')
    const d = db()
    const one = (sql, ...a) => d.prepare(sql).get(...a)
    const sounds = one('SELECT COUNT(*) n FROM sounds').n
    const steps = one('SELECT COUNT(*) n FROM steps').n
    const selected = one('SELECT COUNT(DISTINCT sound_id) n FROM step_sounds').n
    const sensitive = one('SELECT COUNT(*) n FROM sounds WHERE sensitive=1').n
    const active = one('SELECT COUNT(*) n FROM sounds WHERE status=\'active\'').n
    const inactive = sounds - active
    const review = one(`SELECT COUNT(*) n FROM content WHERE status IN ('draft','review')`).n
    const universes = d.prepare('SELECT id, name, status, engine_implemented FROM universes ORDER BY rowid').all()
    const recent = d.prepare(`SELECT at, actor_email, action, entity, entity_id FROM audit_log
                              ORDER BY id DESC LIMIT 8`).all()
    const staleAnalysis = one(`SELECT COUNT(*) n FROM sounds WHERE analysis_json IS NULL OR analysis_version='stale'`).n
    const versions = one('SELECT COUNT(*) n FROM sound_versions').n
    const publications = one('SELECT COUNT(*) n FROM publications').n
    const files = d.prepare('SELECT id, file, version FROM sounds').all()
    const missingFiles = files.filter((f) => {
      const p = f.file ? join(ROOT, 'public', f.file.replace(/^\/+/, '')) : null
      return p ? !existsSync(p) : true
    }).length
    return json(res, 200, {
      sounds, steps, selectedSounds: selected, sensitive, active, inactive,
      pendingReview: review, universes,
      recentChanges: recent,
      analysis: { total: sounds, stale: staleAnalysis, versions },
      files: { missing: missingFiles, checked: files.length },
      publications,
      limits: { minSelected: null, maxSelected: 8 },
      generatedAt: nowIso(),
    })
  }

  /* ---------------------------------------------------------------- sounds */
  if (path === '/api/sounds' && method === 'GET') {
    require('sounds.read')
    const q = (url.searchParams.get('q') ?? '').toLowerCase().trim()
    const step = url.searchParams.get('step')
    const status = url.searchParams.get('status')
    const sensitive = url.searchParams.get('sensitive')
    let rows = db().prepare(`SELECT s.*, r.provenance, r.validation_status,
                                    (SELECT COUNT(*) FROM sound_versions v WHERE v.sound_id=s.id) AS versions
                             FROM sounds s LEFT JOIN restrictions r ON r.sound_id=s.id
                             ORDER BY s.code`).all()
    if (q) rows = rows.filter((r) => `${r.id} ${r.name} ${r.credits ?? ''}`.toLowerCase().includes(q))
    if (step) rows = rows.filter((r) => String(r.step_id) === String(step))
    if (status) rows = rows.filter((r) => r.status === status)
    if (sensitive === '1') rows = rows.filter((r) => r.sensitive === 1)
    if (sensitive === '0') rows = rows.filter((r) => r.sensitive === 0)
    return json(res, 200, { count: rows.length, sounds: rows })
  }

  const soundMatch = path.match(/^\/api\/sounds\/([\w.-]+)(?:\/([a-z]+))?(?:\/(\d+))?$/)
  if (soundMatch) {
    require('sounds.read')
    const [, id, action, arg] = soundMatch
    const d = db()
    const sound = d.prepare('SELECT * FROM sounds WHERE id=?').get(id)
    if (!sound) notFound('son introuvable')
    const restriction = d.prepare('SELECT * FROM restrictions WHERE sound_id=?').get(id)
    const versions = d.prepare(`SELECT id, version, file_path, sha256, bytes, duration_s,
                                       sample_rate, channels, analyzed_at, note
                                FROM sound_versions WHERE sound_id=? ORDER BY version DESC`).all(id)
    const contents = d.prepare('SELECT * FROM content WHERE sound_id=? ORDER BY locale').all(id)
    const stepsFor = d.prepare(`SELECT s.id, s.name_fr, ss.position FROM step_sounds ss
                                JOIN steps s ON s.id=ss.step_id WHERE ss.sound_id=? ORDER BY s.id`).all(id)

    if (!action && method === 'GET') {
      return json(res, 200, { sound, restriction, versions, contents, steps: stepsFor,
        analysis: sound.analysis_json ? JSON.parse(sound.analysis_json) : null,
        analysisFresh: sound.analysis_version !== 'stale' })
    }

    if (action === 'audio' && method === 'GET') {
      const v = arg ? versions.find((x) => String(x.version) === arg) : versions[0]
      let file = v?.file_path
      if (!file) {
        const bundled = sound.file ? join(ROOT, 'public', sound.file.replace(/^\/+/, '')) : null
        if (!bundled || !existsSync(bundled)) notFound('aucun fichier audio')
        return streamFile(req, res, bundled)
      }
      if (!existsSync(file)) notFound('fichier de version absent du disque')
      return streamFile(req, res, file)
    }

    if (action === 'replacement' && method === 'POST') {
      require('sounds.replace')
      const ctype = (req.headers['content-type'] ?? '').split(';')[0].trim()
      const ext = ALLOWED_AUDIO[ctype]
      if (!ext) bad(`format non accepté: ${ctype}. Formats: ${Object.keys(ALLOWED_AUDIO).join(', ')}`)
      const buf = await readBody(req, MAX_AUDIO)
      if (buf.length < 1024) bad('fichier trop petit pour être un audio valide')
      if (!sniffAudio(buf, ext)) bad('le contenu ne correspond pas au format annoncé')

      const hash = sha256(buf)
      const dup = d.prepare('SELECT version FROM sound_versions WHERE sound_id=? AND sha256=?').get(id, hash)
      if (dup) conflict(`ce fichier existe déjà comme version ${dup.version} — aucune copie créée`)

      const nextVer = (versions[0]?.version ?? sound.version ?? 1) + 1
      const dir = join(FILES_DIR, id)
      mkdirSync(dir, { recursive: true })
      const target = join(dir, `v${nextVer}-${hash.slice(0, 8)}${ext}`)
      if (existsSync(target)) conflict('collision de nom de fichier — réessayez')
      writeFileSync(target, buf)

      const probe = await ffprobe(target)
      const at = nowIso()
      d.prepare(`INSERT INTO sound_versions
        (sound_id, version, file_path, sha256, bytes, duration_s, sample_rate, channels, analyzed_at, created_by, note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, nextVer, target, hash, buf.length, probe?.duration_s ?? null,
          probe?.sample_rate ?? null, probe?.channels ?? null, at, user.id, 'remplacement admin')
      // A new file invalidates measurements taken on the old one. Mark explicitly
      // rather than silently reusing them.
      d.prepare(`UPDATE sounds SET version=?, updated_at=?, analysis_version='stale' WHERE id=?`)
        .run(nextVer, at, id)
      audit(user, 'sound.replace', 'sound', id,
        { version: nextVer, sha256: hash, bytes: buf.length, duration_s: probe?.duration_s ?? null })
      return json(res, 201, { version: nextVer, sha256: hash, probe,
        analysisState: 'stale', message: 'nouvelle version créée ; les analyses existantes sont invalidées' })
    }

    if (action === 'restore' && method === 'POST') {
      require('sounds.replace')
      const src = versions.find((v) => String(v.version) === String(arg))
      if (!src) notFound('version introuvable')
      if (!src.file_path || !existsSync(src.file_path)) notFound('fichier de cette version absent')
      const nextVer = (versions[0]?.version ?? 1) + 1
      const buf = readFileSync(src.file_path)
      const hash = sha256(buf)
      const dir = join(FILES_DIR, id)
      mkdirSync(dir, { recursive: true })
      const target = join(dir, `v${nextVer}-${hash.slice(0, 8)}${extname(src.file_path)}`)
      if (!existsSync(target)) writeFileSync(target, buf)
      const at = nowIso()
      d.prepare(`INSERT INTO sound_versions
        (sound_id, version, file_path, sha256, bytes, duration_s, sample_rate, channels, analyzed_at, created_by, note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, nextVer, target, hash, buf.length, src.duration_s, src.sample_rate,
          src.channels, at, user.id, `restauration de la version ${src.version}`)
      d.prepare(`UPDATE sounds SET version=?, updated_at=?, analysis_version='stale' WHERE id=?`)
        .run(nextVer, at, id)
      audit(user, 'sound.restore', 'sound', id, { from: src.version, to: nextVer })
      return json(res, 201, { version: nextVer, restoredFrom: src.version })
    }

    if (action === 'reanalyse' && method === 'POST') {
      require('sounds.replace')
      const latest = versions[0]
      const filePath = latest?.file_path
        ?? (sound.file ? join(ROOT, 'public', sound.file.replace(/^\/+/, '')) : null)
      if (!filePath || !existsSync(filePath)) notFound('aucun fichier à analyser')
      const result = await runToolchainAnalyse(filePath)
      if (!result.ok) {
        return json(res, 503, { error: 'analyse indisponible', detail: result.error })
      }
      d.prepare(`UPDATE sounds SET analysis_json=?, analysis_version=?, updated_at=? WHERE id=?`)
        .run(JSON.stringify(result.analysis), result.version, nowIso(), id)
      audit(user, 'sound.reanalyse', 'sound', id, { version: result.version })
      return json(res, 200, { analysis: result.analysis, analysisVersion: result.version })
    }

    if (action && method !== 'GET' && !['replacement', 'restore', 'reanalyse'].includes(action)) notFound()
  }

  /* --------------------------------------------------------------- content */
  if (path === '/api/content' && method === 'GET') {
    require('content.read')
    const status = url.searchParams.get('status')
    let rows = db().prepare(`SELECT c.*, s.name AS sound_name FROM content c
                             JOIN sounds s ON s.id=c.sound_id ORDER BY s.code, c.locale`).all()
    if (status) rows = rows.filter((r) => r.status === status)
    return json(res, 200, { count: rows.length, content: rows })
  }

  // content ids are "<soundId>:<locale>", so ':' must be allowed in the segment
  const contentMatch = path.match(/^\/api\/content\/([\w.:-]+)(?:\/([a-z]+))?(?:\/(\d+))?$/)
  if (contentMatch) {
    const [, soundId, action, arg] = contentMatch
    // content ids are "<soundId>:<locale>"
    const [sid, locale = 'fr'] = soundId.split(':')
    require(action === 'transition' || action === 'revert' ? 'content.review' : 'content.edit')
    const d = db()
    let row = d.prepare('SELECT * FROM content WHERE sound_id=? AND locale=?').get(sid, locale)
    if (!row && method === 'GET') return json(res, 404, { error: 'contenu inexistant', soundId: sid, locale })
    if (!row) {
      const sound = d.prepare('SELECT id FROM sounds WHERE id=?').get(sid)
      if (!sound) notFound('son introuvable')
      const at = nowIso()
      d.prepare(`INSERT INTO content (id, sound_id, locale, status, version, author_id, updated_at)
                VALUES (?,?,?,?,?,?,?)`)
        .run(`${sid}:${locale}`, sid, locale, 'draft', 1, user.id, at)
      row = d.prepare('SELECT * FROM content WHERE sound_id=? AND locale=?').get(sid, locale)
      // archive the initial empty version too, so "revert to v1" has something to
      // revert to instead of returning 404
      d.prepare(`INSERT INTO content_versions (content_id, version, payload_json, status, author_id, at, note)
                 VALUES (?,?,?,?,?,?,?)`)
        .run(row.id, 1, JSON.stringify(row), 'draft', user.id, at, 'création du contenu')
    }

    if (!action && method === 'GET') {
      const versions = d.prepare(`SELECT id, version, status, author_id, at, note
                                  FROM content_versions WHERE content_id=? ORDER BY version DESC`).all(row.id)
      const restrict = d.prepare('SELECT * FROM restrictions WHERE sound_id=?').get(sid)
      return json(res, 200, { content: row, versions, restriction: restrict })
    }

    if (!action && (method === 'PATCH' || method === 'PUT')) {
      const body = await readJson(req)
      const allowed = ['title', 'short_desc', 'story', 'pedagogy', 'credits_note', 'sources']
      const next = { ...row }
      for (const k of allowed) if (k in body) next[k] = body[k] == null ? null : String(body[k]).slice(0, 20000)
      const aiGenerated = body.ai_generated ? 1 : row.ai_generated
      // AI-generated text may be saved as a draft but never auto-approved.
      const targetStatus = row.status === 'published' ? 'draft' : row.status
      const version = row.version + 1
      const at = nowIso()
      d.prepare(`UPDATE content SET title=?, short_desc=?, story=?, pedagogy=?, credits_note=?,
                                   sources=?, status=?, version=?, author_id=?, updated_at=?, ai_generated=?
                 WHERE id=?`)
        .run(next.title, next.short_desc, next.story, next.pedagogy, next.credits_note,
          next.sources, targetStatus, version, user.id, at, aiGenerated, row.id)
      d.prepare(`INSERT INTO content_versions (content_id, version, payload_json, status, author_id, at, note)
                 VALUES (?,?,?,?,?,?,?)`)
        .run(row.id, version, JSON.stringify({ ...next, ai_generated: aiGenerated }), targetStatus, user.id, at,
          body.note ?? null)
      audit(user, 'content.save', 'content', row.id, { version, status: targetStatus, ai: !!aiGenerated })
      return json(res, 200, { content: d.prepare('SELECT * FROM content WHERE id=?').get(row.id) })
    }

    if (action === 'transition' && method === 'POST') {
      const { to } = await readJson(req)
      const flow = { draft: ['review'], review: ['approved', 'draft'], approved: ['published', 'review'], published: ['draft'] }
      const allowed = flow[row.status] ?? []
      if (!allowed.includes(to)) conflict(`transition ${row.status} → ${to} non autorisée`, { allowed })
      if (to === 'approved' && row.ai_generated) {
        conflict('un contenu marqué généré par IA ne peut pas être approuvé comme information vérifiée')
      }
      if (to === 'published') require('content.publish') ?? undefined
      const at = nowIso()
      d.prepare('UPDATE content SET status=?, updated_at=? WHERE id=?').run(to, at, row.id)
      d.prepare(`INSERT INTO content_versions (content_id, version, payload_json, status, author_id, at, note)
                 VALUES (?,?,?,?,?,?,?)`)
        .run(row.id, row.version, JSON.stringify(row), to, user.id, at, `transition → ${to}`)
      audit(user, 'content.transition', 'content', row.id, { from: row.status, to })
      return json(res, 200, { status: to })
    }

    if (action === 'revert' && method === 'POST') {
      const v = d.prepare('SELECT * FROM content_versions WHERE content_id=? AND version=?').get(row.id, Number(arg))
      if (!v) notFound('version introuvable')
      const payload = JSON.parse(v.payload_json)
      const version = row.version + 1
      const at = nowIso()
      d.prepare(`UPDATE content SET title=?, short_desc=?, story=?, pedagogy=?, credits_note=?, sources=?,
                                   status='draft', version=?, author_id=?, updated_at=? WHERE id=?`)
        .run(payload.title, payload.short_desc, payload.story, payload.pedagogy,
          payload.credits_note, payload.sources, version, user.id, at, row.id)
      d.prepare(`INSERT INTO content_versions (content_id, version, payload_json, status, author_id, at, note)
                 VALUES (?,?,?,?,?,?,?)`)
        .run(row.id, version, v.payload_json, 'draft', user.id, at, `retour à la version ${arg}`)
      audit(user, 'content.revert', 'content', row.id, { toVersion: Number(arg), newVersion: version })
      return json(res, 200, { version, revertedTo: Number(arg), status: 'draft' })
    }
  }

  /* ----------------------------------------------------------------- steps */
  if (path === '/api/steps' && method === 'GET') {
    require('steps.read')
    const steps = db().prepare('SELECT * FROM steps ORDER BY display_no').all()
    const links = db().prepare(`SELECT ss.step_id, ss.sound_id, ss.position, s.name, s.sensitive
                                FROM step_sounds ss JOIN sounds s ON s.id=ss.sound_id
                                ORDER BY ss.step_id, ss.position`).all()
    return json(res, 200, {
      steps: steps.map((s) => ({ ...s, sounds: links.filter((l) => l.step_id === s.id) })),
    })
  }

  const stepMatch = path.match(/^\/api\/steps\/(\d+)(?:\/([a-z]+))?$/)
  if (stepMatch) {
    const [, id, action] = stepMatch
    const numericId = Number(id)
    if (method === 'GET') {
      require('steps.read')
      const step = db().prepare('SELECT * FROM steps WHERE id=?').get(numericId)
      if (!step) notFound('étape introuvable')
      const sounds = db().prepare(`SELECT ss.sound_id, ss.position, s.name, s.sensitive, s.availability
                                   FROM step_sounds ss JOIN sounds s ON s.id=ss.sound_id
                                   WHERE ss.step_id=? ORDER BY ss.position`).all(numericId)
      return json(res, 200, { step, sounds })
    }
    require('steps.edit')
    const body = await readJson(req)
    const step = db().prepare('SELECT * FROM steps WHERE id=?').get(numericId)
    if (!step) notFound('étape introuvable')
    if (body.display_no != null && body.display_no !== step.display_no) {
      bad('le numéro d’affichage est dérivé de l’identifiant stable ; modifier l’ordre se fait via l’ordre des étapes')
    }
    const at = nowIso()
    db().prepare(`UPDATE steps SET name_fr=?, name_en=?, description=?, story=?, illustration=?,
                                  qr=?, status=?, updated_at=? WHERE id=?`)
      .run(body.name_fr ?? step.name_fr, body.name_en ?? step.name_en,
        body.description ?? step.description, body.story ?? step.story,
        body.illustration ?? step.illustration, body.qr ?? step.qr,
        body.status ?? step.status, at, numericId)
    audit(user, 'step.update', 'step', String(numericId), { fields: Object.keys(body) })
    return json(res, 200, { step: db().prepare('SELECT * FROM steps WHERE id=?').get(numericId) })
  }

  const stepSoundsMatch = path.match(/^\/api\/steps\/(\d+)\/sounds$/)
  if (stepSoundsMatch && method === 'PUT') {
    require('steps.edit')
    const numericId = Number(stepSoundsMatch[1])
    const { sounds } = await readJson(req)
    if (!Array.isArray(sounds)) bad('« sounds » doit être une liste d’identifiants')
    const d = db()
    const step = d.prepare('SELECT id FROM steps WHERE id=?').get(numericId)
    if (!step) notFound('étape introuvable')
    for (const sid of sounds) {
      if (!d.prepare('SELECT 1 AS x FROM sounds WHERE id=?').get(sid)) bad(`son inconnu: ${sid}`)
    }
    d.exec('BEGIN')
    try {
      d.prepare('DELETE FROM step_sounds WHERE step_id=?').run(numericId)
      sounds.forEach((sid, i) => d.prepare(
        'INSERT INTO step_sounds (step_id, sound_id, position) VALUES (?,?,?)').run(numericId, sid, i + 1))
      d.exec('COMMIT')
    } catch (e) { d.exec('ROLLBACK'); throw e }
    audit(user, 'step.sounds', 'step', String(numericId), { sounds })
    return json(res, 200, { stepId: numericId, sounds })
  }

  /* ----------------------------------------------------------------- music */
  if (path === '/api/music' && method === 'GET') {
    require('music.read')
    const rows = db().prepare('SELECT * FROM universes ORDER BY rowid').all()
    return json(res, 200, {
      universes: rows.map((u) => ({ ...u, params: u.params_json ? JSON.parse(u.params_json) : null })),
      note: 'les paramètres affichés sont ceux que le moteur lit réellement ; '
        + 'les univers sans compositeur sont marqués engine_implemented=false',
    })
  }

  const musicMatch = path.match(/^\/api\/music\/([\w-]+)$/)
  if (musicMatch && method === 'PATCH') {
    require('music.edit')
    const id = musicMatch[1]
    const body = await readJson(req)
    const row = db().prepare('SELECT * FROM universes WHERE id=?').get(id)
    if (!row) notFound('univers introuvable')
    const at = nowIso()
    const params = body.params ? JSON.stringify(body.params) : row.params_json
    db().prepare('UPDATE universes SET name=?, description=?, status=?, version=version+1, params_json=?, updated_at=? WHERE id=?')
      .run(body.name ?? row.name, body.description ?? row.description,
        body.status ?? row.status, params, at, id)
    audit(user, 'music.update', 'universe', id, { fields: Object.keys(body) })
    return json(res, 200, { universe: db().prepare('SELECT * FROM universes WHERE id=?').get(id) })
  }

  /* ----------------------------------------------------------------- users */
  if (path === '/api/users' && method === 'GET') {
    require('users.read')
    const rows = db().prepare(`SELECT id, email, name, role, is_active, created_at, last_login_at
                               FROM users ORDER BY created_at`).all()
    return json(res, 200, { users: rows, roles: ROLES, permissions: PERMISSIONS })
  }
  if (path === '/api/users' && method === 'POST') {
    require('users.manage')
    const body = await readJson(req)
    try {
      const created = createUser(body)
      audit(user, 'user.create', 'user', created.id, { role: created.role })
      return json(res, 201, { user: created })
    } catch (e) { bad(e.message) }
  }
  const userMatch = path.match(/^\/api\/users\/([\w-]+)$/)
  if (userMatch && method === 'PATCH') {
    require('users.manage')
    const id = userMatch[1]
    const body = await readJson(req)
    const target = db().prepare('SELECT * FROM users WHERE id=?').get(id)
    if (!target) notFound('utilisateur introuvable')
    if (target.id === user.id && body.role && body.role !== user.role) {
      conflict('un administrateur ne peut pas changer son propre rôle')
    }
    if (body.role && !ROLES.includes(body.role)) bad('rôle inconnu')
    db().prepare('UPDATE users SET name=?, role=?, is_active=? WHERE id=?')
      .run(body.name ?? target.name, body.role ?? target.role,
        body.is_active === undefined ? target.is_active : (body.is_active ? 1 : 0), id)
    audit(user, 'user.update', 'user', id, { fields: Object.keys(body) })
    return json(res, 200, { ok: true })
  }

  /* ----------------------------------------------------------------- audit */
  if (path === '/api/audit' && method === 'GET') {
    require('audit.read')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500)
    const rows = db().prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit)
    return json(res, 200, { entries: rows })
  }

  /* ----------------------------------------------------------- diagnostics */
  if (path === '/api/system/diagnostics' && method === 'GET') {
    require('system.read')
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const catalog = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))
    const stepsFile = ['config/steps.v2.json', 'config/steps.json']
      .map((p) => join(ROOT, p)).find((p) => existsSync(p))
    const stepsCfg = stepsFile ? JSON.parse(readFileSync(stepsFile, 'utf8')) : null
    const d = db()
    const counts = {
      sounds: d.prepare('SELECT COUNT(*) n FROM sounds').get().n,
      soundVersions: d.prepare('SELECT COUNT(*) n FROM sound_versions').get().n,
      content: d.prepare('SELECT COUNT(*) n FROM content').get().n,
      steps: d.prepare('SELECT COUNT(*) n FROM steps').get().n,
      publications: d.prepare('SELECT COUNT(*) n FROM publications').get().n,
      auditEntries: d.prepare('SELECT COUNT(*) n FROM audit_log').get().n,
    }
    const lastPub = d.prepare('SELECT id, created_at, note FROM publications ORDER BY id DESC LIMIT 1').get()
    const lastErrors = d.prepare(`SELECT at, action, entity, entity_id, detail FROM audit_log
                                  WHERE action LIKE '%failed%' OR action LIKE '%error%'
                                  ORDER BY id DESC LIMIT 5`).all()
    return json(res, 200, {
      app: { name: pkg.name, version: pkg.version, node: process.version },
      engine: { version: 'src/engine (bundle)', modifiedByAdmin: false },
      catalog: { version: catalog.version, sounds: catalog.sounds?.length ?? 0,
        generatedAt: catalog.generatedAt ?? null },
      stepsConfig: { file: stepsFile ? stepsFile.replace(`${ROOT}/`, '') : null,
        version: stepsCfg?.version ?? null, steps: stepsCfg?.steps?.length ?? null },
      storage: { db: 'sqlite (node:sqlite)', dataDir: 'data/admin', counts },
      lastPublication: lastPub ?? null,
      recentErrors: lastErrors,
      checks: { database: 'ok', api: 'ok' },
    })
  }

  /* ---------------------------------------------------------- publications */
  if (path === '/api/publication/preview' && method === 'GET') {
    require('content.read')
    return json(res, 200, buildPublicationManifest(user))
  }
  if (path === '/api/publication/publish' && method === 'POST') {
    require('publication.publish')
    const body = await readJson(req)
    if (body.confirm !== 'PUBLIER') {
      bad('confirmation requise : envoyez { "confirm": "PUBLIER" } — la publication est une opération explicite')
    }
    const manifest = buildPublicationManifest(user)
    const id = (db().prepare('SELECT COALESCE(MAX(id),0)+1 AS n FROM publications').get().n)
    const dir = join(PUB_DIR, `pub-${id}`)
    mkdirSync(dir, { recursive: true })
    writeJsonAtomic(join(dir, 'catalog.json'), manifest.catalog)
    writeJsonAtomic(join(dir, 'steps.json'), manifest.steps)
    writeJsonAtomic(join(dir, 'manifest.json'), { ...manifest.manifest, dir })
    db().prepare('INSERT INTO publications (created_at, created_by, note, dir, manifest_json) VALUES (?,?,?,?,?)')
      .run(nowIso(), user.id, body.note ?? null, dir, JSON.stringify(manifest.manifest))
    audit(user, 'publication.publish', 'publication', String(id), {
      note: body.note ?? null, dir: dir.replace(`${ROOT}/`, ''),
    })
    return json(res, 201, { id, dir: dir.replace(`${ROOT}/`, ''), manifest: manifest.manifest,
      applied: false,
      note: 'snapshot écrit dans data/admin/publications ; la version visiteur n’est pas modifiée '
        + 'tant que `npm run admin:apply` n’est pas exécuté' })
  }
  if (path === '/api/publications' && method === 'GET') {
    require('content.read')
    const rows = db().prepare('SELECT id, created_at, created_by, note, dir FROM publications ORDER BY id DESC').all()
    return json(res, 200, { publications: rows })
  }

  /* ------------------------------------------------------- dev: selections */
  if (path === '/api/dev/selection' && method === 'POST') {
    require('dev.use')
    const { universeId, soundIds } = await readJson(req)
    const d = db()
    const u = d.prepare('SELECT * FROM universes WHERE id=?').get(universeId ?? '')
    if (!u) notFound('univers introuvable')
    const ids = Array.isArray(soundIds) ? soundIds : []
    const rows = ids.map((id) => d.prepare('SELECT id, name, sensitive, availability, status, file FROM sounds WHERE id=?').get(id))
    const rejected = []
    const accepted = []
    for (const [i, r] of rows.entries()) {
      if (!r) { rejected.push({ id: ids[i], reason: 'inconnu' }); continue }
      // Politique musicale v2 : plus d'exclusion liée à la sensibilité historique.
      // Seul motif restant : absence de fichier audio exploitable.
      if (!r.file) { rejected.push({ id: r.id, reason: 'aucun fichier audio' }); continue }
      accepted.push(r.id)
    }
    return json(res, 200, { universe: { id: u.id, name: u.name, params: JSON.parse(u.params_json ?? '{}'),
      engineImplemented: !!u.engine_implemented }, accepted, rejected })
  }

  return json(res, 404, { error: 'route inconnue', path })
}

function buildPublicationManifest(user) {
  const d = db()
  const steps = d.prepare('SELECT * FROM steps ORDER BY display_no').all()
  const links = d.prepare('SELECT * FROM step_sounds ORDER BY step_id, position').all()
  const sounds = d.prepare(`SELECT s.*, c.title, c.short_desc, c.story, c.pedagogy, c.sources,
                                   r.sensitive AS r_sensitive, r.availability AS r_availability
                            FROM sounds s
                            LEFT JOIN content c ON c.sound_id=s.id AND c.locale='fr' AND c.status='published'
                            LEFT JOIN restrictions r ON r.sound_id=s.id
                            ORDER BY s.code`).all()
  const catalog = {
    version: 2,
    generatedAt: nowIso(),
    source: `admin publication by ${user.email}`,
    limits: { minSelected: 1, maxSelected: 8 },
    steps: steps.map((s) => ({ id: s.id, title: s.name_fr, short: s.code, summary: s.description })),
    sounds: sounds.map((s) => ({
      id: s.id, code: s.code, name: s.name, stepId: s.step_id,
      title: s.title ?? undefined, shortDesc: s.short_desc ?? null, history: s.story ?? null,
      pedagogy: s.pedagogy ?? null, sources: s.sources ?? null,
      sensitive: !!s.r_sensitive, availability: s.r_availability ?? s.availability,
      license: s.license, credits: s.credits, file: s.file, version: s.version,
    })),
  }
  const pending = d.prepare(`SELECT COUNT(*) n FROM content WHERE status<>'published'`).get().n
  return {
    catalog,
    steps: { version: 2, steps: steps.map((s) => ({ id: s.id, title: s.name_fr,
      sounds: links.filter((l) => l.step_id === s.id).map((l) => l.sound_id) })) },
    manifest: {
      generatedAt: nowIso(), generatedBy: user.email,
      sounds: catalog.sounds.length, steps: steps.length,
      publishedContent: sounds.filter((s) => s.title).length,
      unpublishedContent: pending,
      engineModified: false,
    },
  }
}

/** Run the existing analysis toolchain, if present. Never invents a result. */
function runToolchainAnalyse(filePath) {
  const py = '/opt/data/tools/sugar-audio/renv/analysis/bin/python'
  const wrapper = '/opt/data/tools/sugar-audio/bin/so'
  return new Promise((res) => {
    if (!existsSync(py) || !existsSync(wrapper)) {
      return res({ ok: false, error: 'toolchain d’analyse absent de cet hôte (/opt/data/tools/sugar-audio)' })
    }
    const p = spawn(wrapper, ['analyze', '--no-cache', filePath], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('error', (e) => res({ ok: false, error: e.message }))
    p.on('close', (code) => {
      if (code !== 0) return res({ ok: false, error: `analyse en échec (code ${code}): ${err.slice(-200)}` })
      try {
        const parsed = JSON.parse(out)
        const r = parsed.results?.[0]
        if (!r) return res({ ok: false, error: 'sortie d’analyse vide' })
        return res({ ok: true, analysis: r, version: `librosa-${parsed.provenance ? 'toolchain' : 'unknown'}` })
      } catch {
        return res({ ok: false, error: 'sortie d’analyse illisible' })
      }
    })
  })
}

function streamFile(req, res, path) {
  let st
  try { st = statSync(path) } catch { return notFound('fichier introuvable') }
  const type = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.flac': 'audio/flac' }[extname(path)] ?? 'application/octet-stream'
  const range = req.headers.range
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    const start = m && m[1] ? Number(m[1]) : 0
    const end = m && m[2] ? Number(m[2]) : st.size - 1
    res.writeHead(206, {
      'content-type': type, 'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${st.size}`,
      'content-length': end - start + 1, 'cache-control': 'no-store',
    })
    createReadStream(path, { start, end }).pipe(res)
    return
  }
  res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'cache-control': 'no-store',
    'accept-ranges': 'bytes' })
  createReadStream(path).pipe(res)
}

export { HttpError }
