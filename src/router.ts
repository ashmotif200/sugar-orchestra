import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'parcours' }
  | { name: 'step'; id: number }
  | { name: 'carnet' }
  | { name: 'composer' }
  | { name: 'result' }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/'
  const seg = path.split('/').filter(Boolean)
  if (seg[0] === 'parcours') return { name: 'parcours' }
  if (seg[0] === 'etape') {
    const id = parseInt(seg[1] ?? '', 10)
    return Number.isFinite(id) && id >= 1 && id <= 7 ? { name: 'step', id } : { name: 'parcours' }
  }
  if (seg[0] === 'carnet') return { name: 'carnet' }
  if (seg[0] === 'composer') return { name: 'composer' }
  if (seg[0] === 'resultat') return { name: 'result' }
  return { name: 'home' }
}

export const routeToHash = (r: Route): string => {
  switch (r.name) {
    case 'parcours': return '#/parcours'
    case 'step': return `#/etape/${r.id}`
    case 'carnet': return '#/carnet'
    case 'composer': return '#/composer'
    case 'result': return '#/resultat'
    default: return '#/'
  }
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = (r: Route) => {
    const h = routeToHash(r)
    if (window.location.hash === h) setRoute(r)
    else window.location.hash = h
  }
  return [route, navigate]
}
