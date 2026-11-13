export interface Session {
  universeId?: string
  discovered: string[]
  selected: string[]
  createdAt: number
  version: 2
}

const KEY = 'sugar-orchestra.session.v2'
const LEGACY_KEY = 'sugar-orchestra.session.v1'

/** Identifiants d'univers de la première version, avant le renommage. */
const LEGACY_UNIVERSES: Record<string, string> = {
  energetique: 'electro-sega',
  dansant: 'sega-trad',
  reveur: 'ambient-creole',
  detendu: 'segazz',
}

export const emptySession = (): Session => ({ discovered: [], selected: [], createdAt: Date.now(), version: 2 })

/**
 * Charge la session en la confrontant au catalogue courant. Une session peut
 * survivre à un redéploiement : les identifiants d'univers et de sons qui
 * n'existent plus sont écartés au lieu de bloquer la composition (c'est
 * exactement ce qui rendait « Réessayer » sans fin après le renommage des
 * univers).
 */
export function loadSession(knownUniverses: string[], knownSounds: string[]): Session {
  const read = (key: string) => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as Partial<Session>) : null
    } catch {
      return null
    }
  }
  const stored = read(KEY) ?? read(LEGACY_KEY)
  if (!stored) return emptySession()

  const universes = new Set(knownUniverses)
  let universeId = typeof stored.universeId === 'string' ? stored.universeId : undefined
  if (universeId && !universes.has(universeId)) universeId = LEGACY_UNIVERSES[universeId]
  if (universeId && !universes.has(universeId)) universeId = undefined

  const sounds = new Set(knownSounds)
  const keep = (list: unknown) => (Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && sounds.has(x)) : [])

  return {
    universeId,
    discovered: keep(stored.discovered),
    selected: keep(stored.selected),
    createdAt: typeof stored.createdAt === 'number' ? stored.createdAt : Date.now(),
    version: 2,
  }
}

/**
 * Supprime la clé de la première version, une fois que la version courante a
 * bien été écrite. Volontairement hors de `loadSession` : cette fonction est
 * appelée deux fois par React en mode strict, et y supprimer la clé faisait
 * que le second appel repartait d'une session vide.
 */
export function purgeLegacyKey() {
  try {
    if (localStorage.getItem(LEGACY_KEY)) localStorage.removeItem(LEGACY_KEY)
  } catch { /* ignore */ }
}

export function saveSession(s: Session) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* quota / navigation privée */ }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* ignore */ }
}
