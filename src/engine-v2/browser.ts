/**
 * Point d'entrée navigateur du moteur V2.
 *
 * `plan.ts` reste pur (aucun import JSON), ce qui permet de le compiler tel quel
 * pour le script de démonstration côté Node. C'est ici, et seulement ici, que la
 * matrice de capacités bundlée est injectée.
 */
import matrixJson from '../data/capability-matrix.json'
import { setCapabilityMatrix, type CapabilityMatrix } from './capabilities'

setCapabilityMatrix(matrixJson as unknown as CapabilityMatrix)

export { buildPlan, summarisePlan, planDurationS, ENGINE_VERSION, type PlanInput } from './plan'
export { PROFILES, getProfile, MEASURED_PROFILES } from './profiles'
export { buildCapabilities, assignRoles, CAPABILITY_MATRIX_SOURCE } from './capabilities'
export type * from './types'
