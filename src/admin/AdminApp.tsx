import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError, type Me } from './api'
import { clearAsyncCache, Dashboard, Sounds } from './panels'
import { Content, Steps, Music, Developer, Users, Settings } from './panels2'
import './admin.css'

export type Navigate = (hash: string) => void

const SECTIONS = [
  { id: 'dashboard', label: 'Tableau de bord', glyph: '◱', perm: 'sounds.read' },
  { id: 'sounds', label: 'Bibliothèque sonore', glyph: '◉', perm: 'sounds.read' },
  { id: 'content', label: 'Contenus & histoires', glyph: '¶', perm: 'content.read' },
  { id: 'steps', label: 'Étapes du musée', glyph: '⇥', perm: 'steps.read' },
  { id: 'music', label: 'Studio musical', glyph: '∫', perm: 'music.read' },
  { id: 'developer', label: 'Outils développeur', glyph: '⌘', perm: 'dev.use' },
  { id: 'users', label: 'Comptes & rôles', glyph: '☗', perm: 'users.read' },
  { id: 'settings', label: 'Système', glyph: '⚙', perm: 'system.read' },
] as const

export default function AdminApp({ section, navigate }: { section: string; navigate: Navigate }) {
  const [me, setMe] = useState<Me | null>(null)
  const [state, setState] = useState<'loading' | 'anon' | 'ready'>('loading')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api.get<Me>('/api/auth/me')
      setMe(data)
      setState('ready')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setState('anon'); return }
      setError(e instanceof Error ? e.message : 'API indisponible')
      setState('anon')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const logout = async () => {
    try { await api.send('POST', '/api/auth/logout') } catch { /* session already gone */ }
    clearAsyncCache() // aucune donnée du compte précédent ne doit survivre à la déconnexion
    setMe(null)
    setState('anon')
    navigate('#/admin/login')
  }

  const allowed = useMemo(
    () => SECTIONS.filter((s) => me?.permissions.includes(s.perm)),
    [me],
  )

  if (state === 'loading') {
    return <div className="adm-boot"><p>Chargement de l’administration…</p></div>
  }

  if (state === 'anon') {
    return <Login onDone={load} apiDown={error} navigate={navigate} />
  }

  const active = section === 'login' || !section ? 'dashboard' : section
  const known = allowed.some((s) => s.id === active)

  return (
    <div className="adm">
      <aside className="adm-side">
        <a className="adm-brand" href="#/" onClick={(e) => { e.preventDefault(); navigate('#/') }}>
          <span className="adm-brand-mark">SO</span>
          <span>
            <b>Sugar Orchestra</b>
            <i>Super Admin</i>
          </span>
        </a>
        <nav>
          {allowed.map((s) => (
            <button
              key={s.id}
              className={`adm-nav ${active === s.id ? 'is-on' : ''}`}
              onClick={() => navigate(`#/admin/${s.id}`)}
            >
              <span aria-hidden>{s.glyph}</span> {s.label}
            </button>
          ))}
        </nav>
        <div className="adm-user">
          <div>
            <b>{me?.user.name}</b>
            <i>{me?.user.role}</i>
          </div>
          <button className="adm-logout" onClick={() => void logout()}>Déconnexion</button>
        </div>
        <a className="adm-visitor" href="#/" onClick={(e) => { e.preventDefault(); navigate('#/') }}>
          ← Parcours visiteur
        </a>
      </aside>

      <main className="adm-main">
        {!known && (
          <div className="adm-card">
            <h2>Section inconnue ou non autorisée</h2>
            <p>« {active} » n’existe pas ou n’est pas accessible avec le rôle {me?.user.role}.</p>
          </div>
        )}
        {active === 'dashboard' && <Dashboard navigate={navigate} />}
        {active === 'sounds' && <Sounds />}
        {active === 'content' && <Content />}
        {active === 'steps' && <Steps />}
        {active === 'music' && <Music />}
        {active === 'developer' && <Developer />}
        {active === 'users' && <Users me={me} />}
        {active === 'settings' && <Settings />}
      </main>
    </div>
  )
}

function Login({ onDone, apiDown, navigate }: { onDone: () => void; apiDown: string | null; navigate: Navigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.send('POST', '/api/auth/login', { email, password })
      setPassword('')
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="adm-boot">
      <form className="adm-login" onSubmit={submit}>
        <h1>Sugar Orchestra</h1>
        <p className="adm-sub">Administration · L’Aventure du Sucre</p>

        {apiDown && (
          <p className="adm-alert" role="status">
            API indisponible : {apiDown}. Lancez <code>npm run admin:serve</code>.
          </p>
        )}

        <label>
          Adresse électronique
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="username" required autoFocus />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required />
        </label>
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="adm-primary" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        <p className="adm-hint">
          Aucun compte par défaut. Le premier administrateur est créé avec{' '}
          <code>npm run admin:provision -- --email …</code>
        </p>
        <button type="button" className="adm-link" onClick={() => navigate('#/')}>← Retour au parcours visiteur</button>
      </form>
    </div>
  )
}
