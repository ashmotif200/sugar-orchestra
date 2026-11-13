import type { Role, Sound, Universe } from '../audio/types'
import { assignRoles, uncoveredSources, type Adaptation } from './roles'
import { mulberry32, hashString, type Rng, pick, jitter, chance } from './rng'
import { SCALE, ROOT_HZ, ELECTRO_ROOTS, AMBIENT_ROOTS, SEGA_ROOTS, semisToRate } from './universes'
import { isMusicallyUsable } from './policy'

export interface FilterSpec {
  type: BiquadFilterType
  freq: number
  q?: number
  sweepTo?: number
}

export interface NoteEvent {
  id: string
  sourceId: string
  role: Role
  start: number
  dur: number
  rate: number
  offset: number
  gain: number
  attack: number
  release: number
  kind: 'signature' | 'support'
  filter?: FilterSpec
  pan?: number
  send?: number
  granular?: { grainMs: number; density: number }
  reverse?: boolean
  /** shown in the reveal as the moment the visitor hears this sound */
  statement: string
}

export interface SignatureRecord {
  sourceId: string
  start: number
  dur: number
  rate: number
  gain: number
}

export interface Score {
  universeId: string
  seed: number
  bpm: number
  bars: number
  durationS: number
  notes: NoteEvent[]
  signatures: SignatureRecord[]
  duckWindows: { start: number; end: number }[]
  roles: Record<Role, string[]>
  adaptations: Adaptation[]
  limits: string[]
  sectionPlan: { name: string; bar0: number; bar1: number }[]
  key: string
  /** true when every selected sound has a raw statement */
  allSourcesRecognizable: boolean
}

export interface PlanInput {
  universe: Universe
  selection: Sound[]
}

const BEAT = (bpm: number) => 60 / bpm

/** Musical position: bar (0-based) + beats inside the bar. */
const at = (bpm: number, bar: number, beats: number) => bar * 4 * BEAT(bpm) + beats * BEAT(bpm)

/**
 * Pick the slice offset. For the raw "signature" statement we must land on the
 * sound's first clear attack: starting at t=0 of a recording that begins with
 * silence would make the statement inaudible even though it is scheduled.
 */
function sliceOffset(s: Sound, rng: Rng, signature = false): number {
  const dur = s.analysis.durationS
  const usable = s.analysis.onsets
    .map((t, i) => ({ t, e: s.analysis.onsetEnergy?.[i] ?? 0 }))
    .filter((x) => x.t < Math.max(0.3, dur - 2.5))
  if (!usable.length) return 0
  if (signature) {
    // le passage cité doit être le geste le plus caractéristique du son, pas
    // la première attaque venue (souvent faible ou isolée)
    const best = usable.reduce((a, b) => (b.e > a.e ? b : a), usable[0])
    return Math.max(0, best.t - 0.02)
  }
  return pick(rng, usable.map((x) => x.t))
}

/** Transpose a pitched source onto a target frequency, keeping the rate sane. */
function rateFor(s: Sound, targetHz: number): number {
  const f0 = s.analysis.f0Hz
  if (!f0 || f0 <= 0) return 1
  let rate = targetHz / f0
  while (rate > 2.1) rate /= 2
  while (rate < 0.45) rate *= 2
  return Math.max(0.45, Math.min(2.1, rate))
}

const degToSemis = (scale: number[], deg: number) => {
  const n = scale.length
  const oct = Math.floor(deg / n)
  return scale[((deg % n) + n) % n] + 12 * oct
}

/* --------------------------------------------------------------------------
   Signature pass — invariant 2 ("chaque son choisi reste reconnaissable")
   Each selected source gets exactly one deliberate, essentially RAW statement:
   rate 1.0 (0 semitone shift), no filter, no reverse, no granular processing,
   natural envelope. These statements are spread over the piece and the beds are
   ducked underneath them so they are actually audible.
   -------------------------------------------------------------------------- */
