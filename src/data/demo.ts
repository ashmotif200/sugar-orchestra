/**
 * Mode démonstration v0.1.
 *
 * La démo ne compose pas : elle joue un morceau précomposé fourni par le
 * propriétaire du projet. Le moteur de génération reste intact et disponible
 * (`demoMode.enabled = false` suffit à revenir au parcours réel).
 */
export const demoMode = {
  enabled: true,
  /** Fichier attendu dans public/demo/ — nom exact fourni par le propriétaire. */
  track: 'energetique v1.wav',
  /** Univers auquel ce morceau correspond (Martin — Énergétique / Electro Sega). */
  universeId: 'electro-sega',
} as const

export const demoTrackUrl = () => `${import.meta.env.BASE_URL}demo/${encodeURIComponent(demoMode.track)}`
