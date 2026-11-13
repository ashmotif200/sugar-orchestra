export interface Session {
  universeId?: string
  discovered: string[]
  selected: string[]
  createdAt: number
  version: 1
}

const KEY = 'sugar-orchestra.session.v1'

export const emptySession = (): Session => ({ discovered: [], selected: [], createdAt: Date.now(), version: 1 })

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptySession()
    const p = JSON.parse(raw) as Partial<Session>
    if (!p || p.version !== 1 || !Array.isArray(p.discovered) || !Array.isArray(p.selected)) return emptySession()
    return {
      universeId: typeof p.universeId === 'string' ? p.universeId : undefined,
      discovered: p.discovered.filter((x): x is string => typeof x === 'string'),
      selected: p.selected.filter((x): x is string => typeof x === 'string'),
      createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
      version: 1,
    }
  } catch {
    return emptySession()
  }
}

export function saveSession(s: Session) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* quota / private mode */ }
}

export function clearSession() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