function addSignatures(
  score: Score,
  selection: Sound[],
  slots: { bar: number; unit: number; durUnits: number }[],
  roleOf: Map<string, Role>,
  timing: { pos: (bar: number, unit: number) => number; unitDur: number },
  rng: Rng,
) {
  const ordered = [...selection].sort((a, b) => {
    // alternate museum sections so two neighbouring statements are never from
    // the same station (more variety, more obvious that the collection differs)
    if (a.section === b.section) return a.code.localeCompare(b.code)
    return a.section.localeCompare(b.section)
  })
  ordered.forEach((s, i) => {
    const slot = slots[i % slots.length]
    const start = Math.max(0, timing.pos(slot.bar, slot.unit) + jitter(rng, 0.006))
    const dur = Math.max(0.6, slot.durUnits * timing.unitDur)
    const offset = sliceOffset(s, rng, true)
    const gain = 0.85
    score.notes.push({
      id: `sig-${s.id}`,
      sourceId: s.id,
      role: roleOf.get(s.id) ?? 'earcandy',
      start,
      dur,
      rate: 1,
      offset,
      gain,
      attack: 0.012,
      release: Math.min(0.35, dur * 0.4),
      kind: 'signature',
      statement: `${s.name} — statement brut`,
    })
    score.signatures.push({ sourceId: s.id, start, dur, rate: 1, gain })
    score.duckWindows.push({ start, end: start + Math.min(dur, 2.4) })
  })
}

/* --------------------------------------------------------------------------
   Universe 1 — Electro Sega (112 BPM, 16 bars, ≈34 s)
   -------------------------------------------------------------------------- */
