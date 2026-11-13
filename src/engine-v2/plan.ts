/**
 * Module B — Composition Engine.
 *
 * Déterministe, sans audio, sans navigateur, sans DSP. Entrée : profil + seed +
 * sons. Sortie : ScorePlan inspectable.
 *
 * Correction structurelle par rapport à V1 :
 *   - le temps est un triplet (barSeconds, beatsPerBar, subdivision), pas un BPM ;
 *   - chaque note porte writtenMidi ET realizedHz, et le taux de lecture est
 *     calculé pour tenir la note écrite — jamais de repli d'octave silencieux ;
 *   - une note dont la transposition dépasserait la limite du profil est refusée,
 *     pas transposée de force.
 */
import type { Sound } from '../audio/types'
import { buildCapabilities, assignRoles, CAPABILITY_MATRIX_SOURCE } from './capabilities'
import type {
  MusicalProfile, PlannedNote, PlannedSection, Role, ScorePlan, SectionKind, SoundCapability,
} from './types'

export const ENGINE_VERSION = 'v2.0.0'
const POLICY_VERSION = 2
const MAX_TRANSPOSITION_SEMITONES = 7
const PITCH_TOLERANCE_CENTS = 10

/* ----------------------------------------------------------------- PRNG */
/** mulberry32 — petit, déterministe, indépendant du moteur V1. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440)

/**
 * Choisit la note écrite la plus proche de la hauteur réelle de la source, parmi
 * les degrés de la gamme du profil, dans la limite de transposition.
 *
 * Viser une racine fixe obligeait à transposer de 12 à 20 demi-tons : toutes les
 * notes étaient alors refusées et le morceau perdait tout contenu tonal. On part
 * donc de ce que le son sait déjà faire.
 */
function nearestScalePitch(f0: number, rootMidi: number, scale: number[],
  maxSemis: number, preferBelow = false): number | null {
  const f0midi = hzToMidi(f0)
  let best: number | null = null
  let bestDist = Infinity
  for (let oct = -2; oct <= 2; oct++) {
    for (const deg of scale) {
      const midi = rootMidi + deg + 12 * oct
      if (preferBelow && midi > f0midi + 0.5) continue
      const dist = Math.abs(midi - f0midi)
      if (dist > maxSemis) continue
      if (dist < bestDist) { bestDist = dist; best = midi }
    }
  }
  return best
}
const centsBetween = (hzA: number, hzB: number) => Math.abs(1200 * Math.log2(hzA / hzB))

/* ------------------------------------------------------------ structure */

function buildForm(profile: MusicalProfile, rand: () => number): PlannedSection[] {
  const { minBars, maxBars } = profile.duration
  const bars = minBars + Math.floor(rand() * (maxBars - minBars + 1))
  const intro = Math.max(2, Math.round(bars * 0.12))
  const outro = Math.max(2, Math.round(bars * 0.1))
  const breakBars = profile.groove.motifVariation > 0.4 ? Math.max(2, Math.round(bars * 0.1)) : 0
  const build = Math.max(2, Math.round(bars * 0.12))
  const main = Math.max(4, bars - intro - outro - breakBars - build)

  const sections: PlannedSection[] = []
  let at = 0
  const push = (kind: SectionKind, len: number, roles: Role[]) => {
    sections.push({ kind, startBar: at, bars: len, activeRoles: roles })
    at += len
  }
  const base: Role[] = ['rhythm', 'texture']
  push('intro', intro, profile.id === 'sega-trad' ? ['melody', 'texture'] : ['texture', 'earcandy'])
  push('build', build, [...base, 'earcandy'])
  push('main', main, ['bass', 'melody', 'rhythm', 'texture', 'earcandy'])
  if (breakBars) push('break', breakBars, ['texture', 'melody'])
  push('outro', outro, ['texture', 'melody', 'rhythm'])

  // les bars effectivement produits suivent les sections
  return sections
}

