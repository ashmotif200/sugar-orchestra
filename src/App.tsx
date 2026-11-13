import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { audio, catalog, soundById, stepSounds, titleOf } from './audio/service'
import { t } from './i18n'
import { useRoute } from './router'
import { clearSession, emptySession, loadSession, saveSession, type Session } from './session'
import { getUniverse, UNIVERSES } from './engine/universes'
import { Button } from './ui/kit'
import Home from './ui/screens/Home'
import Parcours from './ui/screens/Parcours'
import Step from './ui/screens/Step'
import Carnet from './ui/screens/Carnet'
import Composer, { type Piece } from './ui/screens/Composer'
import Result from './ui/screens/Result'
import SelfTest from './ui/SelfTest'

// Le Super Admin est chargé à la demande : un visiteur ne télécharge jamais le
// code d'administration, et la promesse « tout fonctionne hors ligne » du parcours
// reste intacte.
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  const selftest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('selftest')
  const [route, navigate] = useRoute()
  const [session, setSession] = useState<Session>(() =>
    loadSession(
      // seuls les univers réellement implémentés peuvent survivre à un
      // rechargement : un univers « Bientôt » ne doit pas bloquer la composition
      UNIVERSES.filter((u) => u.available).map((u) => u.id),
      catalog.sounds.map((s) => s.id),
    ),
  )
  const [piece, setPiece] = useState<Piece | null>(null)
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  useEffect(() => { saveSession(session) }, [session])
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const discover = useCallback((id: string) => {
    setSession((s) => (s.discovered.includes(id) ? s : { ...s, discovered: [...s.discovered, id] }))
  }, [])

  const toggle = useCallback((id: string) => {
    const sound = soundById(id)
    if (sound && (sound.sensitive || sound.availability === 'not_musical')) return // jamais en musique
    setSession((s) => {
      const has = s.selected.includes(id)
      if (has) return { ...s, selected: s.selected.filter((x) => x !== id) }
      if (s.selected.length >= (catalog.limits?.maxSelected ?? 8)) return s
      return { ...s, selected: [...s.selected, id], discovered: s.discovered.includes(id) ? s.discovered : [...s.discovered, id] }
    })
  }, [])

  const pickUniverse = (id: string) => setSession((s) => ({ ...s, universeId: id }))

  const restart = () => {
    audio.stopPiece()
    audio.stopPreview()
    clearSession()
    setSession(emptySession())
    setPiece(null)
    navigate({ name: 'home' })
  }

  const start = () => {
    if (!session.universeId) pickUniverse(UNIVERSES[0].id)
    navigate({ name: 'parcours' })
  }

  /* clavier : espace = écoute/pause, flèches = étapes (poste de démo) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        if (route.name === 'result' && piece) { e.preventDefault(); navigate(route) }
      }
      if (route.name === 'step' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const next = route.id + (e.key === 'ArrowRight' ? 1 : -1)
        if (next >= 1 && next <= (catalog.steps?.length ?? 7)) navigate({ name: 'step', id: next })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route, piece, navigate])

  const selectedSounds = useMemo(
    () => session.selected.map(soundById).filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [session.selected],
  )

  const steps = catalog.steps ?? []
  const universe = getUniverse(session.universeId)

  if (selftest) return <SelfTest />

  if (route.name === 'admin') {
    return (
      <Suspense fallback={<div className="adm-boot"><p>Chargement de l’administration…</p></div>}>
        <AdminApp
          section={route.section}
          navigate={(hash) => { window.location.hash = hash.startsWith('#') ? hash.slice(1) : hash }}
        />
      </Suspense>
    )
  }

  const rail = (
    <nav className="rail" aria-label={t('parcours.title')}>
      <p className="rail-title">{t('parcours.title')}</p>
      <ol>
        {steps.map((st) => {
          const sounds = stepSounds(st.id)
          const found = sounds.filter((s) => session.discovered.includes(s.id)).length
          const state = found === 0 ? 'todo' : found === sounds.length ? 'done' : 'doing'
          const active = route.name === 'step' && route.id === st.id
          return (
            <li key={st.id}>
              <button
                className={`rail-item is-${state}${active ? ' is-active' : ''}`}
                onClick={() => navigate({ name: 'step', id: st.id })}
                aria-current={active ? 'step' : undefined}
              >
                <span className="rail-num">{found === sounds.length && sounds.length > 0 ? '✓' : st.id}</span>
                <span className="rail-label">{st.short}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )

  const sideCarnet = (
    <aside className="side" aria-label={t('carnet.title')}>
      <p className="rail-title">{t('carnet.title')} <span className="count">{selectedSounds.length}</span></p>
      {selectedSounds.length === 0 ? (
        <p className="micro">{t('carnet.emptySelected')}</p>
      ) : (
        <ul className="side-list">
          {selectedSounds.map((s) => (
            <li key={s.id}>
              <span className="tick">✓</span>
              <span className="side-name">{titleOf(s)}</span>
              <button className="side-remove" onClick={() => toggle(s.id)} aria-label={`${t('step.remove')} ${titleOf(s)}`}>×</button>
            </li>
          ))}
        </ul>
      )}
      <Button wide disabled={selectedSounds.length === 0} onClick={() => navigate({ name: 'composer' })}>
        {selectedSounds.length ? t('carnet.compose', { n: selectedSounds.length, s: selectedSounds.length > 1 ? 's' : '' }) : t('carnet.composeZero')}
      </Button>
      {selectedSounds.length === 0 && <p className="micro" style={{ marginTop: 8 }}>{t('carnet.composeEmpty')}</p>}
      <button className="rail-link" onClick={() => navigate({ name: 'carnet' })}>{t('carnet.title')} ›</button>
    </aside>
  )

  return (
    <div className={`app route-${route.name}`}>
      <a className="skip" href="#main">{t('a11y.skip')}</a>

      <header className="topbar">
        <button className="brand" onClick={() => navigate({ name: 'home' })}>
          <span className="brand-mark" aria-hidden="true">▮▮</span>
          <span className="brand-text">
            <span className="brand-name">{t('app.title')}</span>
            <span className="brand-museum">{t('app.museum')}</span>
          </span>
        </button>
        <div className="topbar-nav">
          <button className={`navlink${route.name === 'parcours' || route.name === 'step' ? ' is-active' : ''}`} onClick={() => navigate({ name: 'parcours' })}>
            {t('parcours.title')}
          </button>
          <button className={`navlink${route.name === 'carnet' ? ' is-active' : ''}`} onClick={() => navigate({ name: 'carnet' })}>
            {t('carnet.title')}
            {selectedSounds.length > 0 && <span className="count">{selectedSounds.length}</span>}
          </button>
          {universe && <span className="universe-chip" style={{ background: universe.fill ?? universe.accent, color: universe.id === 'sega-trad' ? 'var(--ink)' : '#fffaf0' }}>{universe.name}</span>}
        </div>
      </header>

      {offline && <div className="offline" role="status">{t('offline.banner')}</div>}

      <div className="layout">
        {route.name !== 'home' && route.name !== 'result' && rail}

        <main id="main" className="content">
          {route.name === 'home' && (
            <Home
              universeId={session.universeId}
              onPick={(u) => pickUniverse(u.id)}
              onStart={start}
              resumeCount={session.selected.length}
              onResume={() => navigate({ name: 'carnet' })}
            />
          )}

          {route.name === 'parcours' && (
            <Parcours session={session} onOpen={(id) => navigate({ name: 'step', id })} />
          )}

          {route.name === 'step' && (
            <Step
              stepId={route.id}
              session={session}
              onDiscover={discover}
              onToggle={toggle}
              onBack={() => navigate({ name: 'parcours' })}
              onNext={() => {
                const next = Math.min((catalog.steps?.length ?? 7), route.id + 1)
                navigate(next === route.id ? { name: 'carnet' } : { name: 'step', id: next })
              }}
            />
          )}

          {route.name === 'carnet' && (
            <Carnet
              session={session}
              onToggle={toggle}
              onCompose={() => navigate({ name: 'composer' })}
              onParcours={() => navigate({ name: 'parcours' })}
              onPreview={(id) => {
                const s = soundById(id)
                if (s) void audio.ensure([id]).then(() => audio.preview(s)).catch(() => {})
              }}
            />
          )}

          {route.name === 'composer' && (
            session.selected.length === 0 ? (
              <div className="screen">
                <h1 className="h1">{t('carnet.composeEmpty')}</h1>
                <p className="sub">{t('carnet.emptySelectedHint')}</p>
                <div className="row-actions">
                  <Button onClick={() => navigate({ name: 'carnet' })}>{t('carnet.title')}</Button>
                  <Button variant="secondary" onClick={() => navigate({ name: 'parcours' })}>{t('carnet.goParcours')}</Button>
                </div>
              </div>
            ) : !session.universeId || !getUniverse(session.universeId)?.available ? (
              <div className="screen">
                <h1 className="h1">{t('composer.chooseUniverse')}</h1>
                <p className="sub">
                  {session.selected.length} son{session.selected.length > 1 ? 's' : ''} dans ma musique.
                </p>
                <div className="uni-grid">
                  {UNIVERSES.filter((u) => u.available).map((u) => (
                    <button
                      key={u.id}
                      className="uni-card"
                      style={{ background: u.fill ?? u.accent, color: u.id === 'sega-trad' ? 'var(--ink)' : '#fffaf0' }}
                      onClick={() => pickUniverse(u.id)}
                    >
                      <span className="uni-name">{u.name}</span>
                      <span className="uni-emotion">{u.emotion}</span>
                    </button>
                  ))}
                </div>
                <div className="row-actions">
                  <Button variant="ghost" onClick={() => navigate({ name: 'carnet' })}>{t('result.back')}</Button>
                </div>
              </div>
            ) : (
              <Composer
                session={session}
                onDone={(p) => { setPiece(p); navigate({ name: 'result' }) }}
                onCancel={() => navigate({ name: 'carnet' })}
              />
            )
          )}

          {route.name === 'result' && (
            piece ? (
              <Result piece={piece} onRestart={restart} onCarnet={() => navigate({ name: 'carnet' })} />
            ) : (
              <div className="screen">
                <h1 className="h1">{t('result.title')}</h1>
                <p className="sub">{t('result.gone')}</p>
                <div className="row-actions">
                  <Button onClick={() => navigate({ name: 'composer' })}>{t('result.recompose')}</Button>
                  <Button variant="secondary" onClick={() => navigate({ name: 'carnet' })}>{t('result.back')}</Button>
                </div>
              </div>
            )
          )}
        </main>

        {route.name !== 'home' && route.name !== 'result' && route.name !== 'composer' && sideCarnet}
      </div>
    </div>
  )
}