function composeElectroSega(input: PlanInput, score: Score, rng: Rng) {
  const { universe, selection } = input
  const bpm = universe.bpm
  const roleMap = assignRoles(selection)
  const bass = roleMap.roles.bass[0]
  const mel = roleMap.roles.melody[0]
  const perc = roleMap.roles.rhythm
  const candy = roleMap.roles.earcandy[0]
  const tex = roleMap.roles.texture[0]
  score.roles = Object.fromEntries(
    Object.entries(roleMap.roles).map(([k, v]) => [k, v.map((s) => s.id)]),
  ) as unknown as Record<Role, string[]>
  score.adaptations = roleMap.adaptations
  score.limits = roleMap.limits

  const rootHz = (bar: number) => ROOT_HZ * Math.pow(2, (ELECTRO_ROOTS[bar] ?? 0) / 12)
  const roleOf = new Map<string, Role>()
  if (bass) roleOf.set(bass.id, 'bass')
  if (mel) roleOf.set(mel.id, 'melody')
  perc.forEach((p, i) => { if (!roleOf.has(p.id)) roleOf.set(p.id, i === 0 ? 'rhythm' : 'earcandy') })
  if (candy && !roleOf.has(candy.id)) roleOf.set(candy.id, 'earcandy')
  if (tex && !roleOf.has(tex.id)) roleOf.set(tex.id, 'texture')
  for (const s of uncoveredSources(selection, roleMap)) if (!roleOf.has(s.id)) roleOf.set(s.id, 'earcandy')

  /* --- drums: kick / snare / shaker, all cut from the visitor's own sounds --- */
  const kickSrc = perc[0] ?? bass
  const snareSrc = perc[1] ?? perc[0] ?? candy
  const shakerSrc = perc[2] ?? perc[1] ?? candy

  if (kickSrc) {
    const kickPattern: [number, number][] = [[0, 1], [2, 0.95], [3.75, 0.8]]
    for (let bar = 2; bar < 14; bar++) {
      for (const [pos, v] of kickPattern) {
        if (bar >= 10 && bar <= 13 && pos === 3.75 && chance(rng, 0.4)) continue
        score.notes.push({
          id: `kick-${bar}-${pos}`,
          sourceId: kickSrc.id,
          role: 'rhythm',
          start: at(bpm, bar, pos),
          dur: 0.26,
          rate: kickSrc.analysis.f0Hz ? rateFor(kickSrc, 55) : 1,
          offset: sliceOffset(kickSrc, rng),
          gain: 0.95 * v,
          attack: 0.002,
          release: 0.12,
          kind: 'support',
          filter: { type: 'lowpass', freq: 320, q: 0.9 },
          statement: 'grosse caisse',
        })
      }
    }
  }

  if (snareSrc) {
    for (let bar = 3; bar < 14; bar += 2) {
      for (const pos of [1, 3]) {
        score.notes.push({
          id: `snare-${bar}-${pos}`,
          sourceId: snareSrc.id,
          role: 'rhythm',
          start: at(bpm, bar, pos),
          dur: 0.18,
          rate: 1,
          offset: sliceOffset(snareSrc, rng),
          gain: 0.5,
          attack: 0.002,
          release: 0.1,
          kind: 'support',
          filter: { type: 'highpass', freq: 600 },
          pan: 0.08,
          statement: 'caisse claire',
        })
      }
    }
  }

  if (shakerSrc) {
    for (let bar = 1; bar < 16; bar++) {
      for (let s16 = 0; s16 < 16; s16++) {
        if (bar >= 14 && s16 > 8) continue
        if (bar < 2 && s16 % 2 === 1) continue
        const accent = s16 % 4 === 0 ? 1 : s16 % 2 === 0 ? 0.62 : 0.34
        score.notes.push({
          id: `shk-${bar}-${s16}`,
          sourceId: shakerSrc.id,
          role: 'earcandy',
          start: at(bpm, bar, s16 / 4) + jitter(rng, 0.004),
          dur: 0.09,
          rate: 1,
          offset: sliceOffset(shakerSrc, rng),
          gain: 0.3 * accent,
          attack: 0.001,
          release: 0.04,
          kind: 'support',
          filter: { type: 'highpass', freq: 2200 },
          pan: s16 % 2 === 0 ? -0.3 : 0.3,
          statement: 'shaker',
        })
      }
    }
  }

  /* --- bass: 8th-note ostinato with octave lift --- */
  if (bass) {
    for (let bar = 2; bar < 14; bar++) {
      const root = rootHz(bar)
      const positions: [number, number, number][] = [
        [0, 0, 0.45], [0.5, 0, 0.45], [1.5, 0, 0.45], [2, 0, 0.45],
        [2.5, 12, 0.45], [3, 0, 0.45], [3.5, 0, 0.4],
      ]
      for (const [pos, oct, dur] of positions) {
        score.notes.push({
          id: `bass-${bar}-${pos}`,
          sourceId: bass.id,
          role: 'bass',
          start: at(bpm, bar, pos),
          dur: dur * BEAT(bpm),
          rate: rateFor(bass, root * Math.pow(2, oct / 12)),
          offset: sliceOffset(bass, rng),
          gain: oct ? 0.38 : 0.52,
          attack: 0.006,
          release: 0.09,
          kind: 'support',
          filter: { type: 'lowpass', freq: 900, q: 0.7 },
          statement: 'ligne de basse',
        })
      }
    }
  }

  /* --- melody: two-bar motif per section --- */
  if (mel) {
    const motifs: [number, number, number][][] = [
      [[0, 2, 2], [2, 3, 1], [3, 4, 1], [4, 3, 2], [6, 2, 1], [7, 1, 1]],
      [[0, 4, 2], [2, 3, 1], [3, 2, 1], [4, 3, 2], [6, 4, 1], [7, 3, 1]],
      [[0, 1, 1], [1, 2, 1], [2, 3, 2], [4, 4, 2], [6, 3, 2], [7, 2, 1]],
    ]
    const sections: [number, number, number][] = [[2, 6, 0], [6, 10, 1], [10, 14, 2]]
    for (const [b0, b1, mi] of sections) {
      for (let bar = b0; bar < b1; bar++) {
        const motif = motifs[(mi + (bar - b0)) % motifs.length]
        const root = rootHz(bar)
        for (const [pos8, deg, len8] of motif) {
          const semis = degToSemis(SCALE.pentatonic, deg)
          const target = root * 4 * Math.pow(2, semis / 12)
          score.notes.push({
            id: `mel-${bar}-${pos8}`,
            sourceId: mel.id,
            role: 'melody',
            start: at(bpm, bar, pos8 / 2),
            dur: (len8 / 2) * BEAT(bpm) * 0.92,
            rate: rateFor(mel, target),
            offset: sliceOffset(mel, rng),
            gain: 0.42,
            attack: 0.008,
            release: 0.12,
            kind: 'support',
            filter: { type: 'lowpass', freq: 4200, q: 0.6 },
            pan: jitter(rng, 0.12),
            send: 0.18,
            statement: 'motif mélodique',
          })
        }
      }
    }
  }

  /* --- ear candy: off-beat sparkles + transition sweeps --- */
  if (candy) {
    for (let bar = 3; bar < 14; bar++) {
      if (bar % 2 === 0 && chance(rng, 0.7)) {
        score.notes.push({
          id: `candy-${bar}`,
          sourceId: candy.id,
          role: 'earcandy',
          start: at(bpm, bar, 1.75 + jitter(rng, 0.02)),
          dur: 0.3,
          rate: 1.12,
          offset: sliceOffset(candy, rng),
          gain: 0.22,
          attack: 0.004,
          release: 0.18,
          kind: 'support',
          filter: { type: 'highpass', freq: 3000 },
          pan: 0.35,
          send: 0.45,
          statement: 'éclat',
        })
      }
    }
    for (const bar of [1, 5, 9, 13]) {
      score.notes.push({
        id: `sweep-${bar}`,
        sourceId: candy.id,
        role: 'earcandy',
        start: at(bpm, bar, 3.5),
        dur: 0.8,
        rate: 0.8,
        offset: sliceOffset(candy, rng),
        gain: 0.2,
        attack: 0.1,
        release: 0.3,
        kind: 'support',
        filter: { type: 'bandpass', freq: 500, q: 4, sweepTo: 5200 },
        pan: -0.25,
        send: 0.5,
        statement: 'balayage',
      })
    }
  }

  /* --- texture: intro / outro pad only, so the groove stays clean --- */
  if (tex) {
    for (const [bar, dur, gain] of [[0, 2, 0.3], [14, 2, 0.34]] as [number, number, number][]) {
      score.notes.push({
        id: `tex-${bar}`,
        sourceId: tex.id,
        role: 'texture',
        start: at(bpm, bar, 0),
        dur: dur * 4 * BEAT(bpm),
        rate: 0.75,
        offset: sliceOffset(tex, rng),
        gain,
        attack: 0.9,
        release: 1.6,
        kind: 'support',
        granular: { grainMs: 180, density: 7 },
        filter: { type: 'lowpass', freq: 1400, q: 0.5, sweepTo: 600 },
        statement: 'nappe',
      })
    }
  }
}

