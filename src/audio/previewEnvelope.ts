/**
 * Fenêtre et enveloppe de la préécoute d'un sample.
 *
 * Extrait de `audio/service.ts` pour une raison précise : le test de
 * non-régression (`?audiotest=1`) doit vérifier **le code réellement exécuté à la
 * lecture**, pas une copie. Une copie aurait divergé au premier changement.
 *
 * Ces deux fonctions sont pures : elles ne touchent ni au contexte, ni au réseau.
 */

/** Niveau maximal de la préécoute. */
export const PREVIEW_PEAK = 0.9

/** Fondu d'entrée, en secondes. Assez court pour ne pas manger une attaque. */
export const FADE_IN = 0.03

/** Fondu de sortie, en secondes. */
export const FADE_OUT = 0.4

export interface PreviewWindow {
  /** Où commencer dans le buffer. */
  offset: number
  /** Combien de temps jouer. */
  duration: number
}

/**
 * Calcule la portion à jouer.
 *
 * On démarre sur la première attaque mesurée quand elle existe, sans jamais
 * dépasser la fin du buffer ; à défaut, au début. La durée est bornée par la
 * longueur restante : demander 6 s sur un fichier de 5 s doit jouer 5 s, pas
 * échouer.
 */
export function previewWindow(
  bufferDuration: number,
  seconds: number,
  firstOnset?: number | null,
  startAt = 0,
): PreviewWindow {
  const onset = typeof firstOnset === 'number' && Number.isFinite(firstOnset) ? firstOnset : null
  const base = startAt > 0
    ? startAt
    : onset !== null
      ? Math.min(onset, Math.max(0, bufferDuration - seconds - 0.2))
      : 0
  const offset = Math.max(0, Math.min(base, Math.max(0, bufferDuration - 0.1)))
  const duration = Math.min(seconds, bufferDuration - offset)
  return { offset, duration }
}

/**
 * Applique l'enveloppe : montée en 30 ms, plateau, descente sur les 400 dernières
 * millisecondes. Sans la montée, un clic se produit sur une attaque ; sans la
 * descente, un `stop()` brutal produit le même clic.
 */
export function applyEnvelope(gain: AudioParam, t0: number, duration: number, peak = PREVIEW_PEAK): void {
  gain.setValueAtTime(0, t0)
  gain.linearRampToValueAtTime(peak, t0 + FADE_IN)
  gain.setValueAtTime(peak, t0 + Math.max(FADE_IN, duration - FADE_OUT))
  gain.linearRampToValueAtTime(0, t0 + duration)
}

/** Amplification maximale appliquée à un sample très faible (+18 dB). */
export const MAX_MAKEUP = 8

/**
 * Facteur d'égalisation vers un niveau d'écoute commun.
 *
 * Constat mesuré sur les huit samples : crêtes de 0,20 à 0,87 et RMS de −35 à
 * −20 dBFS, quand le morceau final est à −12,6 dBFS RMS. Un sample de 01_02 joué
 * tel quel est donc ~19 dB sous le morceau : sur le haut-parleur d'un téléphone,
 * cela s'entend comme un silence, alors que le fichier est parfaitement valide.
 *
 * On égalise **par la crête du fichier**, jamais par compression : la dynamique
 * interne de l'enregistrement est préservée et rien ne peut écrêter, puisque le
 * facteur est calculé depuis le maximum du signal lui-même. Les fichiers ne sont
 * pas modifiés — c'est un paramètre de lecture.
 *
 * Le facteur ne réduit jamais un son (jamais < 1) et plafonne à +18 dB, pour
 * qu'un fichier quasi muet ne devienne pas une explosion de bruit de fond.
 */
export function makeupFor(peak: number, target = PREVIEW_PEAK): number {
  if (!(peak > 0)) return 1
  const ideal = target / peak
  return Math.min(MAX_MAKEUP, Math.max(1, ideal))
}

/** Crête absolue d'un buffer (un seul passage, sans allocation). */
export function bufferPeak(buffer: AudioBuffer): number {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) {
      const v = data[i] < 0 ? -data[i] : data[i]
      if (v > peak) peak = v
    }
  }
  return peak
}

