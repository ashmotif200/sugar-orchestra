export type Role = 'bass' | 'melody' | 'rhythm' | 'earcandy' | 'texture'

export const ROLES: Role[] = ['bass', 'melody', 'rhythm', 'earcandy', 'texture']

export const ROLE_LABEL: Record<Role, string> = {
  bass: 'Basse',
  melody: 'Mélodie',
  rhythm: 'Rythmique',
  earcandy: 'Ear candy',
  texture: 'Texture',
}

export interface SoundAnalysis {
  durationS: number
  sampleRate: number
  rmsDb: number
  peakDb: number
  centroidHz: number
  flatness: number
  zcr: number
  f0Hz: number | null
  pitchConfidence: number
  tonalScore: number
  onsetRate: number
  onsets: number[]
  sustainRatio: number
  attackSharpness: number
}

export interface Sound {
  id: string
  code: string
  name: string
  file: string
  section: string
  roles: Role[]
  suggestedRoles?: Role[]
  roleScores?: Record<string, number>
  credits: string
  license: string
  status: 'placeholder-synth' | 'imported'
  nature?: string
  sensitive?: boolean
  needsValidation?: boolean
  inDemoSet?: boolean
  anecdote: { text: string; status: 'placeholder' | 'validated' }
  analysis: SoundAnalysis
}

export interface Section {
  id: string
  order: number
  name: string
  short: string
  context?: string
}

export interface Catalog {
  version: number
  generatedAt: string
  source: 'placeholder-synth' | 'imported'
  disclaimer?: string
  limits: { minSelected: number; maxSelected: number }
  sections: Section[]
  demoSet?: string[]
  sounds: Sound[]
}

export interface Universe {
  id: 'energetique' | 'reveur' | 'dansant' | 'detendu'
  name: string
  emotion: string
  style: string
  glyph: string
  available: boolean
  accent: string
  bpm: number
  bars: number
  tempoLabel: string
  blurb: string
}
