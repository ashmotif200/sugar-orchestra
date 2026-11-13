/**
 * Module C — Audio Rendering Engine (côté serveur).
 *
 * Reçoit un ScorePlan, résout les identifiants de sons en fichiers réels côté
 * serveur (jamais un chemin fourni par le navigateur), mélange, écrit un WAV et
 * le vérifie avec ffmpeg.
 *
 * Pourquoi un mélangeur en JS plutôt qu'un graphe ffmpeg : le graphe devrait
 * rejouer exactement la sémantique du plan (enveloppes, panoramique, taux par
 * note). Une sommation en Float32 d'échantillons rééchantillonnés est plus
 * simple à vérifier, déterministe, et sans dépendance. Le décodage, lui, réutilise
 * ffmpeg : on ne réimplémente pas un décodeur.
 *
 * Ce module ne décide de rien musicalement : il exécute le plan.
 */
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { DATA_DIR, ROOT, db } from './db.mjs'

export const SAMPLE_RATE = 44100
export const MAX_NOTES = 20000
export const MAX_BARS = 512
export const MAX_RENDER_S = 300
const TRUE_PEAK_CEILING_DB = -1.0
const RENDERS_DIR = join(DATA_DIR, 'renders')
const KEEP_RENDERS = 24

const finite = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi

/** Validation stricte : un plan malformé ne doit jamais atteindre le mélangeur. */
export function validatePlan(plan) {
  const errors = []
  if (!plan || typeof plan !== 'object') return ['plan absent']
  if (plan.schema !== 2) errors.push('schema doit valoir 2')
  if (!['v2', 'v2.1'].includes(plan.engine)) errors.push('engine doit valoir « v2 » ou « v2.1 »')
  if (!Number.isInteger(plan.seed)) errors.push('seed entier requis')
  if (typeof plan.profileId !== 'string' || !/^[a-z0-9-]{3,40}$/.test(plan.profileId)) errors.push('profileId invalide')
  if (!Number.isInteger(plan.profileVersion) || plan.profileVersion < 1) errors.push('profileVersion invalide')

  const t = plan.time ?? {}
  if (!finite(t.barSeconds, 0.25, 8)) errors.push('barSeconds hors bornes (0.25–8 s)')
  if (![3, 4, 6].includes(t.beatsPerBar)) errors.push('beatsPerBar doit être 3, 4 ou 6')
  if (![2, 3].includes(t.subdivision)) errors.push('subdivision doit être 2 ou 3')

  if (!Number.isInteger(plan.bars) || plan.bars < 1 || plan.bars > MAX_BARS) errors.push(`bars doit être un entier 1–${MAX_BARS}`)
  if (!Array.isArray(plan.notes)) errors.push('notes doit être une liste')
  else if (plan.notes.length > MAX_NOTES) errors.push(`trop de notes (max ${MAX_NOTES})`)

  const duration = (plan.bars || 0) * (t.barSeconds || 0)
  if (duration > MAX_RENDER_S) errors.push(`durée ${duration.toFixed(1)} s au-delà de ${MAX_RENDER_S} s`)

  if (plan.engine === 'v2.1') {
    if (!['museum_only', 'museum_derived', 'hybrid_synth'].includes(plan.mode)) errors.push('mode V2.1 invalide')
    const bass = plan.bassNotes ?? []
    if (!Array.isArray(bass)) errors.push('bassNotes doit être une liste')
    else if (bass.length > 4000) errors.push('trop de notes de basse (max 4000)')
    else for (const [i, b] of bass.entries()) {
      if (!finite(b.midi, 24, 60)) { errors.push(`basse ${i}: midi hors 24–60`); break }
      if (!finite(b.velocity, 0, 1)) { errors.push(`basse ${i}: vélocité hors 0–1`); break }
      if (!finite(b.durationBeats, 0.05, 16)) { errors.push(`basse ${i}: durée invalide`); break }
      if (!finite(b.bar, 0, MAX_BARS) || !finite(b.beat, 0, 8) || !finite(b.sub, 0, 8)) {
        errors.push(`basse ${i}: position invalide`); break
      }
    }
    if (bass.length && !plan.bassSynth) errors.push('bassNotes sans paramètres de synthèse')
    if (plan.mode !== 'hybrid_synth' && bass.length) errors.push('bassNotes interdites hors mode hybrid_synth')
  }

  if (Array.isArray(plan.notes)) {
    for (const [i, n] of plan.notes.entries()) {
      if (typeof n.sourceId !== 'string' || !/^[0-9]{2}_[0-9]{2}$/.test(n.sourceId)) {
        errors.push(`note ${i}: sourceId invalide`); break
      }
      if (!finite(n.playbackRate, 0.25, 4)) { errors.push(`note ${i}: playbackRate hors bornes`); break }
      if (!finite(n.gainDb, -60, 6)) { errors.push(`note ${i}: gain hors bornes`); break }
      if (!finite(n.bar, 0, MAX_BARS) || !finite(n.beat, 0, 8) || !finite(n.sub, 0, 8)) {
        errors.push(`note ${i}: position invalide`); break
      }
      if (!finite(n.durationBeats, 0.05, 64)) { errors.push(`note ${i}: durée invalide`); break }
    }
  }
  return errors
}

