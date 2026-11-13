/**
 * Contrats V2.1 — structure musicale.
 *
 * Types SEULEMENT : aucun moteur n'est modifié par ce fichier. Ils décrivent ce
 * que les extractions V2.0.5 savent réellement produire, avec la confiance et la
 * provenance à côté de chaque fait — pour qu'un compositeur V2.1 ne puisse pas
 * confondre une détection automatique avec une annotation musicale confirmée.
 *
 * Les données correspondantes vivent dans docs/v2.0.5/data/.
 */

export type Confidence = 'confirmed' | 'musically_plausible' | 'observed' | 'weak' | 'ambiguous'

/** Provenance obligatoire : d'où vient le fait, avec quelle méthode. */
export interface Provenance {
  referenceId: string
  stemId: string
  sourceFile: string
  sourceSha256?: string
  method: string
  confidence: Confidence
}

export interface MusicalEvent extends Provenance {
  eventId: string
  startSeconds: number
  endSeconds: number
  eventType: 'attack' | 'note' | 'silence'
  strength: number
}

export interface RhythmicPattern {
  patternId: string
  referenceId: string
  stemId: string
  type: 'rhythmic_cell'
  stepsPerBar: number
  /** 'x..x..x.' — présence d'attaque par pas, pas d'accent */
  cell: string
  hits: number[]
  density: number
  occurrences: number
  bars: number[]
  method: string
  confidence: Confidence
}

export interface PatternVariation {
  basePattern: string
  variantPattern: string
  addedHits: number[]
  removedHits: number[]
  editDistance: number
  observedBars: number
  confidence: Confidence
}

export interface MelodicNote {
  start_s: number
  end_s: number
  duration_s: number
  pitch_hz: number
  midi_rounded: number
  cents_stability: number
  voiced_probability: number
  confidence: Confidence
  method: string
}

export interface MelodicPhrase {
  referenceId: string
  stemId: string
  notes: MelodicNote[]
  /** confirmed + musically_plausible seulement */
  usableNotes: number
  ambiguousNotes: number
}

/** Comportement de basse : rythmique fiable, hauteur souvent non. */
export interface BassPattern {
  referenceId: string
  onsets: number
  notes_per_minute: number
  ioi_median_s: number | null
  ioi_p10_s: number | null
  ioi_p90_s: number | null
  duration_median_s: number
  staccato_ratio: number
  /** positions sur steps_per_bar ; l'index 0 est le temps fort */
  step_histogram: Record<number, number>
  with_drums_within_40ms_pct: number | null
  reliable: string[]
  unreliable: string[]
}

export interface HarmonicSequence {
  referenceId: string
  mode: 'pedal' | 'progression' | 'none'
  keyCandidates: { key: string; correlation: number }[] | null
  /** présent uniquement si la corrélation dépasse le seuil de fiabilité */
  confirmedKey: string | null
  note: string
}

export interface ArrangementSection {
  kind: string
  startBar: number
  endBar: number
  startS: number
  durationS: number
  activeStems: string[]
}

/** Corrélation mesurée — jamais présentée comme intention musicale. */
export interface StemInteraction {
  stemA: string
  stemB: string
  coincidence_within_ms: number
  coincidence_pct_of_A: number
  lift_vs_chance: number | null
  A_followed_by_B_pct: number
  reading: string
}

export interface ReferenceStyleModel {
  schema: 'v2.0.5/reference-style'
  referenceId: string
  universeId: string
  label: string
  referenceTitle: string
  time: {
    barSeconds: number
    beatsPerBar: number
    subdivision: number
    swing: number
    swing_reading: string | null
    microtiming_ms: number
    grid_is_hypothesis: boolean
  }
  arrangement: { barSeconds: number; bars: number; sections: ArrangementSection[]; section_count: number }
  rhythm: {
    patterns: RhythmicPattern[]
    variations: PatternVariation[]
    cells_distinct_by_stem: Record<string, number>
    density_by_stem: Record<string, number>
  }
  bass: BassPattern | null
  tonal: Record<string, { confirmed: number; musically_plausible: number; ambiguous: number }>
  interactions: StemInteraction[]
  uncertaintyNote: string[]
  needsHumanValidation: string[]
}
