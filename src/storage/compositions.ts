/**
 * Persistance locale des compositions (IndexedDB).
 *
 * Pourquoi IndexedDB et pas localStorage : un rendu de 36 s en 48 kHz stéréo pèse
 * ~7 Mo en WAV, bien au-delà du quota localStorage (~5 Mo pour tout l'origine), et
 * localStorage est synchrone. IndexedDB stocke des ArrayBuffer sans sérialisation
 * base64 et ne bloque pas le rendu.
 *
 * Deux contextes strictement séparés :
 *   - 'visitor'    : ce que le visiteur vient de composer (restauré après refresh)
 *   - 'admin-test' : les rendus de test du Super Admin
 * Aucune lecture croisée : le parcours public ne voit jamais les compositions de
 * test, et l'administration ne réécrit jamais la composition d'un visiteur.
 *
 * Politique de rétention : 3 compositions par contexte, et un budget global de
 * 48 Mo au-delà duquel les plus anciennes sont évincées. Le but est qu'un poste de
 * démonstration ne se remplisse jamais silencieusement.
 */

const DB_NAME = 'sugar-orchestra.compositions'
const DB_VERSION = 1
const STORE = 'compositions'

export const MAX_PER_CONTEXT = 3
export const MAX_TOTAL_BYTES = 48 * 1024 * 1024

/**
 * Le moteur n'expose pas de numéro de version. Cette constante est donc la
 * version *déclarée* des rendus enregistrés : à incrémenter dès que
 * src/engine change, pour qu'une composition restaurée puisse être identifiée
 * comme produite par une autre génération du moteur.
 */
export const ENGINE_VERSION = 'src/engine@1'

export type CompositionContext = 'visitor' | 'admin-test'

export interface CompositionRecord {
  id: string
  context: CompositionContext
  createdAt: number
  universeId: string
  engineVersion: string
  catalogVersion: number | null
  seed: number | null
  durationS: number
  /** ce que la composition a réellement consommé, pour la traçabilité */
  soundRefs: { id: string; file: string | null }[]
  /** arrangement complet (sérialisable) */
  score: unknown
  /** rapport de rendu (sérialisable) */
  report: unknown
  /** WAV final, tel que téléchargé */
  wav: ArrayBuffer
  bytes: number
  schema: 1
}

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible dans ce navigateur'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('context', 'context')
        store.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('ouverture IndexedDB refusée'))
    req.onblocked = () => reject(new Error('IndexedDB bloquée par un autre onglet'))
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB: opération refusée'))
  }))
}

const newId = () =>
  `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export interface SaveInput {
  context: CompositionContext
  universeId: string
  durationS: number
  score: unknown
  report: unknown
  wav: ArrayBuffer
  soundRefs: { id: string; file: string | null }[]
  catalogVersion?: number | null
  seed?: number | null
}

export async function saveComposition(input: SaveInput): Promise<CompositionRecord> {
  const record: CompositionRecord = {
    id: newId(),
    context: input.context,
    createdAt: Date.now(),
    universeId: input.universeId,
    engineVersion: ENGINE_VERSION,
    catalogVersion: input.catalogVersion ?? null,
    seed: input.seed ?? null,
    durationS: input.durationS,
    soundRefs: input.soundRefs,
    score: input.score,
    report: input.report,
    wav: input.wav,
    bytes: input.wav.byteLength,
    schema: 1,
  }
  await run('readwrite', (s) => s.put(record))
  await prune()
  return record
}

export async function listCompositions(
  context: CompositionContext, limit = MAX_PER_CONTEXT,
): Promise<CompositionRecord[]> {
  const all = await run<CompositionRecord[]>('readonly', (s) => s.getAll() as IDBRequest<CompositionRecord[]>)
  return all
    .filter((r) => r.context === context)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
}

export async function latestComposition(context: CompositionContext): Promise<CompositionRecord | null> {
  const rows = await listCompositions(context, 1)
  return rows[0] ?? null
}

export async function getComposition(id: string): Promise<CompositionRecord | null> {
  const r = await run<CompositionRecord | undefined>('readonly', (s) => s.get(id) as IDBRequest<CompositionRecord | undefined>)
  return r ?? null
}

export async function removeComposition(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export async function clearCompositions(context: CompositionContext): Promise<void> {
  const rows = await run<CompositionRecord[]>('readonly', (s) => s.getAll() as IDBRequest<CompositionRecord[]>)
  const doomed = rows.filter((r) => r.context === context)
  for (const r of doomed) await removeComposition(r.id)
}

/** Évince les plus anciennes : 3 par contexte, puis budget global. */
async function prune(): Promise<void> {
  const all = await run<CompositionRecord[]>('readonly', (s) => s.getAll() as IDBRequest<CompositionRecord[]>)
  const byContext = new Map<CompositionContext, CompositionRecord[]>()
  for (const r of all) {
    const arr = byContext.get(r.context) ?? []
    arr.push(r)
    byContext.set(r.context, arr)
  }
  const doomed: CompositionRecord[] = []
  for (const rows of byContext.values()) {
    rows.sort((a, b) => b.createdAt - a.createdAt)
    doomed.push(...rows.slice(MAX_PER_CONTEXT))
  }
  let kept = all.filter((r) => !doomed.includes(r))
  let total = kept.reduce((n, r) => n + r.bytes, 0)
  kept = kept.sort((a, b) => b.createdAt - a.createdAt)
  for (const r of kept) {
    if (total <= MAX_TOTAL_BYTES) break
    if (byContext.get(r.context)!.length <= 1) continue // toujours garder la dernière de chaque contexte
    doomed.push(r)
    total -= r.bytes
  }
  for (const r of doomed) await removeComposition(r.id)
}

/** Diagnostic lisible depuis la console : ce qui est réellement stocké. */
export async function storageSummary(): Promise<{ context: CompositionContext; count: number; mb: number }[]> {
  const all = await run<CompositionRecord[]>('readonly', (s) => s.getAll() as IDBRequest<CompositionRecord[]>)
  const out: { context: CompositionContext; count: number; mb: number }[] = []
  for (const ctx of ['visitor', 'admin-test'] as CompositionContext[]) {
    const rows = all.filter((r) => r.context === ctx)
    out.push({ context: ctx, count: rows.length, mb: Math.round((rows.reduce((n, r) => n + r.bytes, 0) / 1048576) * 10) / 10 })
  }
  return out
}
