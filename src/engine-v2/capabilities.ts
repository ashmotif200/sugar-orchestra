/**
 * Module A — Music Intelligence.
 *
 * Transforme les mesures acoustiques (Phase A3) en capacités musicales, puis
 * attribue les rôles selon ce que les sons savent réellement faire.
 *
 * Principe : une fréquence détectée n'est pas une hauteur exploitable. Seuls les
 * sons marqués `credible_pitch` par le corpus (periodicity ≥ 0,75 et
 * voiced_ratio ≥ 0,30) peuvent porter une mélodie ou une basse.
 */
import type { Sound } from '../audio/types'
import type { Adaptation, Limit, MusicalProfile, Role, SoundCapability } from './types'

interface MatrixRow {
  id: string
  potential: Record<string, number>
  best_roles: string[]
  sensitive: boolean
  pitch_reliability: {
    credible_pitch: boolean
    bass_capable: boolean
    median_hz: number | null
    periodicity: number
    voiced_ratio: number
  }
  transform_fitness: {
    time_stretch: 'safe' | 'risky'
    pitch_shift: 'safe' | 'not-applicable'
    granular: 'good' | 'poor'
    low_derivation: 'plausible' | 'unlikely'
  }
}

/**
 * La matrice est injectée par l'appelant : le navigateur importe le JSON bundlé,
 * le serveur le lit depuis le disque. Ce module reste ainsi utilisable dans les
 * deux environnements sans import JSON implicite.
 */
export interface CapabilityMatrix { sounds: MatrixRow[]; selected_count: number }
let MATRIX: CapabilityMatrix = { sounds: [], selected_count: 0 }

export function setCapabilityMatrix(matrix: CapabilityMatrix): void { MATRIX = matrix }

export const CAPABILITY_MATRIX_SOURCE = () =>
  `capability-matrix.json (${MATRIX.selected_count} sons sélectionnés)`

const ROLE_FROM_POTENTIAL: Record<Role, (r: MatrixRow) => boolean> = {
  bass: (r) => r.pitch_reliability.credible_pitch && (r.potential.low ?? 0) >= 0.45,
  melody: (r) => r.pitch_reliability.credible_pitch,
  rhythm: (r) => (r.potential.rhythmic ?? 0) >= 0.5 || (r.potential.percussive ?? 0) >= 0.5,
  texture: (r) => (r.potential.textural ?? 0) >= 0.3 || (r.potential.atmospheric ?? 0) >= 0.45,
  earcandy: (r) => (r.potential.atmospheric ?? 0) >= 0.3 || (r.potential.percussive ?? 0) >= 0.3,
}

export function buildCapabilities(sounds: Sound[]): Map<string, SoundCapability> {
  const byId = new Map(MATRIX.sounds.map((r) => [r.id, r]))
  const out = new Map<string, SoundCapability>()

  for (const sound of sounds) {
    const row = byId.get(sound.id)
    const limited = sound.availability === 'not_musical'
    if (!row) {
      // son sélectionné mais absent de la matrice : on ne devine pas ses capacités
      out.set(sound.id, {
        soundId: sound.id,
        potential: { rhythmic: 0, percussive: 0, melodic: 0, harmonic: 0, low: 0, textural: 0.2, atmospheric: 0.2 },
        pitch: { credible: false, medianHz: null, periodicity: 0, voicedRatio: 0 },
        transform: { timeStretch: 'risky', pitchShift: 'not-applicable', granular: 'poor', lowDerivation: 'unlikely' },
        historicalSensitivity: !!sound.sensitive,
        limitedMusicalMaterial: limited,
        availableRoles: ['texture'],
      })
      continue
    }
    const roles = (Object.keys(ROLE_FROM_POTENTIAL) as Role[]).filter((r) => ROLE_FROM_POTENTIAL[r](row))
    out.set(sound.id, {
      soundId: sound.id,
      potential: {
        rhythmic: row.potential.rhythmic ?? 0, percussive: row.potential.percussive ?? 0,
        melodic: row.potential.melodic ?? 0, harmonic: row.potential.harmonic ?? 0,
        low: row.potential.low ?? 0, textural: row.potential.textural ?? 0,
        atmospheric: row.potential.atmospheric ?? 0,
      },
      pitch: {
        credible: row.pitch_reliability.credible_pitch,
        medianHz: row.pitch_reliability.median_hz,
        periodicity: row.pitch_reliability.periodicity,
        voicedRatio: row.pitch_reliability.voiced_ratio,
      },
      transform: {
        timeStretch: row.transform_fitness.time_stretch,
        pitchShift: row.transform_fitness.pitch_shift,
        granular: row.transform_fitness.granular,
        lowDerivation: row.transform_fitness.low_derivation,
      },
      historicalSensitivity: !!row.sensitive,
      limitedMusicalMaterial: limited,
      availableRoles: roles.length ? roles : ['texture'],
    })
  }
  return out
}