/* --------------------------------------------------------------------------
   Universe 2 — Ambient créole (72 BPM, 12 bars, ≈40 s)
   No drums at all: beds, drone, sparse bells. Audibly a different piece even
   with the same collection.
   -------------------------------------------------------------------------- */
function composeAmbient(input: PlanInput, score: Score, rng: Rng) {
  const { universe, selection } = input
  const bpm = universe.bpm
  const roleMap = assignRoles(selection)
  const bass = roleMap.roles.bass[0]
  const mel = roleMap.roles.melody[0]
  const candy = roleMap.roles.earcandy[0]
  const tex = roleMap.roles.texture[0]
  const perc = roleMap.roles.rhythm[0]
  score.roles = Object.fromEntries(
    Object.entries(roleMap.roles).map(([k, v]) => [k, v.map((s) => s.id)]),
  ) as unknown as Record<Role, string[]>
  score.adaptations = roleMap.adaptations
  score.limits = roleMap.limits

  const rootHz = (bar: number) => ROOT_HZ * Math.pow(2, (AMBIENT_ROOTS[bar] ?? 0) / 12)
  const roleOf = new Map<string, Role>()
  if (bass) roleOf.set(bass.id, 'bass')
  if (mel) roleOf.set(mel.id, 'melody')
  if (candy && !roleOf.has(candy.id)) roleOf.set(candy.id, 'earcandy')
  if (tex && !roleOf.has(tex.id)) roleOf.set(tex.id, 'texture')
  if (perc && !roleOf.has(perc.id)) roleOf.set(perc.id, 'rhythm')
  for (const s of uncoveredSources(selection, roleMap)) if (!roleOf.has(s.id)) roleOf.set(s.id, 'texture')

  /* --- two granular beds, one from the texture source, one from the candy --- */
  const bedSources = [tex, candy, bass].filter(Boolean) as Sound[]
  bedSources.slice(0, 2).forEach((src, i) => {
    const start = i * 2.2
    score.notes.push({
      id: `bed-${i}`,
      sourceId: src.id,
      role: 'texture',
      start,
      dur: score.durationS - start - 1.2,
      rate: i === 0 ? 0.85 : 1.05,
      offset: sliceOffset(src, rng),
      gain: i === 0 ? 0.3 : 0.16,
      attack: 3.5,
      release: 3,
      kind: 'support',
      granular: { grainMs: i === 0 ? 320 : 220, density: i === 0 ? 5 : 7 },
      filter: { type: 'lowpass', freq: 700, q: 0.4, sweepTo: 2600 },
      pan: i === 0 ? -0.35 : 0.4,
      statement: 'nappe granulaire',
    })
  })

  /* --- long bass drone, 2 bars per root --- */
  if (bass) {
    for (let bar = 0; bar < 12; bar += 2) {
      score.notes.push({
        id: `drone-${bar}`,
        sourceId: bass.id,
        role: 'bass',
        start: at(bpm, bar, 0),
        dur: 2 * 4 * BEAT(bpm) * 0.98,
        rate: rateFor(bass, rootHz(bar) * 0.5),
        offset: sliceOffset(bass, rng),
        gain: 0.34,
        attack: 1.4,
        release: 1.8,
        kind: 'support',
        filter: { type: 'lowpass', freq: 420, q: 0.6 },
        statement: 'bourdon',
      })
    }
  }

  /* --- heartbeat pulse from a percussive source, very soft --- */
  if (perc) {
    for (let bar = 2; bar < 11; bar += 2) {
      for (const pos of [0, 0.66]) {
        score.notes.push({
          id: `pulse-${bar}-${pos}`,
          sourceId: perc.id,
          role: 'rhythm',
          start: at(bpm, bar, pos),
          dur: 0.5,
          rate: 0.72,
          offset: sliceOffset(perc, rng),
          gain: pos === 0 ? 0.16 : 0.1,
          attack: 0.02,
          release: 0.4,
          kind: 'support',
          filter: { type: 'lowpass', freq: 260, q: 1.2 },
          statement: 'pouls grave',
        })
      }
    }
  }

  /* --- sparse melody, dorian, long tails --- */
  if (mel) {
    const phrases: [number, number, number][][] = [
      [[2, 0, 3], [2.75, 1, 2], [3.5, 2, 4]],
      [[4, 3, 2], [4.75, 2, 3], [5.5, 0, 4]],
      [[6, 4, 3], [6.75, 3, 2], [7.5, 1, 5]],
      [[8, 2, 4], [8.75, 3, 3]],
      [[10, 0, 6]],
    ]
    for (const ph of phrases) {
      for (const [barPos, deg, lenBeats] of ph) {
        const bar = Math.floor(barPos)
        const beats = (barPos - bar) * 4
        const target = rootHz(bar) * 4 * Math.pow(2, degToSemis(SCALE.dorian, deg) / 12)
        score.notes.push({
          id: `mel-${barPos}-${deg}`,
          sourceId: mel.id,
          role: 'melody',
          start: at(bpm, bar, beats),
          dur: lenBeats * BEAT(bpm),
          rate: rateFor(mel, target),
          offset: sliceOffset(mel, rng),
          gain: 0.34,
          attack: 0.12,
          release: Math.min(1.4, lenBeats * BEAT(bpm) * 0.6),
          kind: 'support',
          filter: { type: 'lowpass', freq: 3200, q: 0.5 },
          pan: jitter(rng, 0.25),
          send: 0.55,
          statement: 'phrase de cloche',
        })
      }
    }
  }

  /* --- reversed grains as ear candy --- */
  if (candy) {
    for (const barPos of [1.5, 3.25, 5.5, 7.25, 9.5, 11]) {
      const bar = Math.floor(barPos)
      score.notes.push({
        id: `rev-${barPos}`,
        sourceId: candy.id,
        role: 'earcandy',
        start: at(bpm, bar, (barPos - bar) * 4),
        dur: 1.6,
        rate: 1,
        offset: sliceOffset(candy, rng),
        gain: 0.13,
        attack: 0.5,
        release: 0.9,
        kind: 'support',
        reverse: true,
        filter: { type: 'highpass', freq: 1200 },
        pan: jitter(rng, 0.4),
        send: 0.6,
        statement: 'grain inversé',
      })
    }
  }
}

