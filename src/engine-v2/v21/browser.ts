/**
 * Point d'entrée navigateur V2.1 : injecte la matrice de capacités ET les trois
 * modèles de style, puis expose le planificateur.
 */
import matrixJson from '../../data/capability-matrix.json'
import electro from '../../data/style-electro-sega.json'
import dansant from '../../data/style-sega-trad.json'
import segazz from '../../data/style-segazz.json'
import { setCapabilityMatrix, type CapabilityMatrix } from '../capabilities'
import type { StyleModel } from './patterns'

setCapabilityMatrix(matrixJson as unknown as CapabilityMatrix)

const STYLES: Record<string, StyleModel> = {
  'electro-sega': electro as unknown as StyleModel,
  'sega-trad': dansant as unknown as StyleModel,
  segazz: segazz as unknown as StyleModel,
  // Rêveur n'a aucune référence validée : aucun modèle de style, et le plan le dit.
}

export const styleFor = (profileId: string): StyleModel | null => STYLES[profileId] ?? null
export { buildPlan21, summarise21, barsForDuration, ENGINE_VERSION_21 } from './plan'
export type { V21Plan, EngineMode, PlannedBassNote } from './plan'
export { BASS_TIMBRES, BASS_POLICIES } from './harmony'
export type { BassTimbre, BassSynthParams } from './harmony'
export { selectPatterns, isContinuous, cellSimilarity } from './patterns'
