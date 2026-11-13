/**
 * Profils musicaux V2 — valeurs issues des mesures de la Phase A3.
 *
 * Chaque profil porte une `version`. Un changement de paramètre incrémente la
 * version : une composition reste interprétable même après évolution du profil.
 *
 * Trois profils sont mesurés (Énergétique, Dansant, Détendu). Le quatrième,
 * Rêveur, est explicitement une hypothèse artistique — il le déclare et
 * l'interface doit l'afficher comme tel.
 */
import type { MusicalProfile, Role } from './types'

const ROLE_GAIN_DEFAULT: Record<Role, number> = {
  bass: 0, melody: -2.5, rhythm: 0, texture: -8, earcandy: -11,
}

export const PROFILES: MusicalProfile[] = [
  {
    id: 'electro-sega',
    version: 2,
    publicName: { fr: 'Énergétique', en: 'Energetic' },
    artisticStatus: 'measured',
    reference: 'Ohwalawa (51,06 s, −11,7 LUFS, 135 BPM, 4/4 ternaire)',
    time: { barSeconds: 1.778, beatsPerBar: 4, subdivision: 3, swing: 0.67, microtimingMs: 18 },
    duration: { minBars: 28, maxBars: 32 },
    groove: {
      densityBySection: { intro: 0.35, build: 0.7, main: 1.0, break: 0.25, outro: 0.5 },
      motifVariation: 0.35,
      fillProbability: 0.25,
    },
    harmony: { mode: 'pedal', rootMidi: 65, scale: [0, 2, 4, 5, 7, 9, 11], progression: null },
    requiredRoles: ['rhythm'],
    optionalRoles: ['bass', 'melody', 'texture', 'earcandy'],
    mix: { roleGainDb: { ...ROLE_GAIN_DEFAULT, bass: -7, melody: -4, rhythm: 0, texture: -10 }, masterLufs: -12 },
    constraints: [
      'la basse est un événement rare, pas une nappe continue',
      'percussion devant : au moins 6 dB au-dessus de la basse quand elle joue',
    ],
    fallbacks: ['sans basse, la densité percussive augmente de 15 %'],
  },
  {
    id: 'sega-trad',
    version: 2,
    publicName: { fr: 'Dansant', en: 'Dancing' },
    artisticStatus: 'measured',
    reference: 'Tififi (205,59 s, −10,1 LUFS, mesure 2,32 s, 6/8, percussion roulée)',
    time: { barSeconds: 2.322, beatsPerBar: 6, subdivision: 3, swing: 0.67, microtimingMs: 26 },
    duration: { minBars: 48, maxBars: 56 },
    groove: {
      // densité exprimée en frappes par temps : le roulement est la signature
      densityBySection: { intro: 0.15, build: 0.85, main: 1.0, break: 0.6, outro: 0.4 },
      motifVariation: 0.08,
      fillProbability: 0.05,
    },
    harmony: { mode: 'none', rootMidi: null, scale: [0, 2, 3, 5, 7, 8, 10], progression: null },
    requiredRoles: ['rhythm'],
    optionalRoles: ['melody', 'texture', 'earcandy'],
    mix: { roleGainDb: { ...ROLE_GAIN_DEFAULT, rhythm: 0, melody: -1, texture: -12 }, masterLufs: -12 },
    constraints: [
      'la percussion est un roulement continu, pas une cellule de 4 temps',
      'très peu de variation : la continuité est la signature',
      'aucune basse : la référence n’en contient pas',
    ],
    fallbacks: ['sans son percussif dense, le profil refuse Dansant et le signale'],
  },
  {
    id: 'segazz',
    version: 2,
    publicName: { fr: 'Détendu', en: 'Relaxed' },
    artisticStatus: 'measured',
    reference: 'Zistoire (54,47 s, −14,5 LUFS, 137 BPM, 4/4 binaire, si mineur)',
    time: { barSeconds: 1.752, beatsPerBar: 4, subdivision: 2, swing: 0.5, microtimingMs: 28 },
    duration: { minBars: 30, maxBars: 34 },
    groove: {
      densityBySection: { intro: 0.4, build: 0.6, main: 0.85, break: 0.35, outro: 0.6 },
      motifVariation: 0.55,
      fillProbability: 0.3,
    },
    harmony: {
      mode: 'progression', rootMidi: 59, scale: [0, 2, 3, 5, 7, 8, 10],
      progression: [[0], [0, 3, 7], [5, 8, 12], [3, 7, 10]],
    },
    requiredRoles: [],
    optionalRoles: ['bass', 'melody', 'rhythm', 'texture', 'earcandy'],
    mix: { roleGainDb: { ...ROLE_GAIN_DEFAULT, bass: -3, rhythm: -6, melody: -3, texture: -7 }, masterLufs: -14 },
    constraints: [
      'harmonie qui bouge : c’est ce qui distingue ce profil des deux autres',
      'percussions en retrait, basse devant quand elle existe',
      'basse facultative : sinon le profil compose sans basse et le déclare',
    ],
    fallbacks: ['sans basse : conserve harmonie et variation, déclare la limite'],
  },
  {
    id: 'ambient-creole',
    version: 2,
    publicName: { fr: 'Rêveur', en: 'Dreaming' },
    artisticStatus: 'hypothesis',
    reference: null,
    time: { barSeconds: 4.0, beatsPerBar: 4, subdivision: 2, swing: 0.5, microtimingMs: 40 },
    duration: { minBars: 16, maxBars: 20 },
    groove: {
      densityBySection: { intro: 0.2, build: 0.45, main: 0.6, break: 0.3, outro: 0.25 },
      motifVariation: 0.8,
      fillProbability: 0.0,
    },
    harmony: { mode: 'pedal', rootMidi: 62, scale: [0, 2, 3, 5, 7, 9, 10], progression: null },
    requiredRoles: [],
    optionalRoles: ['texture', 'melody', 'earcandy', 'rhythm'],
    mix: { roleGainDb: { ...ROLE_GAIN_DEFAULT, texture: -2, melody: -6, rhythm: -10 }, masterLufs: -16 },
    constraints: [
      'aucune référence mesurée : profil hypothèse, à valider par le propriétaire',
      'pas de pulsation dansante, pas de basse',
    ],
    fallbacks: ['sans matériau texturé, refuse Rêveur et propose Détendu'],
  },
]

export const getProfile = (id: string): MusicalProfile | undefined =>
  PROFILES.find((p) => p.id === id)

export const MEASURED_PROFILES = PROFILES.filter((p) => p.artisticStatus === 'measured')