/* --------------------------------------------------------------------------
   Univers 2 — Sega traditionnel (6/8, 126 à la noire, 24 mesures, ≈34 s)
   Tambour de ravanne, triangle, appel et réponse. Pas de traitement
   électronique : c'est le caractère acoustique qui distingue ce morceau de
   l'Electro Sega, à collection identique.
   -------------------------------------------------------------------------- */
function composeSegaTrad(input: PlanInput, score: Score, rng: Rng) {
  const { universe, selection } = input
  const bpm = universe.bpm
  const barSec = (6 * 60) / (bpm * 2) // six croches, noire = 126
  const beat = barSec / 6 // une croche
  const at8 = (bar: number, eighth: number) => bar * barSec + eighth * beat
  score.durationS = universe.bars * barSec

  const roleMap = assignRoles(selection)
  const bass = roleMap.roles.bass[0]
  const mel = roleMap.roles.melody[0]
  const perc = roleMap.roles.rhythm
  const candy = roleMap.roles.earcandy[0]
  const tex = roleMap.roles.texture[0]
  score.roles = Object.fromEntries(
    Object.entries(roleMap.roles).map(([k, v]) => [k, v.map((s) => s.id)]),
  ) as unknown as Record<Role, string[]>
  score.adaptations = roleMap.adaptations
  score.limits = roleMap.limits

  const rootHz = (bar: number) => ROOT_HZ * Math.pow(2, (SEGA_ROOTS[bar] ?? 0) / 12)
  const roleOf = new Map<string, Role>()
  if (bass) roleOf.set(bass.id, 'bass')
  if (mel) roleOf.set(mel.id, 'melody')
  perc.forEach((p, i) => { if (!roleOf.has(p.id)) roleOf.set(p.id, i === 0 ? 'rhythm' : 'earcandy') })
  if (candy && !roleOf.has(candy.id)) roleOf.set(candy.id, 'earcandy')
  if (tex && !roleOf.has(tex.id)) roleOf.set(tex.id, 'texture')
  for (const s of uncoveredSources(selection, roleMap)) if (!roleOf.has(s.id)) roleOf.set(s.id, 'earcandy')

  const push = (n: Omit<NoteEvent, 'id'> & { id: string }) => score.notes.push(n)

  const tambour = perc[0] ?? bass
  const triangle = candy ?? perc[1] ?? tambour
  const second = perc[1] ?? perc[0]

  /* ravanne : cellules 6/8, accents sur les temps forts */
  if (tambour) {
    const cells: [number, number][] = [
      [0, 1], [1.5, 0.55], [3, 0.9], [4.5, 0.6],
    ]
    for (let bar = 1; bar < universe.bars - 1; bar++) {
      for (const [pos, vel] of cells) {
        const fill = bar % 8 === 7 && pos >= 3
        if (fill && chance(rng, 0.45)) continue
        push({
          id: `tam-${bar}-${pos}`,
          sourceId: tambour.id,
          role: 'rhythm',
          start: at8(bar, pos) + jitter(rng, 0.005),
          dur: beat * 0.85,
          rate: tambour.analysis.f0Hz ? rateFor(tambour, 98) : 1,
          offset: sliceOffset(tambour, rng),
          gain: 0.72 * vel,
          attack: 0.002,
          release: beat * 0.5,
          kind: 'support',
          filter: { type: 'lowpass', freq: 2600, q: 0.6 },
          pan: -0.06,
          statement: 'tambour ravanne',
        })
      }
    }
  }

  /* second tambour / réponse, une mesure sur deux */
  if (second && second.id !== tambour?.id) {
    for (let bar = 2; bar < universe.bars - 2; bar += 2) {
      for (const pos of [2.5, 5]) {
        push({
          id: `rep-${bar}-${pos}`,
          sourceId: second.id,
          role: 'rhythm',
          start: at8(bar, pos),
          dur: beat * 0.6,
          rate: 1,
          offset: sliceOffset(second, rng),
          gain: 0.34,
          attack: 0.002,
          release: beat * 0.3,
          kind: 'support',
          filter: { type: 'bandpass', freq: 1200, q: 1.1 },
          pan: 0.22,
          statement: 'réponse',
        })
      }
    }
  }

  /* triangle : croches, accent sur les temps */
  if (triangle) {
    for (let bar = 2; bar < universe.bars - 2; bar++) {
      for (let e = 0; e < 6; e++) {
        const accent = e === 0 || e === 3 ? 1 : e % 2 === 0 ? 0.55 : 0.32
        push({
          id: `tri-${bar}-${e}`,
          sourceId: triangle.id,
          role: 'earcandy',
          start: at8(bar, e) + jitter(rng, 0.004),
          dur: beat * 0.5,
          rate: 1.18,
          offset: sliceOffset(triangle, rng),
          gain: 0.16 * accent,
          attack: 0.001,
          release: beat * 0.25,
          kind: 'support',
          filter: { type: 'highpass', freq: 3400 },
          pan: e % 2 ? 0.3 : -0.3,
          statement: 'triangle',
        })
      }
    }
  }

  /* basse : deux pulsations par mesure + broderie */
  if (bass) {
    for (let bar = 0; bar < universe.bars; bar++) {
      const root = rootHz(bar)
      const cells: [number, number, number][] = [
        [0, 0, 0.9], [3, 0, 0.9], [5.5, 12, 0.45],
      ]
      for (const [pos, oct, dur] of cells) {
        if (bar < 2 && pos === 5.5) continue
        push({
          id: `b-${bar}-${pos}`,
          sourceId: bass.id,
          role: 'bass',
          start: at8(bar, pos),
          dur: dur * beat,
          rate: rateFor(bass, root * Math.pow(2, oct / 12)),
          offset: sliceOffset(bass, rng),
          gain: oct ? 0.3 : 0.44,
          attack: 0.008,
          release: beat * 0.35,
          kind: 'support',
          filter: { type: 'lowpass', freq: 520, q: 0.7 },
          statement: 'basse',
        })
      }
    }
  }

  /* mélodie : appel de deux mesures, réponse de deux mesures */
  if (mel) {
    const call: [number, number, number][] = [[0, 2, 1], [1, 3, 1], [2.5, 2, 2], [5, 1, 1]]
    const answer: [number, number, number][] = [[0, 4, 1], [1.5, 3, 1], [3, 2, 2], [5, 0, 1]]
    for (let pair = 1; pair < universe.bars / 2 - 1; pair++) {
      const bar = pair * 2
      const phrase = pair % 2 === 0 ? call : answer
      for (const [pos, deg, lenE] of phrase) {
        const semis = degToSemis(SCALE.pentatonic, deg)
        const target = rootHz(bar) * 4 * Math.pow(2, semis / 12)
        push({
          id: `m-${bar}-${pos}-${deg}`,
          sourceId: mel.id,
          role: 'melody',
          start: at8(bar, pos),
          dur: lenE * beat * 0.95,
          rate: rateFor(mel, target),
          offset: sliceOffset(mel, rng),
          gain: 0.4,
          attack: 0.01,
          release: beat * 0.5,
          kind: 'support',
          filter: { type: 'lowpass', freq: 5200, q: 0.5 },
          pan: jitter(rng, 0.1),
          send: 0.14,
          statement: 'chant',
        })
      }
    }
  }

  /* nappe d'ouverture et de sortie, discrète */
  if (tex) {
    for (const [bar, gain] of [[0, 0.22], [universe.bars - 2, 0.24]] as [number, number][]) {
      push({
        id: `t-${bar}`,
        sourceId: tex.id,
        role: 'texture',
        start: at8(bar, 0),
        dur: barSec * 2,
        rate: 0.9,
        offset: sliceOffset(tex, rng),
        gain,
        attack: barSec * 0.4,
        release: barSec * 0.7,
        kind: 'support',
        granular: { grainMs: 220, density: 5 },
        filter: { type: 'lowpass', freq: 1800, q: 0.4, sweepTo: 900 },
        statement: 'nappe',
      })
    }
  }
}