/** Résout un identifiant de son en fichier : base d'abord, masters ensuite. */
function resolveSource(soundId) {
  const d = db()
  const row = d.prepare('SELECT id, file FROM sounds WHERE id = ?').get(soundId)
  if (!row) return null
  const version = d.prepare(`SELECT file_path FROM sound_versions
                             WHERE sound_id = ? AND file_path IS NOT NULL
                             ORDER BY version DESC LIMIT 1`).get(soundId)
  if (version?.file_path && existsSync(version.file_path)) return version.file_path
  const master = join(ROOT, 'assets', 'originals', `${soundId}.wav`)
  if (existsSync(master)) return master
  const bundled = row.file ? join(ROOT, 'public', String(row.file).replace(/^\/+/, '')) : null
  return bundled && existsSync(bundled) ? bundled : null
}

/** Décode un fichier en Float32 stéréo via ffmpeg (on ne réimplémente pas un décodeur). */
function decodeStereo(path) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le',
      '-ac', '2', '-ar', String(SAMPLE_RATE), '-'])
    const chunks = []
    let err = ''
    p.stdout.on('data', (c) => chunks.push(c))
    p.stderr.on('data', (c) => { err += c })
    p.on('error', reject)
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`décodage ffmpeg en échec: ${err.slice(-200)}`))
      const buf = Buffer.concat(chunks)
      const f = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4))
      const frames = Math.floor(f.length / 2)
      const left = new Float32Array(frames)
      const right = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        left[i] = f[i * 2]
        right[i] = f[i * 2 + 1]
      }
      resolve({ left, right, frames })
    })
  })
}

