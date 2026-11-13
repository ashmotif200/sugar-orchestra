import type { Universe } from '../audio/types'

/** Les quatre univers du dossier de transmission. La disponibilité vient d'ici,
 *  jamais d'un écran. Deux sont réellement implémentés dans le prototype. */
export const UNIVERSES: Universe[] = [
  {
    id: 'electro-sega',
    name: 'Electro Sega',
    emotion: 'Énergétique',
    style: 'Electro Sega',
    glyph: '⚡',
    icon: 'zigzag',
    description: 'Basses filtrées, tambour serré, éclats. Le sucre qui bout.',
    accent: '#E5533D',
    fill: '#C63E2A',
    available: true,
    bpm: 112,
    bars: 16,
    tempoLabel: '112 BPM · 4/4 · 36 s',
  },
  {
    id: 'sega-trad',
    name: 'Sega traditionnel',
    emotion: 'Dansant',
    style: 'Sega traditionnel',
    glyph: '◉',
    icon: 'cercles',
    description: 'Ravanne, triangle, appel et réponse. Le bal du dimanche.',
    accent: '#E9A23B',
    fill: '#E9A23B',
    available: true,
    bpm: 126,
    bars: 24,
    tempoLabel: '6/8 · 126 · 34 s',
  },
  {
    id: 'ambient-creole',
    name: 'Ambient créole',
    emotion: 'Rêveur',
    style: 'Ambient créole',
    glyph: '≈',
    icon: 'onde',
    description: 'Nappes, souffle, cloches lointaines.',
    accent: '#2A9D9B',
    fill: '#2A9D9B',
    available: false,
    bpm: 72,
    bars: 12,
    tempoLabel: 'Bientôt',
  },
  {
    id: 'segazz',
    name: 'Segazz',
    emotion: 'Détendu',
    style: 'Segazz',
    glyph: '∫',
    icon: 'courbe',
    description: 'Accords étendus, swing lent.',
    accent: '#3F4A9E',
    fill: '#3F4A9E',
    available: false,
    bpm: 88,
    bars: 16,
    tempoLabel: 'Bientôt',
  },
]

export const getUniverse = (id: string | undefined) => UNIVERSES.find((u) => u.id === id)

/** D mineur pentatonique (electro / sega) et dorien (ambient). */
export const SCALE = {
  pentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
}

export const ROOT_HZ = 73.42 // D2

export const semisToRate = (semis: number) => Math.pow(2, semis / 12)
export const hzToSemis = (hz: number, ref = ROOT_HZ) => 12 * Math.log2(hz / ref)

/** Grille harmonique electro sega, 16 mesures (demi-tons depuis D). */
export const ELECTRO_ROOTS = [0, 0, -4, -2, 0, 5, 7, 7, 0, -4, -2, 0, 0, 0, -4, -2]
/** Sega traditionnel : deux accords par cycle, plus statique. */
export const SEGA_ROOTS = [0, 0, 0, 0, 5, 5, 0, 0, -4, -4, -2, -2, 0, 0, 0, 0, 5, 5, 0, 0, -4, -2, 0, 0]
/** Ambient. */
export const AMBIENT_ROOTS = [0, 0, 5, 5, -4, -4, -2, -2, 0, 0, 0, 0]
