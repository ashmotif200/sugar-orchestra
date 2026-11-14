/**
 * État de publication lu par le parcours visiteur.
 *
 * SOURCE UNIQUE : la table `universes` et `sounds` de data/admin/sugar.db.
 * Deux chemins vers la même donnée, dans cet ordre :
 *   1. l'API d'administration (`/api/v2/public/catalog-state`), si joignable ;
 *   2. l'instantané `publication.json`, exporté depuis cette même base
 *      (`node scripts/admin/export-publication.mjs`), pour la démo hors ligne.
 *
 * Règle unique, identique pour les mascottes et pour les sons :
 *   univers disponible = publié ET moteur implémenté ;
 *   son disponible     = publié.
 * Rien n'est codé en dur dans les écrans : un passage en brouillon dans
 * l'administration retire l'univers de la sélection au chargement suivant.
 */
import snapshot from './publication.json'

export interface UniverseState {
  id: string
  status: string
  engineImplemented: boolean
}
export interface SoundState {
  code: string
  status: string
  availability?: string
}
export interface CatalogState {
  universes: UniverseState[]
  sounds: SoundState[]
  origin: 'live' | 'snapshot'
}

const snapshotState: CatalogState = {
  universes: snapshot.universes as UniverseState[],
  sounds: snapshot.sounds as SoundState[],
  origin: 'snapshot',
}

let current: CatalogState = snapshotState
let inflight: Promise<CatalogState> | null = null
const listeners = new Set<() => void>()

/** Notifie React quand l'état live arrive (ou change). */
export function subscribePublication(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const emit = () => listeners.forEach((fn) => fn())

export const catalogState = (): CatalogState => current

/** Charge l'état live une seule fois ; en cas d'échec on garde l'instantané. */
export function ensurePublication(): Promise<CatalogState> {
  if (inflight) return inflight
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => ctrl?.abort(), 3000)
  inflight = fetch('/api/v2/public/catalog-state', { signal: ctrl?.signal, headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      if (!body || !Array.isArray(body.universes) || !Array.isArray(body.sounds)) return current
      current = {
        universes: body.universes.map((u: { id: string; status: string; engineImplemented: boolean }) => ({
          id: u.id,
          status: u.status,
          engineImplemented: !!u.engineImplemented,
        })),
        sounds: body.sounds.map((s: { code: string; status: string; availability?: string }) => ({
          code: s.code,
          status: s.status,
          availability: s.availability,
        })),
        origin: 'live',
      }
      emit()
      return current
    })
    .catch(() => current)
    .finally(() => clearTimeout(timer))
  return inflight
}

/** Un univers est proposable seulement s'il est publié ET réellement jouable. */
export function isUniverseOpen(id: string): boolean {
  const row = current.universes.find((u) => u.id === id)
  return !!row && row.status === 'published' && row.engineImplemented
}

/** Un son est utilisable seulement s'il est publié dans l'administration. */
export function isSoundOpen(code: string): boolean {
  const row = current.sounds.find((s) => s.code === code)
  return !!row && row.status === 'published'
}

export const publicationOrigin = () => current.origin

/* Hook React : re-rend quand l'état live arrive. Isolé ici pour que les écrans
   n'aient qu'un seul import à faire. */
import { useEffect, useState } from 'react'
export function usePublication(): CatalogState {
  const [state, setState] = useState<CatalogState>(current)
  useEffect(() => subscribePublication(() => setState(current)), [])
  return state
}
