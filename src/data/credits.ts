/**
 * Crédits de l'équipe — source unique.
 *
 * Seuls les prénoms sont consignés, par choix du propriétaire du projet. Aucun nom
 * de famille, aucune licence attribuée : les auteurs sont identifiés et leur accord
 * pour ce projet est confirmé, mais les conditions de la charte juridique Muséomix
 * restent à vérifier (voir docs/ASSET-LICENSES.md § 5).
 *
 * Ce module est la seule liste : l'interface, le README et la documentation s'y
 * réfèrent. Modifier un crédit ici, c'est le modifier partout.
 */

export interface Credit {
  role: string
  name: string
}

/** Équipe du projet, telle que validée par le propriétaire du projet. */
export const TEAM: Credit[] = [
  { role: 'Personnages et illustrations', name: 'Noémie' },
  { role: 'Développement et démonstration musicale', name: 'Ashley' },
  { role: 'Gestion et coordination', name: 'Tanguy' },
  { role: 'Contexte historique', name: 'Tejsree' },
  { role: 'Bornes de mapping', name: 'Keisa' },
]

/**
 * Contributions rattachées à une ressource précise. Elles ne doublonnent pas
 * l'équipe : ce sont des crédits d'œuvre, affichés avec le son ou le morceau.
 */
export const RESOURCE_CREDITS: Credit[] = [
  { role: 'Enregistrement du Lota', name: 'Tanguy' },
  { role: 'Composition du morceau final « Énergétique »', name: 'Martin' },
]

export const TEAM_TITLE = 'Équipe Sugar Orchestra — Muséomix 2026'