/* --------------------------------------------------------------- cellules */

/** Vocabulaire rythmique : positions (en subdivisions) dans une mesure. */
const CELLS: Record<SectionKind, number[][]> = {
  intro: [[0], [0, 3], [0, 6]],
  build: [[0, 3], [0, 2, 4], [0, 3, 6], [0, 2, 3, 5]],
  main: [[0, 2, 3, 5], [0, 1, 3, 4, 6], [0, 3, 4, 6], [0, 2, 4, 6], [0, 3, 5, 6]],
  break: [[0], [0, 4], [0, 3]],
  outro: [[0, 3], [0], [0, 4]],
}

function cellFor(kind: SectionKind, steps: number, rand: () => number, previous: number[] | null): number[] {
  const pool = CELLS[kind]
  const raw = pool[Math.floor(rand() * pool.length)]
  const scaled = raw.map((p) => Math.round((p / 8) * steps)).filter((p) => p < steps)
  const unique = [...new Set(scaled)].sort((a, b) => a - b)
  if (!previous) return unique
  // variation de motif : on ajoute ou retire une frappe, sans changer la cellule
  if (rand() < 0.5) return unique
  const extra = Math.floor(rand() * steps)
  return [...new Set([...unique, extra])].sort((a, b) => a - b)
}

/* ------------------------------------------------------------------ plan */

export interface PlanInput {
  profile: MusicalProfile
  seed: number
  selection: Sound[]
}

interface VoiceState {
  role: Role
  soundId: string
  cap: SoundCapability
  cell: number[] | null
  /** pour la mélodie/harmonie : degré courant */
  degree: number
}

