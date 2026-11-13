// Generates the 12-sound DEMO SUBSTITUTE set.
//
// The museum's 40 WAV files were NOT delivered with the briefing (verified: no
// Inventaire.csv, no zip anywhere on the machine). So that the engine, the
// invariants and the full visitor journey can be built and tested for real, this
// script synthesises a placeholder set with the same shape as the real one:
// 20 s, mono, 32 kHz, 16-bit — one file per station role.
//
// These are NOT museum sounds. Every catalogue entry carries
// status:"placeholder-synth" and the UI displays a DÉMO badge. Running
// `npm run import-assets` with the real Inventaire.csv + zip replaces this set.
import { writeWav16 } from './lib/wav.mjs'
import { analyzeSamples, suggestRoles } from './lib/analyze.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const OUT = join(ROOT, 'public', 'audio')
const SR = 32000
const DUR = 20

/* ---------- tiny deterministic synth ---------- */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}
const buf = () => new Float32Array(SR * DUR)
const NS = (t) => Math.floor(t * SR)
const clamp = (v) => Math.max(-1, Math.min(1, v))

function env(i, start, dur, a = 0.005, d = 0.05, s = 0.7, r = 0.3) {
  const rel = i - start
  if (rel < 0 || rel > dur) return 0
  if (rel < a) return rel / a
  if (rel > dur - r) return Math.max(0, (dur - rel) / r) * s
  const dt = rel - a
  return s + (1 - s) * Math.exp(-dt / Math.max(d, 0.001))
}

const sines = (b, start, dur, freq, amp, opts = {}) => {
  const { a = 0.004, d = 0.08, s = 0.6, r = 0.15, harm = [1], detune = 0, glide = 0 } = opts
  const i0 = NS(start), n = NS(dur)
  for (let k = 0; k < n; k++) {
    const idx = i0 + k
    if (idx >= b.length) break
    const t = k / SR
    const g = env(idx, i0, n, a, d, s, r) * amp
    const f = freq * (1 + glide * (t / Math.max(dur, 1e-6)))
    let v = 0
    for (let h = 0; h < harm.length; h++) v += harm[h] * Math.sin(2 * Math.PI * f * (h + 1) * t)
    if (detune) v += 0.5 * Math.sin(2 * Math.PI * f * 1.002 * t)
    b[idx] += v * g
  }
}

const fm = (b, start, dur, carrier, ratio, index, amp, opts = {}) => {
  const { a = 0.002, d = 0.35, s = 0.05, r = 0.5, indexDecay = 0.25 } = opts
  const i0 = NS(start), n = NS(dur)
  for (let k = 0; k < n; k++) {
    const idx = i0 + k
    if (idx >= b.length) break
    const t = k / SR
    const tRel = t
    const mod = Math.sin(2 * Math.PI * carrier * ratio * t) * index * Math.exp(-tRel / indexDecay)
    const g = env(idx, i0, n, a, d, s, r) * amp
    b[idx] += Math.sin(2 * Math.PI * carrier * t + mod) * g
  }
}

const noiseBurst = (b, start, dur, amp, opts = {}) => {
  const { lp = 0.5, hp = 0, a = 0.001, d = 0.05, s = 0.1, release = 0.08, seed = 7 } = opts
  const rand = rng(seed + Math.floor(start * 1000))
  const i0 = NS(start), n = NS(dur)
  let y = 0, yh = 0, prev = 0
  for (let k = 0; k < n; k++) {
    const idx = i0 + k
    if (idx >= b.length) break
    const w = rand() * 2 - 1
    y += lp * (w - y) // one-pole low-pass
    yh = hp > 0 ? hp * (yh + y - prev) : y // crude high-pass
    prev = y
    b[idx] += (hp > 0 ? yh : y) * env(idx, i0, n, a, d, s, release) * amp
  }
}

const pulseBed = (b, freq, amp, rate, depth) => {
  for (let i = 0; i < b.length; i++) {
    const t = i / SR
    const g = 1 - depth + depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * rate * t))
    b[i] *= g
  }
}

function finish(b, peak = 0.72) {
  // gentle fade in/out to avoid clicks, then peak-normalise
  const f = NS(0.03)
  for (let i = 0; i < f; i++) { b[i] *= i / f; b[b.length - 1 - i] *= i / f }
  let p = 0
  for (let i = 0; i < b.length; i++) p = Math.max(p, Math.abs(b[i]))
  const g = p > 0 ? peak / p : 1
  for (let i = 0; i < b.length; i++) b[i] = clamp(b[i] * g)
  return b
}

