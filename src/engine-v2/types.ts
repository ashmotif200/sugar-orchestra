/**
 * Contrats du moteur musical V2.
 *
 * Règle de dépendance : le planificateur (module B) ne connaît ni l'audio, ni le
 * navigateur, ni le serveur. Il produit un ScorePlan sérialisable ; le rendu
 * (module C) le consomme sans jamais décider de la structure.
 */

export type Role = 'bass' | 'melody' | 'rhythm' | 'texture' | 'earcandy'

/* ------------------------------------------------------------------ module A */

export interface SoundPotential {
  rhythmic: number; percussive: number; melodic: number; harmonic: number
  low: number; textural: number; atmospheric: number
}

export interface SoundCapability {
  soundId: string
  potential: SoundPotential
  pitch: {
    credible: boolean
    medianHz: number | null
    periodicity: number
    voicedRatio: number
  }
  transform: {
    timeStretch: 'safe' | 'risky'
    pitchShift: 'safe' | 'not-applicable'
    granular: 'good' | 'poor'
    lowDerivation: 'plausible' | 'unlikely'
  }
  /** métadonnées éditoriales conservées : elles ne bloquent rien, elles qualifient */
  historicalSensitivity: boolean
  limitedMusicalMaterial: boolean
  availableRoles: Role[]
}

/* ---------------------------------------------------------------- profils */

export type SectionKind = 'intro' | 'build' | 'main' | 'break' | 'outro'

export interface TimeModel {
  /** durée d'une mesure, en secondes — la vérité rythmique du profil */
  barSeconds: number
  beatsPerBar: 3 | 4 | 6
  /** 2 = binaire, 3 = ternaire */
  subdivision: 2 | 3
  /** position du contretemps : 0.5 droit, 0.667 triolet */
  swing: number
  /** dispersion appliquée aux frappes, en ms */
  microtimingMs: number
}

export interface MusicalProfile {
  id: string
  version: number
  publicName: { fr: string; en: string }
  artisticStatus: 'measured' | 'hypothesis'
  reference: string | null
  time: TimeModel
  duration: { minBars: number; maxBars: number }
  groove: {
    densityBySection: Record<SectionKind, number>
    motifVariation: number
    fillProbability: number
  }
  harmony: {
    mode: 'pedal' | 'progression' | 'none'
    rootMidi: number | null
    scale: number[]
    progression: number[][] | null
  }
  requiredRoles: Role[]
  optionalRoles: Role[]
  mix: { roleGainDb: Record<Role, number>; masterLufs: number }
  constraints: string[]
  fallbacks: string[]
}

/* ------------------------------------------------------------ module B/C */

export interface PlannedNote {
  id: string
  sourceId: string
  role: Role
  /** position musicale : la grille est la vérité, jamais un temps en secondes */
  bar: number
  beat: number
  sub: number
  durationBeats: number
  /** hauteur ÉCRITE (null si le son n'a pas de hauteur crédible) */
  writtenMidi: number | null
  /** hauteur RÉELLEMENT produite, calculée depuis writtenMidi et le taux */
  realizedHz: number
  playbackRate: number
  gainDb: number
  pan: number
  /** décalage de lecture dans la source, en secondes */
  sourceOffsetS: number
  /** apparition brute : le son doit être identifiable comme celui du musée */
  recognisable: boolean
  /** filtre passe-bas une pente, optionnel */
  lowpassHz?: number
  attackS: number
  releaseS: number
}

export interface PlannedSection {
  kind: SectionKind
  startBar: number
  bars: number
  activeRoles: Role[]
}

export interface Adaptation {
  role: Role
  sourceId: string | null
  reason: string
}

export interface Limit {
  code: string
  detail: string
}

export interface ScorePlan {
  schema: 2
  engine: 'v2'
  seed: number
  profileId: string
  profileVersion: number
  time: TimeModel
  bars: number
  notes: PlannedNote[]
  sections: PlannedSection[]
  roles: Record<Role, string[]>
  mix: { roleGainDb: Record<Role, number>; masterLufs: number; truePeakMax: number }
  adaptations: Adaptation[]
  limits: Limit[]
  sources: string[]
  /** métadonnées de reproductibilité */
  reproducibility: {
    engineVersion: string
    policyVersion: number
    capabilityMatrix: string
    soundIds: string[]
  }
}

export interface RenderVerification {
  durationS: number | null
  sampleRate: number | null
  channels: number | null
  peakDb: number | null
  truePeakDb: number | null
  lufs: number | null
  hasNaN: boolean
  clipped: boolean
  ok: boolean
  notes: string[]
}