/** Mélange pur : aucune décision musicale, seulement l'exécution du plan. */
export function mixPlan(plan, sources) {
  const { barSeconds, beatsPerBar, subdivision } = plan.time
  const beatS = barSeconds / beatsPerBar
  const totalFrames = Math.ceil(plan.bars * barSeconds * SAMPLE_RATE) + SAMPLE_RATE
  const outL = new Float32Array(totalFrames)
  const outR = new Float32Array(totalFrames)
  let rendered = 0
  const skipped = []

  for (const note of plan.notes) {
    const src = sources.get(note.sourceId)
    if (!src) { skipped.push(note.sourceId); continue }
    const startS = note.bar * barSeconds + note.beat * beatS + note.sub * (beatS / subdivision)
    const durS = Math.min(note.durationBeats * beatS, 30)
    const startFrame = Math.round(startS * SAMPLE_RATE)
    const durFrames = Math.max(1, Math.round(durS * SAMPLE_RATE))
    const offsetFrames = Math.round((note.sourceOffsetS ?? 0) * SAMPLE_RATE)
    const rate = note.playbackRate ?? 1
    const gain = Math.pow(10, (note.gainDb ?? 0) / 20)
    const pan = Math.max(-1, Math.min(1, note.pan ?? 0))
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4)
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4)
    const attack = Math.max(1, Math.round((note.attackS ?? 0.005) * SAMPLE_RATE))
    const release = Math.max(1, Math.round((note.releaseS ?? 0.08) * SAMPLE_RATE))
    // filtre une pente (facultatif) : suffisant pour adoucir une texture
    const lpCoef = note.lowpassHz ? 1 - Math.exp((-2 * Math.PI * note.lowpassHz) / SAMPLE_RATE) : 1
    let lpL = 0
    let lpR = 0

    for (let i = 0; i < durFrames; i++) {
      const dst = startFrame + i
      if (dst >= totalFrames) break
      const srcPos = offsetFrames + i * rate
      if (srcPos >= src.frames - 1) break
      const i0 = Math.floor(srcPos)
      const frac = srcPos - i0
      let l = src.left[i0] * (1 - frac) + src.left[i0 + 1] * frac
      let r = src.right[i0] * (1 - frac) + src.right[i0 + 1] * frac
      let env = 1
      if (i < attack) env = i / attack
      else if (i > durFrames - release) env = Math.max(0, (durFrames - i) / release)
      if (lpCoef < 1) {
        lpL += lpCoef * (l - lpL)
        lpR += lpCoef * (r - lpR)
        l = lpL
        r = lpR
      }
      outL[dst] += l * env * gl
      outR[dst] += r * env * gr
      rendered++
    }
  }
  // ---- synthèse de basse (mode hybrid_synth uniquement)
  let bassRendered = 0
  if (Array.isArray(plan.bassNotes) && plan.bassNotes.length && plan.bassSynth) {
    const s = plan.bassSynth
    const amp = (s.harmonics ?? [1, 0.3, 0.15]).map((h) => Math.max(0, Math.min(1, h)))
    const gain = Math.pow(10, (s.gainDb ?? 0) / 20)
    const cutoff = Math.max(40, Math.min(2000, s.cutoffHz ?? 300))
    const lpCoef = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE)
    const drive = Math.max(0, Math.min(1, s.drive ?? 0))
    for (const note of plan.bassNotes) {
      const freq = 440 * Math.pow(2, (note.midi - 69) / 12)
      if (!Number.isFinite(freq) || freq < 20 || freq > 400) continue
      const startS = note.bar * barSeconds + note.beat * beatS + note.sub * (beatS / subdivision)
      const durS = Math.min(note.durationBeats * beatS, 8)
      const startFrame = Math.round(startS * SAMPLE_RATE)
      const durFrames = Math.max(1, Math.round(durS * SAMPLE_RATE))
      const a = Math.max(0.001, s.attackS ?? 0.01) * SAMPLE_RATE
      const d = Math.max(0.001, s.decayS ?? 0.2) * SAMPLE_RATE
      const rel = Math.max(0.001, s.releaseS ?? 0.2) * SAMPLE_RATE
      const sus = Math.max(0, Math.min(1, s.sustain ?? 0.7))
      const vel = Math.max(0, Math.min(1, note.velocity ?? 0.8))
      let lp = 0
      for (let i = 0; i < durFrames; i++) {
        const dst = startFrame + i
        if (dst >= totalFrames) break
        const t = i / SAMPLE_RATE
        // enveloppe ADSR
        let env
        if (i < a) env = i / a
        else if (i < a + d) env = 1 - (1 - sus) * ((i - a) / d)
        else if (i > durFrames - rel) env = Math.max(0, sus * ((durFrames - i) / rel))
        else env = sus
        const ph = 2 * Math.PI * freq * t
        let x = amp[0] * Math.sin(ph)
          + amp[1] * Math.sin(2 * ph)
          + amp[2] * Math.sin(3 * ph)
        lp += lpCoef * (x - lp)
        x = lp
        if (drive > 0) x = Math.tanh(x * (1 + drive * 3)) / Math.tanh(1 + drive * 3)
        // 0,22 et non 0,5 : à 0,5 la basse dominait le mix (mesuré −8 LUFS contre
        // −15,3 LUFS sans basse sur le même matériau).
        const v = x * env * vel * gain * 0.22
        outL[dst] += v
        outR[dst] += v
        bassRendered++
      }
    }
  }

  return { outL, outR, totalFrames, rendered, bassRendered, skipped: [...new Set(skipped)] }
}