/* ---------- the 12 sounds ---------- */
const NS_PENTA = [293.66, 349.23, 392.0, 440.0, 523.25] // D4 F4 G4 A4 C5

const recipes = {
  // 1. Low tonal drum-body tone (D2) — bass candidate
  '1': () => {
    const b = buf()
    for (let bar = 0; bar < 10; bar++) {
      const t = bar * 2
      sines(b, t, 1.5, 73.42, 0.5, { a: 0.01, d: 0.25, s: 0.5, r: 0.5, harm: [1, 0.28, 0.12], glide: 0.02 })
      noiseBurst(b, t, 0.25, 0.25, { lp: 0.08, a: 0.001, d: 0.04, s: 0.05, r: 0.1, seed: 11 + bar })
    }
    pulseBed(b, 73.42, 0.4, 0.5, 0.25)
    return finish(b)
  },
  // 2. Deep airy drone (A1 + breath) — bass / texture
  '2': () => {
    const b = buf()
    sines(b, 0, DUR, 55, 0.45, { a: 1.2, d: 3, s: 0.9, r: 2.5, harm: [1, 0.2] })
    sines(b, 0, DUR, 82.5, 0.16, { a: 2, d: 3, s: 0.8, r: 3, harm: [1, 0.1] })
    noiseBurst(b, 0, DUR, 0.1, { lp: 0.02, a: 1.5, d: 4, s: 0.9, r: 3, seed: 31 })
    pulseBed(b, 55, 0.3, 0.12, 0.35)
    return finish(b, 0.66)
  },
  // 3. Sung pentatonic phrase — melody
  '3': () => {
    const b = buf()
    const phrase = [0, 2, 3, 2, 1, 0, null, 1, 3, 4, 3, 2, null, null]
    for (let rep = 0; rep < 3; rep++) {
      let t = rep * 6.5 + 0.4
      for (const step of phrase) {
        if (step === null) { t += 0.42; continue }
        const f = NS_PENTA[step]
        fm(b, t, 0.85, f, 2, 1.4, 0.32, { a: 0.06, d: 0.3, s: 0.35, r: 0.45, indexDecay: 0.18 })
        sines(b, t, 0.8, f, 0.16, { a: 0.06, d: 0.2, s: 0.4, r: 0.4, harm: [1, 0.3, 0.12] })
        t += 0.42
      }
    }
    return finish(b, 0.68)
  },
  // 4. Bell / quarter chime — melody or ear candy
  '4': () => {
    const b = buf()
    const notes = [587.33, 698.46, 880.0, 1046.5]
    for (let k = 0; k < 7; k++) {
      const t = 0.6 + k * 2.7
      const f = notes[k % notes.length]
      fm(b, t, 3.2, f, 3.5, 3.2, 0.4, { a: 0.002, d: 0.9, s: 0.02, r: 1.6, indexDecay: 0.5 })
      sines(b, t, 2.5, f * 2, 0.09, { a: 0.002, d: 0.5, s: 0.02, r: 1.4 })
    }
    return finish(b, 0.62)
  },
  // 5. Ravanne-like hand drum, sega cell — rhythm
  '5': () => {
    const b = buf()
    const pattern = [0, 0.5, 0.75, 1.0, 1.5, 1.75, 2.0, 2.5, 2.75, 3.0, 3.5, 3.68]
    for (let bar = 0; bar < 5; bar++) {
      for (let p = 0; p < pattern.length; p++) {
        const t = bar * 4 + pattern[p]
        const accent = p === 0 ? 1 : 0.62
        sines(b, t, 0.3, 150, 0.5 * accent, { a: 0.001, d: 0.05, s: 0.1, r: 0.12, glide: -0.35, harm: [1, 0.3] })
        noiseBurst(b, t, 0.12, 0.3 * accent, { lp: 0.35, a: 0.001, d: 0.02, s: 0.02, r: 0.05, seed: 5 + bar * 13 + p })
      }
    }
    return finish(b, 0.75)
  },
  // 6. Seed shaker, 16ths — rhythm
  '6': () => {
    const b = buf()
    for (let step = 0; step < 112; step++) {
      const t = step * 0.178
      if (step % 8 === 5 || step % 8 === 7) continue
      const amp = step % 2 === 0 ? 0.34 : 0.2
      noiseBurst(b, t, 0.09, amp, { lp: 0.9, hp: 0.55, a: 0.001, d: 0.012, s: 0.02, r: 0.03, seed: 71 + step })
    }
    return finish(b, 0.6)
  },
  // 7. Inharmonic copper-pot strike — rhythm / ear candy
  '7': () => {
    const b = buf()
    for (let k = 0; k < 9; k++) {
      const t = 0.3 + k * 2.2
      fm(b, t, 2.4, 196, 1.414, 5.5, 0.34, { a: 0.001, d: 0.35, s: 0.02, r: 1.2, indexDecay: 0.22 })
      fm(b, t, 1.8, 196, 2.31, 2.5, 0.18, { a: 0.001, d: 0.25, s: 0.02, r: 0.9, indexDecay: 0.3 })
      noiseBurst(b, t, 0.08, 0.12, { lp: 0.6, hp: 0.4, a: 0.001, d: 0.01, s: 0.01, r: 0.03, seed: 17 + k })
    }
    return finish(b, 0.66)
  },
  // 8. Sugar-crystal tinkles — ear candy
  '8': () => {
    const b = buf()
    const r = rng(4242)
    for (let k = 0; k < 70; k++) {
      const t = 0.2 + k * 0.27 + r() * 0.1
      const f = 1800 + Math.floor(r() * 8) * 420
      sines(b, t, 0.5 + r() * 0.5, f, 0.10 + r() * 0.09, { a: 0.001, d: 0.06, s: 0.02, r: 0.25, harm: [1, 0.2] })
    }
    return finish(b, 0.55)
  },
  // 9. Wind through cane, band-passed swells — ear candy / texture
  '9': () => {
    const b = buf()
    const r = rng(909)
    let y1 = 0, y2 = 0
    for (let i = 0; i < b.length; i++) {
      const t = i / SR
      const w = r() * 2 - 1
      const cut = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.09 * t))
      y1 += cut * (w - y1)
      y2 += 0.02 * (y1 - y2)
      const swell = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 0.0625 * t - 1.2), 1.6)
      b[i] = (y1 - y2) * swell
    }
    return finish(b, 0.6)
  },
  // 10. Chimney rumble + crackle — texture
  '10': () => {
    const b = buf()
    let y = 0, y2 = 0
    const r = rng(1234)
    for (let i = 0; i < b.length; i++) {
      const w = r() * 2 - 1
      y += 0.012 * (w - y)
      y2 += 0.05 * (y - y2)
      b[i] = y2 * 6
    }
    for (let k = 0; k < 26; k++) {
      noiseBurst(b, 0.4 + k * 0.75 + r() * 0.4, 0.05, 0.18, { lp: 0.5, a: 0.001, d: 0.008, s: 0.01, r: 0.02, seed: 300 + k })
    }
    pulseBed(b, 60, 0.3, 0.08, 0.3)
    return finish(b, 0.62)
  },
  // 11. Steam hiss with whistle — texture
  '11': () => {
    const b = buf()
    const r = rng(555)
    let y = 0, prev = 0
    for (let i = 0; i < b.length; i++) {
      const t = i / SR
      const w = r() * 2 - 1
      y += 0.4 * (w - y)
      const hp = y - prev; prev = y
      const surge = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 0.11 * t), 2)
      b[i] = hp * surge * 0.8 + 0.05 * Math.sin(2 * Math.PI * 2100 * t) * surge
    }
    return finish(b, 0.55)
  },
  // 12. Market murmur — texture
  '12': () => {
    const b = buf()
    const r = rng(8080)
    let y = 0
    for (let i = 0; i < b.length; i++) {
      const w = r() * 2 - 1
      y += 0.09 * (w - y)
      const t = i / SR
      b[i] = y * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.07 * t))
    }
    for (let k = 0; k < 40; k++) {
      const t = r() * (DUR - 1)
      const f = 180 + r() * 220
      fm(b, t, 0.9 + r(), f, 1, 0.8, 0.09 + r() * 0.05, { a: 0.08, d: 0.3, s: 0.3, r: 0.5, indexDecay: 0.2 })
    }
    return finish(b, 0.58)
  },
}

