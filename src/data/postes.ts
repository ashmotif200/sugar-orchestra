/**
 * Postes physiques de la démonstration.
 *
 * Séparation volontaire des responsabilités :
 *   - le POSTE (ce fichier) : identifiant, QR, titre, description éditable ;
 *   - le SAMPLE (catalogue) : code, fichier audio, crédits, licence ;
 *   - l'ÉTAT DE COLLECTE (session visiteur) : quels samples sont dans le carnet.
 * La description est facultative : absente, l'écran affiche « Description à venir »
 * et n'invente aucun texte historique.
 */
import config from '../../config/postes.json'

export interface Poste {
  id: number
  qr: string
  sampleCode: string
  title: string
  description: string | null
}

export const POSTES: Poste[] = (config.postes as Poste[]).slice().sort((a, b) => a.id - b.id)

export const posteById = (id: number): Poste | undefined => POSTES.find((p) => p.id === id)
export const posteByQr = (qr: string): Poste | undefined => POSTES.find((p) => p.qr === qr)
export const posteBySample = (code: string): Poste | undefined => POSTES.find((p) => p.sampleCode === code)

/** Résout une charge de QR : « poste-3 », « 3 » ou un code sample. */
export function resolveQr(payload: string): Poste | undefined {
  const raw = decodeURIComponent(payload.trim())
  const byQr = posteByQr(raw)
  if (byQr) return byQr
  if (/^\d+$/.test(raw)) return posteById(Number(raw))
  return posteBySample(raw)
}
