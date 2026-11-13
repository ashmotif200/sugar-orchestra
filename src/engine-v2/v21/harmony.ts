/**
 * V2.1 — Harmonic Controller + décisions de basse.
 *
 * Chaque décision harmonique porte sa provenance. Aucune donnée ambiguë n'est
 * convertie en harmonie : dans le doute, on joue une pédale déclarée comme choix
 * de composition, jamais comme « transcription de la référence ».
 */
import type { MusicalProfile } from '../types'

export type HarmonySource =
  | 'profile_pedal'
  | 'profile_progression'
  | 'confirmed_reference_data'
  | 'explicit_composition_choice'

export interface HarmonicState {
  rootMidi: number
  scale: number[]
  source: HarmonySource
  note: string
  /** changement de centre à la mesure indiquée, sinon null */
  changesAtBar: { bar: number; rootMidi: number }[] | null
}

/**
 * Construit l'état harmonique d'un profil.
 *
 * - un profil `progression` fournit une suite d'accords explicite ;
 * - un profil `pedal` fournit un centre fixe, avec éventuellement une seconde
 *   zone plus grave en fin de morceau (mouvement conclusif) ;
 * - un profil `none` n'a pas d'harmonie : on n'en fabrique pas. Les couches
 *   tonales restent alors sur une pédale de composition, déclarée comme telle.
 */
export function harmonicState(profile: MusicalProfile, bars: number): HarmonicState {
  const h = profile.harmony
  if (h.mode === 'progression' && h.progression && h.progression.length) {
    const changes = [] as { bar: number; rootMidi: number }[]
    const cycle = Math.max(2, Math.round(bars / (h.progression.length * 2)))
    for (let b = 0, k = 0; b < bars; b += cycle, k++) {
      const deg = h.progression[k % h.progression.length]
      changes.push({ bar: b, rootMidi: (h.rootMidi ?? 60) + (deg[0] ?? 0) })
    }
    return {
      rootMidi: h.rootMidi ?? 60,
      scale: h.scale,
      source: 'profile_progression',
      note: 'progression explicite du profil (choix de composition, pas une transcription)',
      changesAtBar: changes,
    }
  }
  if (h.mode === 'none') {
    return {
      rootMidi: h.rootMidi ?? 62,
      scale: h.scale,
      source: 'explicit_composition_choice',
      note: 'aucune harmonie fiable dans la référence : pédale de composition assumée',
      changesAtBar: null,
    }
  }
  return {
    rootMidi: h.rootMidi ?? 60,
    scale: h.scale,
    source: 'profile_pedal',
    note: 'pédale du profil, mesurée sur la référence',
    changesAtBar: null,
  }
}

export const rootAtBar = (state: HarmonicState, bar: number): number => {
  if (!state.changesAtBar?.length) return state.rootMidi
  let root = state.rootMidi
  for (const c of state.changesAtBar) if (bar >= c.bar) root = c.rootMidi
  return root
}

/* ------------------------------------------------------------ basse : timbres */

export type BassTimbre = 'sub' | 'warm' | 'percussive'

export interface BassSynthParams {
  timbre: BassTimbre
  /** amplitude relative des harmoniques 1, 2, 3 */
  harmonics: [number, number, number]
  attackS: number
  decayS: number
  sustain: number
  releaseS: number
  cutoffHz: number
  /** saturation douce 0–1 */
  drive: number
  gainDb: number
}

/**
 * Paramètres de synthèse par timbre. Ce sont des choix de conception, pas des
 * mesures : la référence ne fournit aucun timbre de basse synthétique.
 */
export const BASS_TIMBRES: Record<BassTimbre, BassSynthParams> = {
  sub: {
    timbre: 'sub', harmonics: [1, 0.12, 0.05],
    attackS: 0.08, decayS: 0.4, sustain: 0.85, releaseS: 0.6,
    cutoffHz: 180, drive: 0.05, gainDb: -3,
  },
  warm: {
    timbre: 'warm', harmonics: [1, 0.32, 0.14],
    attackS: 0.03, decayS: 0.25, sustain: 0.7, releaseS: 0.25,
    cutoffHz: 420, drive: 0.18, gainDb: -2,
  },
  percussive: {
    timbre: 'percussive', harmonics: [1, 0.45, 0.22],
    attackS: 0.004, decayS: 0.09, sustain: 0.18, releaseS: 0.09,
    cutoffHz: 700, drive: 0.3, gainDb: -1,
  },
}

/** Politique de basse par univers, dérivée des mesures V2.0.5. */
export interface BassPolicy {
  /** false = le profil ne demande pas de basse */
  wants: boolean
  timbre: BassTimbre
  /** position dans la mesure où placer les notes (0 = temps fort) */
  allowedSteps: number[]
  /** proportion de frappes de percussion que la basse peut doubler */
  doublingRate: number
  /** registre MIDI visé */
  midiRange: [number, number]
  rationale: string
}

export const BASS_POLICIES: Record<string, BassPolicy> = {
  // Ohwalawa : basse = renfort de kick, 75 % de coïncidence, IOI 0,36 s, staccato
  'electro-sega': {
    wants: true, timbre: 'percussive',
    allowedSteps: [0, 3, 6, 9], doublingRate: 0.7, midiRange: [33, 45],
    rationale: 'basse courte et synchronisée aux accents (mesuré : 75 % de coïncidence avec la percussion)',
  },
  // Tififi : aucune basse dans la référence — on n'en ajoute pas par défaut
  'sega-trad': {
    wants: false, timbre: 'sub',
    allowedSteps: [0], doublingRate: 0, midiRange: [33, 40],
    rationale: 'la référence ne contient pas de basse ; en ajouter une serait une invention',
  },
  // Zistoire : basse legato liée à l'harmonie (lift 2,55), 215,9 attaques/min
  segazz: {
    wants: true, timbre: 'warm',
    allowedSteps: [0, 2, 4, 6], doublingRate: 0.35, midiRange: [33, 45],
    rationale: 'basse legato liée à la couche tonale, pas au kick (lift 2,55 vs 2,37)',
  },
  // Rêveur : hypothèse. Sub tenue, aucune prétention stylistique.
  'ambient-creole': {
    wants: true, timbre: 'sub',
    allowedSteps: [0], doublingRate: 0, midiRange: [28, 40],
    rationale: 'profil hypothèse : sub tenue, pas une caractéristique démontrée',
  },
}
