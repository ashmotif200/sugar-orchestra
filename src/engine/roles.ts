import type { Role, Sound } from '../audio/types'
import { ROLES } from '../audio/types'

export interface Adaptation {
  role: Role
  sourceId: string
  reason: string
}

export interface RoleAssignment {
  /** ordered candidate list per role (first = preferred) */
  roles: Record<Role, Sound[]>
  adaptations: Adaptation[]
  /** honest statements about what this collection cannot do */
  limits: string[]
}

const byF0 = (a: Sound, b: Sound) => (a.analysis.f0Hz ?? 1e9) - (b.analysis.f0Hz ?? 1e9)
const byCentroid = (a: Sound, b: Sound) => b.analysis.centroidHz - a.analysis.centroidHz
const byOnset = (a: Sound, b: Sound) => b.analysis.onsetRate - a.analysis.onsetRate
const bySustain = (a: Sound, b: Sound) => b.analysis.sustainRatio - a.analysis.sustainRatio

/**
 * Every selected sound must end up in the piece (invariant 2), so roles are
 * filled from the validated role tags first, then by measured fallbacks. When a
 * role has no honest candidate we say so instead of inventing sources.
 */
export function assignRoles(sounds: Sound[]): RoleAssignment {
  const assignments = {} as Record<Role, Sound[]>
  const adaptations: Adaptation[] = []
  const limits: string[] = []
  const pitched = sounds.filter((s) => s.analysis.f0Hz !== null)
  const used = new Set<string>()

  for (const role of ROLES) {
    let list = sounds.filter((s) => s.roles.includes(role))
    if (role === 'bass' || role === 'melody') list = list.filter((s) => s.analysis.f0Hz !== null)
    list = [...list].sort(role === 'rhythm' ? byOnset : role === 'earcandy' ? byCentroid : role === 'texture' ? bySustain : byF0)
    assignments[role] = list
  }

  // --- fallbacks, with an explicit adaptation note (never silent) ---
  if (!assignments.bass.length) {
    const low = [...sounds].sort(byF0)[0]
    if (low && low.analysis.f0Hz !== null && low.analysis.f0Hz < 700) {
      assignments.bass = [low]
      adaptations.push({
        role: 'bass',
        sourceId: low.id,
        reason: `aucun son marqué « basse » : ${low.title ?? low.name} est descendu d'octave pour tenir la basse`,
      })
      used.add(low.id)
    } else {
      limits.push('Aucun son assez grave ou tonal dans cette sélection : pas de ligne de basse.')
    }
  }

  if (!assignments.melody.length) {
    const cand = [...pitched].sort((a, b) => a.analysis.centroidHz - b.analysis.centroidHz)[0]
    if (cand) {
      assignments.melody = [cand]
      adaptations.push({
        role: 'melody',
        sourceId: cand.id,
        reason: `aucun son marqué « mélodie » : ${cand.title ?? cand.name} est transposé pour porter le motif`,
      })
      used.add(cand.id)
    } else {
      limits.push('Aucun son tonal dans cette sélection : la pièce sera rythmique et texturale, sans mélodie chantée.')
    }
  }

  if (!assignments.rhythm.length) {
    const cand = [...sounds].sort(byOnset)[0]
    if (cand && cand.analysis.onsetRate > 0.6) {
      assignments.rhythm = [cand]
      adaptations.push({
        role: 'rhythm',
        sourceId: cand.id,
        reason: `aucun son marqué « rythmique » : les attaques de ${cand.title ?? cand.name} servent de frappe`,
      })
      used.add(cand.id)
    } else {
      limits.push('Aucune source franchement percussive : le tempo est porté par des textures pulsées.')
    }
  }

  if (!assignments.earcandy.length) {
    const cand = [...sounds].sort(byCentroid)[0]
    if (cand) {
      assignments.earcandy = [cand]
      adaptations.push({
        role: 'earcandy',
        sourceId: cand.id,
        reason: `aucun son marqué « ear candy » : ${cand.title ?? cand.name} fournit les éclats aigus`,
      })
    }
  }

  if (!assignments.texture.length) {
    const cand = [...sounds].sort(bySustain)[0]
    if (cand) {
      assignments.texture = [cand]
      adaptations.push({
        role: 'texture',
        sourceId: cand.id,
        reason: `aucun son marqué « texture » : ${cand.title ?? cand.name} est étiré en nappe granulaire`,
      })
    }
  }

  return { roles: assignments, adaptations, limits }
}

/** Ensure every selected sound appears somewhere in the role map. */
export function uncoveredSources(sounds: Sound[], a: RoleAssignment): Sound[] {
  const covered = new Set<string>()
  for (const role of ROLES) for (const s of a.roles[role]) covered.add(s.id)
  return sounds.filter((s) => !covered.has(s.id))
}