/* --------------------------------------------------------------------------
   Entry point
   -------------------------------------------------------------------------- */
export class CompositionRefused extends Error {
  constructor(public reason: 'no-usable-sound' | 'unavailable-universe', message: string) {
    super(message)
  }
}

export function buildScore(input: PlanInput): Score {
  const { universe } = input
  if (!universe.available) throw new CompositionRefused('unavailable-universe', `univers ${universe.name} non implémenté`)
  // Garde-fou : un son sensible ou non musical ne peut jamais entrer dans une
  // pièce, même si l'état de session a été bricolé.
  // Politique musicale v2 : seule l'absence de fichier audio exclut un son.
  // `sensitive` et `not_musical` restent des métadonnées, plus des interdits.
  const usable = input.selection.filter((s) => isMusicallyUsable(s))
  if (!usable.length) throw new CompositionRefused('no-usable-sound', 'aucun son utilisable dans la sélection')
  // order-independent: the same collection always yields the same piece, however
  // the visitor happened to click it together
  const selection = [...usable].sort((a, b) => a.id.localeCompare(b.id))
  const bpm = universe.bpm
  const seed = hashString(universe.id + '|' + selection.map((s) => s.id).sort().join(','))
  const rng = mulberry32(seed)
  const barSec = 4 * BEAT(bpm)
  const durationS = universe.bars * barSec

  const score: Score = {
    universeId: universe.id,
    seed,
    bpm,
    bars: universe.bars,
    durationS,
    notes: [],
    signatures: [],
    duckWindows: [],
    roles: {} as Record<Role, string[]>,
    adaptations: [],
    limits: [],
    sectionPlan: [],
    key: 'Ré mineur',
    allSourcesRecognizable: false,
  }

  // the composers must receive the SORTED selection, otherwise role ordering
  // (and therefore the RNG consumption) depends on click order
  const sortedInput: PlanInput = { universe, selection }
  if (universe.id === 'sega-trad') composeSegaTrad(sortedInput, score, rng)
  else if (universe.id === 'ambient-creole') composeAmbient(sortedInput, score, rng)
  else composeElectroSega(sortedInput, score, rng)

  // signature slots: spread across the body of the piece, avoiding the first
  // and last bar so nothing is buried in the intro or the fade
  let timing: { pos: (bar: number, unit: number) => number; unitDur: number }
  let slots: { bar: number; unit: number; durUnits: number }[]
  if (universe.id === 'sega-trad') {
    const barSec = (6 * 60) / (bpm * 2)
    const eighth = barSec / 6
    timing = { pos: (bar, unit) => bar * barSec + unit * eighth, unitDur: eighth }
    slots = [
      { bar: 3, unit: 0, durUnits: 3 },
      { bar: 6, unit: 3, durUnits: 3 },
      { bar: 9, unit: 0, durUnits: 3 },
      { bar: 12, unit: 3, durUnits: 3 },
      { bar: 15, unit: 0, durUnits: 3 },
      { bar: 18, unit: 3, durUnits: 3 },
    ]
  } else if (universe.id === 'ambient-creole') {
    timing = { pos: (bar, unit) => at(bpm, bar, unit), unitDur: BEAT(bpm) }
    slots = [
      { bar: 2, unit: 0, durUnits: 4 },
      { bar: 4, unit: 1, durUnits: 4 },
      { bar: 6, unit: 0, durUnits: 4 },
      { bar: 7, unit: 2, durUnits: 4 },
      { bar: 9, unit: 0, durUnits: 4 },
      { bar: 10, unit: 2, durUnits: 4 },
    ]
  } else {
    timing = { pos: (bar, unit) => at(bpm, bar, unit), unitDur: BEAT(bpm) }
    slots = [
      { bar: 3, unit: 0, durUnits: 2 },
      { bar: 5, unit: 2, durUnits: 2 },
      { bar: 7, unit: 0, durUnits: 2 },
      { bar: 9, unit: 2, durUnits: 2 },
      { bar: 11, unit: 0, durUnits: 2 },
      { bar: 13, unit: 2, durUnits: 2 },
    ]
  }

  const roleOf = new Map<string, Role>()
  for (const [role, ids] of Object.entries(score.roles)) for (const id of ids) if (!roleOf.has(id)) roleOf.set(id, role as Role)
  addSignatures(score, selection, slots, roleOf, timing, rng)

  // final structural bookkeeping
  score.notes.sort((a, b) => a.start - b.start)
  const sigIds = new Set(score.signatures.map((s) => s.sourceId))
  score.allSourcesRecognizable = selection.every((s) => sigIds.has(s.id))

  score.sectionPlan =
    universe.id === 'sega-trad'
      ? [
          { name: 'Entrée du tambour', bar0: 0, bar1: 4 },
          { name: 'Appel', bar0: 4, bar1: 10 },
          { name: 'Réponse', bar0: 10, bar1: 16 },
          { name: 'Tous ensemble', bar0: 16, bar1: 21 },
          { name: 'Sortie', bar0: 21, bar1: 24 },
        ]
      : universe.id === 'ambient-creole'
      ? [
          { name: 'Ouverture', bar0: 0, bar1: 2 },
          { name: 'Nappes', bar0: 2, bar1: 6 },
          { name: 'Cloches', bar0: 6, bar1: 10 },
          { name: 'Retour au calme', bar0: 10, bar1: 12 },
        ]
      : [
          { name: 'Montée', bar0: 0, bar1: 2 },
          { name: 'Groove', bar0: 2, bar1: 6 },
          { name: 'Ouverture', bar0: 6, bar1: 10 },
          { name: 'Groove final', bar0: 10, bar1: 14 },
          { name: 'Sortie', bar0: 14, bar1: 16 },
        ]
  return score
}

export { semisToRate, rateFor, degToSemis }
