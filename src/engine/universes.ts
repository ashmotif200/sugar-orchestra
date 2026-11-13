import type { Universe } from '../audio/types'

export const UNIVERSES: Universe[] = [
  {
    id: 'energetique',
    name: 'Electro Sega',
    emotion: 'Énergétique',
    style: 'Electro Sega',
    glyph: '⚡',
    available: true,
    accent: '#E2703A',
    bpm: 112,
    bars: 16,
    tempoLabel: '112 BPM · 4/4 · 34 s',
    blurb: 'Tambour, basse pulsée, shaker en 16e. Le sucre qui bout.',
  },
  {
    id: 'reveur',
    name: 'Ambient créole',
    emotion: 'Rêveur',
    style: 'Ambient créole',
    glyph: '🌊',
    available: true,
    accent: '#4E8F9B',
    bpm: 72,
    bars: 12,
    tempoLabel: '72 BPM · 4/4 · 40 s',
    blurb: 'Nappes granulaires, cloches lointaines, souffle. La vapeur des chaudrons.',
  },
  {
    id: 'dansant',
    name: 'Sega traditionnel',
    emotion: 'Dansant',
    style: 'Sega traditionnel',
    glyph: '💃',
    available: false,
    accent: '#B8577A',
    bpm: 120,
    bars: 16,
    tempoLabel: 'à venir',
    blurb: 'Ravanne, triangle, voix en réponse. Non implémenté dans cette démo.',
  },
  {
    id: 'detendu',
    name: 'Segazz',
    emotion: 'Détendu',
    style: 'Segazz / Sega Jazz',
    glyph: '🌙',
    available: false,
    accent: '#7A6EA8',
    bpm: 88,
    bars: 16,
    tempoLabel: 'à venir',
    blurb: 'Accords étendus, swing lent. Non implémenté dans cette démo.',
  },
]

export const getUniverse = (id: string) => UNIVERSES.find((u) => u.id === id)

/** D minor pentatonic + dorian colour, expressed in Hz around D. */
export const SCALE = {
  /** semitone offsets from the root, pentatonic minor (sega / electro) */
  pentatonic: [0, 3, 5, 7, 10],
  /** dorian mode for the ambient universe */
  dorian: [0, 2, 3, 5, 7, 9, 10],
}

export const ROOT_HZ = 73.42 // D2

export const semisToRate = (semis: number) => Math.pow(2, semis / 12)
export const hzToSemis = (hz: number, ref = ROOT_HZ) => 12 * Math.log2(hz / ref)

/** Chord roots for the 16-bar electro sega cycle (bar index → semitones from D). */
export const ELECTRO_ROOTS = [0, 0, -4, -2, 0, 5, 7, 7, 0, -4, -2, 0, 0, 0, -4, -2]

/** Bass drone roots for the 12-bar ambient cycle. */
export const AMBIENT_ROOTS = [0, 0, 5, 5, -4, -4, -2, -2, 0, 0, 0, 0]