/* ---------- catalogue ---------- */
const SECTIONS = [
  { id: 'origines', order: 1, name: "Origines de l'île", short: 'Origines' },
  { id: 'ages', order: 2, name: 'Sucre à travers les âges', short: 'Âges' },
  { id: 'cheminee', order: 3, name: "À l'ombre de la cheminée", short: 'Cheminée' },
  { id: 'histoire', order: 4, name: 'Une histoire façonnée par le sucre', short: 'Histoire' },
  { id: 'canne', order: 5, name: 'La canne', short: 'Canne' },
  { id: 'canne-au-sucre', order: 6, name: 'De la canne au sucre', short: 'Transformation' },
  { id: 'energie', order: 7, name: "L'énergie de la canne", short: 'Énergie' },
  { id: 'jus-au-sucre', order: 8, name: 'Du jus au sucre', short: 'Jus' },
]

const DEMO = [
  { code: 'DEMO-01', name: 'Tambour grave', section: 'canne', seed: '1', roles: ['bass', 'rhythm'] },
  { code: 'DEMO-02', name: 'Souffle de chaudière', section: 'energie', seed: '2', roles: ['texture', 'bass'] },
  { code: 'DEMO-03', name: 'Chant des coupeurs', section: 'canne', seed: '3', roles: ['melody'] },
  { code: 'DEMO-04', name: 'Cloche de quart', section: 'ages', seed: '4', roles: ['melody', 'earcandy'] },
  { code: 'DEMO-05', name: 'Ravanne', section: 'canne-au-sucre', seed: '5', roles: ['rhythm'] },
  { code: 'DEMO-06', name: 'Calebasse', section: 'origines', seed: '6', roles: ['rhythm', 'earcandy'] },
  { code: 'DEMO-07', name: 'Marmite de cuivre', section: 'jus-au-sucre', seed: '7', roles: ['rhythm', 'earcandy'] },
  { code: 'DEMO-08', name: 'Cristaux de sucre', section: 'jus-au-sucre', seed: '8', roles: ['earcandy'] },
  { code: 'DEMO-09', name: 'Vent dans les cannes', section: 'canne', seed: '9', roles: ['texture', 'earcandy'] },
  { code: 'DEMO-10', name: 'Rumeur de la cheminée', section: 'cheminee', seed: '10', roles: ['texture'] },
  { code: 'DEMO-11', name: 'Vapeur', section: 'energie', seed: '11', roles: ['texture', 'earcandy'] },
  { code: 'DEMO-12', name: 'Murmure du marché', section: 'histoire', seed: '12', roles: ['texture', 'earcandy'] },
]