export interface RoleAssignment {
  roles: Record<Role, string[]>
  adaptations: Adaptation[]
  limits: Limit[]
}

/**
 * Attribue les rôles du profil aux sons réellement disponibles.
 * Aucune basse n'est inventée : si personne ne peut tenir le rôle, on le dit.
 */
export function assignRoles(
  caps: Map<string, SoundCapability>, profile: MusicalProfile,
): RoleAssignment {
  const all = [...caps.values()]
  const roles: Record<Role, string[]> = { bass: [], melody: [], rhythm: [], texture: [], earcandy: [] }
  const adaptations: Adaptation[] = []
  const limits: Limit[] = []
  const taken = new Set<string>()

  const candidates = (role: Role) => all
    .filter((c) => !taken.has(c.soundId) && c.availableRoles.includes(role))
    .sort((a, b) => score(b, role) - score(a, role))

  const score = (c: SoundCapability, role: Role) => {
    const p = c.potential
    if (role === 'bass') return p.low * 2 + (c.pitch.credible ? 1 : 0)
    if (role === 'melody') return (c.pitch.credible ? 2 : 0) + p.harmonic
    if (role === 'rhythm') return p.rhythmic + p.percussive
    if (role === 'texture') return p.textural + p.atmospheric
    return p.atmospheric + p.percussive * 0.5
  }

  // 1. rôles requis par le profil
  for (const role of profile.requiredRoles) {
    const pick = candidates(role)[0]
    if (!pick) {
      limits.push({ code: `missing-required-role:${role}`,
        detail: `aucun son sélectionné ne peut tenir le rôle « ${role} » exigé par ${profile.id}` })
      adaptations.push({ role, sourceId: null, reason: 'rôle requis impossible — profil dégradé' })
      continue
    }
    roles[role].push(pick.soundId)
    taken.add(pick.soundId)
  }

  // 2. rôles optionnels, un son par rôle au plus, dans l'ordre du profil
  for (const role of profile.optionalRoles) {
    const pool = candidates(role)
    if (!pool.length) {
      if (role === 'bass') {
        limits.push({ code: 'no-bass-capable-sound',
          detail: 'aucun son n’a de hauteur crédible dans le grave : composition sans basse' })
        adaptations.push({ role: 'bass', sourceId: null, reason: 'basse absente — non inventée' })
      }
      continue
    }
    const pick = pool[0]
    roles[role].push(pick.soundId)
    taken.add(pick.soundId)
    adaptations.push({ role, sourceId: pick.soundId, reason: `capacité mesurée : ${role}` })
  }

  // 3. couverture : tout son sélectionné doit être entendu
  for (const c of all) {
    if (taken.has(c.soundId)) continue
    const role: Role = c.potential.rhythmic >= 0.5 ? 'rhythm'
      : c.pitch.credible ? 'melody'
      : c.potential.textural >= c.potential.atmospheric ? 'texture' : 'earcandy'
    roles[role].push(c.soundId)
    taken.add(c.soundId)
    adaptations.push({ role, sourceId: c.soundId, reason: 'couverture : le son doit être entendu' })
  }

  // 4. limites éditoriales conservées mais non bloquantes
  const limited = all.filter((c) => c.limitedMusicalMaterial)
  if (limited.length) {
    limits.push({ code: 'limited-material',
      detail: `${limited.length} son(s) à matériau limité utilisés en texture : ${limited.map((c) => c.soundId).join(', ')}` })
  }
  const historical = all.filter((c) => c.historicalSensitivity)
  if (historical.length) {
    adaptations.push({ role: 'texture', sourceId: null,
      reason: `sons historiquement sensibles utilisés musicalement (politique v2, décision propriétaire) : `
        + historical.map((c) => c.soundId).join(', ') })
  }

  return { roles, adaptations, limits }
}
