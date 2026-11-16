/**
 * Mode d'exécution de l'application.
 *
 * Deux façons de servir le même bundle :
 *   1. derrière l'API d'administration (dev, preview, serveur Super Admin) —
 *      l'état de publication et le contenu éditorial viennent de la base ;
 *   2. en hébergement purement statique (GitHub Pages) — il n'existe aucune API
 *      derrière la même origine. Les mêmes données sont alors lues dans les
 *      instantanés embarqués (`publication.json`, catalogue, `postes.json`).
 *
 * Le drapeau est fixé au BUILD, pas à l'exécution :
 *   npm run build:pages    → VITE_STATIC_HOSTING=1
 * Rien d'autre ne change : le parcours visiteur, les postes QR et les sons sont
 * identiques. Seules les fonctions d'administration disparaissent, faute de
 * serveur pour les authentifier.
 */
export const staticHosting = import.meta.env.VITE_STATIC_HOSTING === '1'
