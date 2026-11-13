/**
 * Politique d'usage musical — version 2.
 *
 * DÉCISION DU PROPRIÉTAIRE (13/11/2026) : les restrictions qui empêchaient
 * certains enregistrements d'être sélectionnés et utilisés musicalement sont
 * supprimées. L'ancienne exclusion reposait sur la sensibilité historique du son
 * (chaînes, fouet, mémoires d'esclavage), pas sur un problème de droits.
 *
 * Ce que cette politique NE fait PAS :
 *   - elle ne supprime aucune métadonnée : `sensitive` reste vrai et reste affiché
 *     comme information éditoriale et historique, avec sa provenance ;
 *   - elle ne lève aucun contrôle de droits, de licence, de fichier manquant ou
 *     corrompu, ni aucune autorisation de publication ;
 *   - elle ne s'applique pas à la production : le bundle public n'est modifié que
 *     par une publication explicite.
 *
 * Un son peut donc être musicalement utilisable ET signalé comme sensible : les
 * deux informations sont indépendantes et ne doivent pas être confondues dans
 * l'interface.
 */
import type { Sound } from '../audio/types'

export const MUSICAL_POLICY_VERSION = 2

export type MusicalUse =
  /** utilisable dans une composition */
  | 'allowed'
  /** refusé : pas de fichier audio exploitable — contrôle technique, pas éditorial */
  | 'blocked_missing_audio'

/**
 * Le seul motif de refus musical restant : l'absence de fichier audio.
 * La sensibilité et `not_musical` ne bloquent plus rien — ils orientent
 * seulement le choix des rôles dans le moteur V2.
 */
export function musicalUse(sound: Pick<Sound, 'file'> | null | undefined): MusicalUse {
  if (!sound || !sound.file) return 'blocked_missing_audio'
  return 'allowed'
}

export const isMusicallyUsable = (sound: Pick<Sound, 'file'> | null | undefined): boolean =>
  musicalUse(sound) === 'allowed'

/**
 * Informations conservées pour l'affichage et pour le moteur V2 : elles ne
 * bloquent pas, elles qualifient.
 */
export function editorialNotes(sound: Pick<Sound, 'sensitive' | 'availability'>) {
  const historical = sound.sensitive === true
  const notMusical = sound.availability === 'not_musical'
  return {
    historicalSensitivity: historical,
    /** le son n'a pas de hauteur ni de rythme exploitable : oriente vers texture */
    limitedMusicalMaterial: notMusical,
    /** message à afficher, jamais un cadenas */
    label: historical
      ? 'son sensible — information historique, usage musical autorisé'
      : notMusical
        ? 'matériau peu musical — orienté texture dans les compositions'
        : null,
  }
}
