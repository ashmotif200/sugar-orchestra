/**
 * Contenu éditorial du parcours visiteur.
 *
 * Avant cette version, le visiteur n'affichait que `catalog.name` (« Volcan
 * eruption ») : aucune requête de contenu n'existait côté visiteur, et
 * `/api/content` est réservé à l'administration. On lit ici la seule route
 * publique, qui ne sert que du contenu PUBLIÉ.
 *
 * Repli silencieux : si rien n'est publié, ou si le serveur est absent, le
 * parcours garde les titres du catalogue et les crédits. Aucun champ vide n'est
 * affiché.
 */
export interface EditorialEntry {
  soundId: string
  title: string | null
  shortDesc: string | null
  story: string | null
  pedagogy: string | null
  sources: string | null
}

let cache: Map<string, EditorialEntry> | null = null
let inflight: Promise<Map<string, EditorialEntry>> | null = null
let state: { applied: boolean; publicationId: number | null; note: string | null } = {
  applied: false, publicationId: null, note: null,
}

export const editorialState = () => state

export function loadEditorial(locale = 'fr'): Promise<Map<string, EditorialEntry>> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = fetch(`/api/v2/public/content?locale=${locale}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      const map = new Map<string, EditorialEntry>()
      for (const item of body?.items ?? []) map.set(item.soundId, item as EditorialEntry)
      state = {
        applied: !!body?.applied,
        publicationId: body?.publicationId ?? null,
        note: body?.note ?? null,
      }
      cache = map
      return map
    })
    .catch(() => {
      cache = new Map()
      state = { applied: false, publicationId: null, note: 'serveur indisponible — titres du catalogue' }
      return cache
    })
    .finally(() => { inflight = null })
  return inflight
}

export const editorialFor = (soundId: string): EditorialEntry | null => cache?.get(soundId) ?? null

/** Vide le cache : utile après une publication appliquée. */
export function resetEditorial(): void { cache = null }