/** Réduction de gain si le plafond true peak est dépassé (approx. 4× suréchantillon). */
function peakStats(l, r) {
  let peak = 0
  let nan = false
  for (let i = 0; i < l.length; i++) {
    const a = l[i]
    const b = r[i]
    if (!Number.isFinite(a) || !Number.isFinite(b)) { nan = true; continue }
    const m = Math.max(Math.abs(a), Math.abs(b))
    if (m > peak) peak = m
  }
  // true peak approché : interpolation linéaire entre échantillons consécutifs
  let tp = peak
  for (let i = 1; i < l.length; i++) {
    const a = (l[i - 1] + l[i]) / 2
    const b = (r[i - 1] + r[i]) / 2
    const m = Math.max(Math.abs(a), Math.abs(b))
    if (m > tp) tp = m
  }
  return { peak, truePeak: tp, nan }
}

function encodeWav16(left, right, frames) {
  const dataBytes = frames * 2 * 2
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataBytes, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataBytes, 40)
  let o = 44
  const clamp = (v) => Math.max(-1, Math.min(1, v))
  for (let i = 0; i < frames; i++) {
    buf.writeInt16LE(Math.round(clamp(left[i]) * 32767), o); o += 2
    buf.writeInt16LE(Math.round(clamp(right[i]) * 32767), o); o += 2
  }
  return buf
}

