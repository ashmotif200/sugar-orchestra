/**
 * Mode démonstration v0.1.
 *
 * La démo ne compose pas : elle joue un morceau précomposé fourni par le
 * propriétaire du projet. Le moteur de génération reste intact et disponible
 * (`demoMode.enabled = false` suffit à revenir au parcours réel).
 */
export const demoMode = {
  enabled: true,
  /** Fichier original fourni (conservé intact, non modifié). */
  track: 'energetique v1.wav',
  /**
   * Version de diffusion AAC-LC : Safari iOS ne décode pas le PCM 24 bits du
   * WAV fourni. Même mixage, même durée, même niveau — seul le conteneur change.
   */
  trackAac: 'energetique-v1.m4a',
  /** Univers auquel ce morceau correspond (Martin — Énergétique / Electro Sega). */
  universeId: 'electro-sega',
} as const

const base = () => import.meta.env.BASE_URL

/** Source principale : AAC dans un conteneur MP4. */
export const demoTrackUrl = () => `${base()}demo/${encodeURIComponent(demoMode.trackAac)}`

/** Repli : le WAV d'origine, pour les navigateurs qui le décodent. */
export const demoTrackFallbackUrl = () => `${base()}demo/${encodeURIComponent(demoMode.track)}`