mkdirSync(OUT, { recursive: true })

const sounds = []
for (const d of DEMO) {
  const samples = recipes[d.seed]()
  const file = `${d.code}.wav`
  writeFileSync(join(OUT, file), writeWav16(samples, SR))
  const analysis = analyzeSamples(samples, SR)
  const { picked, scores } = suggestRoles(analysis)
  sounds.push({
    id: d.code.toLowerCase(),
    code: d.code,
    name: d.name,
    file: `audio/${file}`,
    section: d.section,
    roles: d.roles,
    suggestedRoles: picked,
    roleScores: scores,
    credits: 'Son de substitution synthétisé (démo technique)',
    license: 'Synthèse originale — aucune source tierce. À remplacer par les sons du musée.',
    status: 'placeholder-synth',
    anecdote: {
      text: "Anecdote à valider par l'équipe du musée — texte volontairement neutre.",
      status: 'placeholder',
    },
    analysis,
  })
  console.log(`  ${d.code.padEnd(8)} ${d.name.padEnd(24)} roles=${picked.join('/')} f0=${analysis.f0Hz ?? '-'}Hz centroid=${analysis.centroidHz}Hz onsets=${analysis.onsetRate}/s`)
}

const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'placeholder-synth',
  disclaimer:
    "Jeu de sons de SUBSTITUTION synthétisé pour la démo technique. Les 40 WAV du musée n'ont pas été livrés avec le briefing. Lancer `npm run import-assets -- <zip> <Inventaire.csv>` pour les remplacer.",
  limits: { minSelected: 4, maxSelected: 6 },
  sections: SECTIONS,
  sounds,
}
writeFileSync(join(ROOT, 'src', 'data', 'catalog.json'), JSON.stringify(catalog, null, 2))
console.log(`\n12 placeholders written to public/audio/ ; catalog -> src/data/catalog.json`)