/** Mesures réelles sur le fichier produit, via ffmpeg (pas d'estimation maison). */
function verifyWav(path) {
  return new Promise((resolve) => {
    const probe = spawn('ffprobe', ['-v', 'error', '-show_entries',
      'stream=sample_rate,channels:format=duration', '-of', 'json', path])
    let out = ''
    probe.stdout.on('data', (d) => { out += d })
    probe.on('error', () => resolve(null))
    probe.on('close', () => {
      let meta = {}
      try {
        const j = JSON.parse(out)
        meta = { durationS: Number(j.format?.duration) || null, sampleRate: Number(j.streams?.[0]?.sample_rate) || null, channels: Number(j.streams?.[0]?.channels) || null }
      } catch { /* ignore */ }
      const eb = spawn('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
      let err = ''
      eb.stderr.on('data', (d) => { err += d })
      eb.on('error', () => resolve({ ...meta, lufs: null, truePeakDb: null }))
      eb.on('close', () => {
        // ebur128 imprime une valeur par trame PUIS un résumé final. `.exec()` sans
        // /g renvoie la PREMIÈRE occurrence — c'est-à-dire le silence de l'intro
        // (−70 LUFS). On prend donc la dernière valeur de chaque série.
        const last = (re) => {
          const all = [...err.matchAll(re)]
          return all.length ? Number(all[all.length - 1][1]) : null
        }
        resolve({
          ...meta,
          lufs: last(/I:\s*(-?\d+\.\d+)\s*LUFS/g),
          truePeakDb: last(/True peak:\s*Peak:\s*(-?\d+\.\d+)\s*dBFS/g),
        })
      })
    })
  })
}

/* ------------------------------------------------------------- orchestration */

let queue = Promise.resolve()
const inflight = new Set()

export function renderPlan(plan, { timeoutMs = 120000 } = {}) {
  // file locale bornée : un seul rendu à la fois, les suivants attendent
  if (inflight.size >= 2) {
    return Promise.reject(Object.assign(new Error('serveur audio occupé — réessayez'), { status: 429 }))
  }
  const job = queue.then(() => doRender(plan, timeoutMs))
  queue = job.catch(() => {})
  inflight.add(job)
  // `job.finally(...)` crée une promesse dérivée qui rejette à son tour : sans ce
  // catch, un plan invalide provoquait un unhandledRejection et tuait le serveur
  // audio. La promesse rendue à l'appelant reste, elle, rejetée normalement.
  job.finally(() => inflight.delete(job)).catch(() => {})
  job.catch(() => {})
  return job
}

async function doRender(plan, timeoutMs) {
  const t0 = Date.now()
  const errors = validatePlan(plan)
  if (errors.length) {
    throw Object.assign(new Error('plan invalide'), { status: 400, detail: errors.slice(0, 6) })
  }

  const ids = [...new Set(plan.notes.map((n) => n.sourceId))].sort()
  const paths = new Map()
  const missing = []
  for (const id of ids) {
    const p = resolveSource(id)
    if (p) paths.set(id, p)
    else missing.push(id)
  }
  if (!paths.size) {
    throw Object.assign(new Error('aucune source résoluble pour ce plan'), { status: 422, detail: missing })
  }

  const tDecode = Date.now()
  const sources = new Map()
  for (const [id, path] of paths) sources.set(id, await decodeStereo(path))
  const decodeMs = Date.now() - tDecode

  const tMix = Date.now()
  const mixed = mixPlan(plan, sources)
  const mixMs = Date.now() - tMix

  // plafond true peak : on réduit plutôt que d'écrêter
  let { peak, truePeak, nan } = peakStats(mixed.outL, mixed.outR)
  if (nan) throw Object.assign(new Error('signal non fini (NaN) — rendu refusé'), { status: 500 })
  const ceiling = Math.pow(10, TRUE_PEAK_CEILING_DB / 20)
  // Normalisation au plafond, dans les deux sens : un morceau percussif très
  // creux sortait 10 dB sous les autres et rendait la comparaison A/B malhonnête.
  // Le mastering proprement dit (cible LUFS, limiteur) reste en V2.3.
  const appliedGainDb = truePeak > 0 ? 20 * Math.log10(ceiling / truePeak) : 0
  if (appliedGainDb !== 0) {
    const g = Math.pow(10, appliedGainDb / 20)
    for (let i = 0; i < mixed.outL.length; i++) { mixed.outL[i] *= g; mixed.outR[i] *= g }
    truePeak *= g
    peak *= g
  }

  const exactFrames = Math.round(plan.bars * plan.time.barSeconds * SAMPLE_RATE)
  mkdirSync(RENDERS_DIR, { recursive: true })
  const id = randomBytes(12).toString('hex')
  const wavPath = join(RENDERS_DIR, `${id}.wav`)
  const wav = encodeWav16(mixed.outL, mixed.outR, exactFrames)

  await new Promise((resolve, reject) => {
    const ws = createWriteStream(wavPath)
    const timer = setTimeout(() => reject(Object.assign(new Error('rendu interrompu (timeout)'), { status: 504 })), timeoutMs)
    ws.on('error', reject)
    ws.on('finish', () => { clearTimeout(timer); resolve() })
    ws.end(wav)
  })

  let measured = await verifyWav(wavPath)
  // L'estimation locale du true peak (interpolation linéaire) sous-estime parfois
  // le pic inter-échantillons réel. On corrige donc sur la MESURE ffmpeg, pas sur
  // l'estimation : une passe supplémentaire, bornée, et re-vérifiée.
  let corrections = 0
  while ((measured?.truePeakDb ?? -99) > TRUE_PEAK_CEILING_DB && corrections < 2) {
    const overDb = (measured?.truePeakDb ?? 0) - TRUE_PEAK_CEILING_DB
    const g = Math.pow(10, -(overDb + 0.1) / 20)
    for (let i = 0; i < exactFrames; i++) { mixed.outL[i] *= g; mixed.outR[i] *= g }
    peak *= g
    const patched = encodeWav16(mixed.outL, mixed.outR, exactFrames)
    await new Promise((resolve, reject) => {
      const ws = createWriteStream(wavPath)
      ws.on('error', reject); ws.on('finish', resolve); ws.end(patched)
    })
    measured = await verifyWav(wavPath)
    corrections++
  }

  const verification = {
    durationS: measured?.durationS ?? null,
    sampleRate: measured?.sampleRate ?? null,
    channels: measured?.channels ?? null,
    peakDb: Number((20 * Math.log10(Math.max(peak, 1e-9))).toFixed(2)),
    truePeakDb: measured?.truePeakDb ?? Number((20 * Math.log10(Math.max(truePeak, 1e-9))).toFixed(2)),
    lufs: measured?.lufs ?? null,
    hasNaN: nan,
    clipped: (measured?.truePeakDb ?? -99) > TRUE_PEAK_CEILING_DB + 0.3,
    corrections,
    notes: [],
  }
  if (missing.length) verification.notes.push(`sources introuvables : ${missing.join(', ')}`)
  if (!verification.channels || verification.channels !== 2) verification.notes.push('sortie non stéréo')
  if (verification.clipped) verification.notes.push('true peak au-delà du plafond après correction')
  verification.ok = !verification.hasNaN && !verification.clipped
    && verification.channels === 2 && (verification.durationS ?? 0) > 0.5

  const meta = {
    id,
    createdAt: new Date().toISOString(),
    plan: {
      profileId: plan.profileId, profileVersion: plan.profileVersion, seed: plan.seed,
      bars: plan.bars, notes: plan.notes.length, sources: ids,
      engineVersion: plan.reproducibility?.engineVersion ?? null,
      policyVersion: plan.reproducibility?.policyVersion ?? null,
    },
    file: `${id}.wav`,
    bytes: statSync(wavPath).size,
    verification,
    timing: { decodeMs, mixMs, verifyMs: Date.now() - t0 - decodeMs - mixMs, totalMs: Date.now() - t0 },
    bass: { notes: plan.bassNotes?.length ?? 0, timbre: plan.bassSynth?.timbre ?? null, frames: mixed.bassRendered ?? 0 },
    gainCorrectionDb: Number(appliedGainDb.toFixed(2)),
    limits: Array.isArray(plan.limits) ? plan.limits : [],
  }
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(RENDERS_DIR, `${id}.json`), JSON.stringify(meta, null, 2))

  pruneRenders()
  return meta
}

function pruneRenders() {
  try {
    // Tri par date de modification, PAS par nom : les identifiants sont aléatoires,
    // un tri alphabétique supprimait parfois le rendu qui venait d'être écrit.
    const wavs = readdirSync(RENDERS_DIR)
      .filter((f) => f.endsWith('.wav'))
      .map((f) => ({ f, t: statSync(join(RENDERS_DIR, f)).mtimeMs }))
      .sort((a, b) => a.t - b.t)
      .map((x) => x.f)
    for (const old of wavs.slice(0, Math.max(0, wavs.length - KEEP_RENDERS))) {
      const base = old.replace(/\.wav$/, '')
      rmSync(join(RENDERS_DIR, old), { force: true })
      rmSync(join(RENDERS_DIR, `${base}.json`), { force: true })
    }
  } catch { /* nettoyage best-effort */ }
}

export const renderPath = (id) => (/^[a-f0-9]{24}$/.test(id) ? join(RENDERS_DIR, `${id}.wav`) : null)
export const renderMetaPath = (id) => (/^[a-f0-9]{24}$/.test(id) ? join(RENDERS_DIR, `${id}.json`) : null)