export function buildPlan(input: PlanInput): ScorePlan {
  const { profile, selection } = input
  const seed = input.seed >>> 0
  const rand = prng(seed)
  const caps = buildCapabilities(selection)
  const { roles, adaptations, limits } = assignRoles(caps, profile)

  const sections = buildForm(profile, rand)
  const totalBars = sections.reduce((n, s) => n + s.bars, 0)
  const { beatsPerBar, subdivision } = profile.time
  const stepsPerBar = beatsPerBar * subdivision

  const notes: PlannedNote[] = []
  const recognised = new Set<string>()
  let noteId = 0

  const voices: VoiceState[] = []
  for (const role of ['bass', 'melody', 'rhythm', 'texture', 'earcandy'] as Role[]) {
    for (const soundId of roles[role]) {
      const cap = caps.get(soundId)
      if (cap) voices.push({ role, soundId, cap, cell: null, degree: 0 })
    }
  }

  const addNote = (v: VoiceState, bar: number, sub: number, beats: number, opts: {
    midi?: number | null; recognisable: boolean; gainDb?: number; lowpassHz?: number
  }) => {
    const beat = Math.floor(sub / subdivision)
    const subInBeat = sub % subdivision
    let rate = 1
    let realizedHz = v.cap.pitch.medianHz ?? 0
    let written: number | null = null

    if (opts.midi != null) {
      const f0 = v.cap.pitch.medianHz
      if (!v.cap.pitch.credible || !f0) {
        // pas de hauteur crédible : on ne prétend pas jouer cette note
        limits.push({ code: 'pitch-not-credible',
          detail: `${v.soundId} ne peut pas tenir une hauteur fiable — note rythmique à la place` })
        written = null
      } else {
        const semis = opts.midi - (69 + 12 * Math.log2(f0 / 440))
        if (Math.abs(semis) > MAX_TRANSPOSITION_SEMITONES) {
          limits.push({ code: 'transposition-refused',
            detail: `${v.soundId} aurait dû être transposé de ${semis.toFixed(1)} demi-tons : refusé (max ${MAX_TRANSPOSITION_SEMITONES})` })
        } else {
          written = opts.midi
          rate = Math.pow(2, semis / 12)
          realizedHz = f0 * rate
        }
      }
    }

    // invariant : la hauteur produite est celle qui est écrite
    if (written != null) {
      const target = midiToHz(written)
      const cents = centsBetween(realizedHz, target)
      if (cents > PITCH_TOLERANCE_CENTS) {
        limits.push({ code: 'pitch-invariant-violated',
          detail: `${v.soundId} : ${cents.toFixed(1)} cents d’écart entre note écrite et note produite` })
      }
    }

    notes.push({
      id: `n${noteId++}`,
      sourceId: v.soundId,
      role: v.role,
      bar,
      beat,
      sub: subInBeat,
      durationBeats: beats,
      writtenMidi: written,
      realizedHz,
      playbackRate: Number(rate.toFixed(6)),
      gainDb: (opts.gainDb ?? 0) + profile.mix.roleGainDb[v.role],
      pan: v.role === 'texture' ? -0.35 : v.role === 'earcandy' ? 0.35 : 0,
      sourceOffsetS: Number((rand() * (v.cap.pitch.credible ? 0.25 : 0.6)).toFixed(3)),
      recognisable: opts.recognisable,
      lowpassHz: opts.lowpassHz,
      attackS: v.role === 'texture' ? 0.25 : 0.005,
      releaseS: v.role === 'texture' ? 0.5 : 0.08,
    })
    if (opts.recognisable) recognised.add(v.soundId)
  }

  for (const section of sections) {
    for (let b = section.startBar; b < section.startBar + section.bars; b++) {
      const density = profile.groove.densityBySection[section.kind]
      const sectionRel = (b - section.startBar) / Math.max(section.bars - 1, 1)

      for (const v of voices) {
        const active = section.activeRoles.includes(v.role)
        if (!active) continue

        if (v.role === 'rhythm') {
          v.cell = cellFor(section.kind, stepsPerBar, rand, v.cell)
          // densité : on retire des frappes proportionnellement
          const keep = v.cell.filter(() => rand() < Math.max(0.35, density))
          const hits = keep.length ? keep : v.cell.slice(0, 1)
          for (const sub of hits) {
            const beats = Math.max(0.25, (beatsPerBar * subdivision - sub) / subdivision * 0.5)
            addNote(v, b, sub, Math.min(beats, 1), { recognisable: recognised.has(v.soundId) === false && rand() < 0.5 })
          }
        } else if (v.role === 'bass') {
          // basse : événement, pas nappe — une frappe toutes les 2 mesures environ
          if (b % 2 !== 0 || rand() > density) continue
          const root = profile.harmony.rootMidi ?? 60
          const degree = profile.harmony.mode === 'progression' && profile.harmony.progression
            ? profile.harmony.progression[Math.floor(b / 2) % profile.harmony.progression.length]
            : [0]
          const f0 = v.cap.pitch.medianHz
          const midi = f0
            ? nearestScalePitch(f0, root + (degree[0] ?? 0) - 12, profile.harmony.scale,
              MAX_TRANSPOSITION_SEMITONES, true)
            : null
          if (midi == null) continue
          addNote(v, b, 0, 2, { midi, recognisable: !recognised.has(v.soundId) })
        } else if (v.role === 'melody') {
          if (b % 2 !== 0) continue
          if (rand() > density * 0.8) continue
          const root = profile.harmony.rootMidi ?? 62
          const f0 = v.cap.pitch.medianHz
          if (!f0) continue
          // on tire un degré, puis on le ramène près de la hauteur réelle du son
          const step = profile.harmony.scale[Math.floor(rand() * profile.harmony.scale.length)]
          const midi = nearestScalePitch(f0, root + step, profile.harmony.scale, MAX_TRANSPOSITION_SEMITONES)
          if (midi == null) continue
          addNote(v, b, Math.floor(rand() * stepsPerBar), 1.5, {
            midi, recognisable: !recognised.has(v.soundId),
          })
        } else if (v.role === 'texture') {
          if (b % 4 !== 0) continue
          const long = section.kind === 'break' || profile.id === 'ambient-creole'
          addNote(v, b, 0, long ? beatsPerBar * 2 : beatsPerBar, {
            recognisable: !recognised.has(v.soundId),
            lowpassHz: section.kind === 'intro' || section.kind === 'break' ? 1800 : undefined,
          })
        } else {
          if (rand() > density * 0.5) continue
          addNote(v, b, Math.floor(rand() * stepsPerBar), 0.5, { recognisable: false, gainDb: -4 })
        }
      }

      // remplissage de fin de phrase
      if (profile.groove.fillProbability > 0 && b % 4 === 3 && rand() < profile.groove.fillProbability) {
        const rhythmVoice = voices.find((v) => v.role === 'rhythm')
        if (rhythmVoice) {
          for (let k = stepsPerBar - 2; k < stepsPerBar; k++) {
            addNote(rhythmVoice, b, k, 0.25, { recognisable: false, gainDb: -6 })
          }
        }
      }

      // montée : densité croissante dans les deux dernières mesures du build
      if (section.kind === 'build' && sectionRel > 0.75) {
        const rhythmVoice = voices.find((v) => v.role === 'rhythm')
        if (rhythmVoice && rand() < 0.6) {
          addNote(rhythmVoice, b, Math.floor(rand() * stepsPerBar), 0.25, { recognisable: false, gainDb: -8 })
        }
      }
    }
  }

  // 2e passe de couverture : tout son sélectionné doit avoir une apparition brute
  for (const sound of selection) {
    if (recognised.has(sound.id)) continue
    const v = voices.find((x) => x.soundId === sound.id)
    if (!v) continue
    const bar = Math.floor(totalBars * 0.35)
    addNote(v, bar, 0, 1, { recognisable: true, midi: v.role === 'melody' ? (profile.harmony.rootMidi ?? 62) : null })
  }

  const missing = selection.filter((s) => !recognised.has(s.id)).map((s) => s.id)
  if (missing.length) {
    limits.push({ code: 'recognition-incomplete',
      detail: `sons sans apparition reconnaissable : ${missing.join(', ')}` })
  }

  const usedSources = [...new Set(notes.map((n) => n.sourceId))].sort()

  return {
    schema: 2,
    engine: 'v2',
    seed,
    profileId: profile.id,
    profileVersion: profile.version,
    time: profile.time,
    bars: totalBars,
    notes,
    sections,
    roles,
    mix: { roleGainDb: profile.mix.roleGainDb, masterLufs: profile.mix.masterLufs, truePeakMax: -1 },
    adaptations,
    limits,
    sources: usedSources,
    reproducibility: {
      engineVersion: ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
      capabilityMatrix: CAPABILITY_MATRIX_SOURCE(),
      soundIds: [...selection.map((s) => s.id)].sort(),
    },
  }
}

/** Durée du plan en secondes, sans toucher à l'audio. */
export const planDurationS = (plan: ScorePlan): number =>
  plan.bars * plan.time.barSeconds

export function summarisePlan(plan: ScorePlan) {
  const byRole: Record<string, number> = {}
  for (const n of plan.notes) byRole[n.role] = (byRole[n.role] ?? 0) + 1
  return {
    engine: plan.engine,
    profileId: plan.profileId,
    profileVersion: plan.profileVersion,
    seed: plan.seed,
    bars: plan.bars,
    durationS: Number(planDurationS(plan).toFixed(2)),
    barSeconds: plan.time.barSeconds,
    beatsPerBar: plan.time.beatsPerBar,
    subdivision: plan.time.subdivision,
    notes: plan.notes.length,
    byRole,
    sources: plan.sources,
    recognisableNotes: plan.notes.filter((n) => n.recognisable).length,
    pitchedNotes: plan.notes.filter((n) => n.writtenMidi != null).length,
    adaptations: plan.adaptations.length,
    limits: plan.limits.map((l) => l.code),
  }
}
