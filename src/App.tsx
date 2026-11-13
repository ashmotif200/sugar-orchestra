import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { catalog, audio, soundById, type PlayHandle } from './audio/service'
import type { Sound, Universe } from './audio/types'
import { ROLE_LABEL } from './audio/types'
import { UNIVERSES, getUniverse } from './engine/universes'
import { buildScore, type Score } from './engine/plan'
import type { RenderReport } from './engine/render'
import SelfTest from './ui/SelfTest'

type Step = 'home' | 'explore' | 'composing' | 'result'

interface Session {
  universeId: string | null
  selected: string[]
  step: Step
}

const STORAGE_KEY = 'sugar-orchestra.session.v1'
const { minSelected, maxSelected } = catalog.limits

function loadSession(): Session {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Session
      if (p && Array.isArray(p.selected)) return { universeId: p.universeId ?? null, selected: p.selected, step: p.step === 'result' ? 'explore' : p.step ?? 'home' }
    }
  } catch { /* private mode or corrupt state: start fresh */ }
  return { universeId: null, selected: [], step: 'home' }
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

const isPlaceholder = catalog.source === 'placeholder-synth'
const playableCount = catalog.sounds.filter((s) => s.inDemoSet !== false).length

/* ------------------------------------------------------------------ bits -- */

function DemoBanner() {
  if (isPlaceholder) {
    return (
      <div className="banner">
        <b>Démo</b>
        <span>
          Jeu de sons de substitution synthétisé pour la démo technique. Les 40 WAV du musée n'ont pas été fournis avec le
          briefing ; les crédits affichés seront remplacés par ceux de l'Inventaire.
        </span>
      </div>
    )
  }
  const demoCount = catalog.demoSet?.length ?? catalog.sounds.length
  if (demoCount >= catalog.sounds.length) return null
  return (
    <div className="banner">
      <b>Démo</b>
      <span>
        {demoCount} sons sur {catalog.sounds.length} sont proposés ici. Les autres restent au catalogue avec leurs crédits ;
        la séquence « Une histoire façonnée par le sucre » (fouet, fers, chaînes) est écartée en attendant validation
        muséale.
      </span>
    </div>
  )
}

function UniverseCard({ u, onPick }: { u: Universe; onPick: (u: Universe) => void }) {
  return (
    <button
      className="uni"
      style={{ ['--u' as string]: u.accent }}
      disabled={!u.available}
      onClick={() => onPick(u)}
      aria-label={`${u.emotion} — ${u.style}${u.available ? '' : ' (bientôt disponible)'}`}
    >
      <span className="glyph" aria-hidden="true">{u.glyph}</span>
      <span className="emotion">{u.emotion}</span>
      <span className="style">{u.style}</span>
      <span className="tempo">{u.available ? u.tempoLabel : 'bientôt — non implémenté'}</span>
    </button>
  )
}

function SoundRow({
  sound,
  collected,
  full,
  onToggle,
  playingId,
  onPreview,
}: {
  sound: Sound
  collected: boolean
  full: boolean
  onToggle: () => void
  playingId: string | null
  onPreview: () => void
}) {
  const playing = playingId === sound.id
  return (
    <div className={`row${collected ? ' collected' : ''}`}>
      <button
        className={`disc${playing ? ' playing' : ''}`}
        onClick={onPreview}
        aria-label={playing ? `Arrêter ${sound.name}` : `Écouter ${sound.name}`}
      >
        {playing ? '■' : '▶'}
      </button>
      <div className="row-body">
        <div className="nm">{sound.name}</div>
        <div className="meta">
          {sound.roles.map((r) => (
            <span className="chip role" key={r}>{ROLE_LABEL[r]}</span>
          ))}
          <span className="chip">{sound.code}</span>
        </div>
        <div className="credit">{sound.credits}</div>
      </div>
      <button
        className={`collect${collected ? ' on' : ''}`}
        onClick={onToggle}
        disabled={!collected && full}
        aria-pressed={collected}
        aria-label={collected ? `Retirer ${sound.name} de ma collection` : `Ajouter ${sound.name} à ma collection`}
      >
        {collected ? '✓ gardé' : '+ garder'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ home -- */

function Home({
  onPick,
  ready,
  progress,
  resume,
}: {
  onPick: (u: Universe) => void
  ready: boolean
  progress: number
  resume: Session | null
}) {
  return (
    <div className="screen">
      <header className="hero">
        <div className="kicker">L'Aventure du Sucre · Muséomix</div>
        <h1>Les sons du musée deviennent ta musique.</h1>
        <p>
          Traverse les salles, écoute les sons des machines, des tambours et des chaudrons. Garde ceux qui te parlent.
          À la fin, ils composeront une pièce unique — que tu n'entendras qu'une fois prête.
        </p>
        <div className="concept">
          <div className="step-line"><span className="n">1</span><span>Choisis l'univers musical de ta pièce.</span></div>
          <div className="step-line"><span className="n">2</span><span>Écoute les sons du musée et garde-en {minSelected} à {maxSelected}.</span></div>
          <div className="step-line"><span className="n">3</span><span>Révèle ta composition : uniquement tes sons, aucun instrument ajouté.</span></div>
        </div>
      </header>

      <DemoBanner />

      {resume && resume.selected.length > 0 && (
        <div className="banner">
          <b>Reprise</b>
          <span>Une collection de {resume.selected.length} son(s) est déjà enregistrée sur cet appareil.</span>
        </div>
      )}

      <div className="label" style={{ marginTop: 26 }}>Ton univers</div>
      <div className="universe-grid">
        {UNIVERSES.map((u) => <UniverseCard key={u.id} u={u} onPick={onPick} />)}
      </div>

      <div className="loader">
        <span className="dot" />
        {ready ? `${playableCount} sons chargés — utilisable hors ligne` : `Préparation des sons… ${Math.round(progress * 100)}%`}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- explore -- */

function Explore({
  session,
  onToggle,
  onBack,
  onCompose,
  onReset,
  ready,
}: {
  session: Session
  onToggle: (id: string) => void
  onBack: () => void
  onCompose: () => void
  onReset: () => void
  ready: boolean
}) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const universe = getUniverse(session.universeId ?? '') ?? UNIVERSES[0]
  const full = session.selected.length >= maxSelected

  const stations = useMemo(
    () => catalog.sections
      .map((s) => ({ section: s, sounds: catalog.sounds.filter((snd) => snd.section === s.id && snd.inDemoSet) }))
      .filter((s) => s.sounds.length > 0),
    [],
  )

  const preview = useCallback((sound: Sound) => {
    if (playingId === sound.id) {
      audio.stopPreview()
      setPlayingId(null)
      return
    }
    setPlayingId(sound.id)
    void audio.preview(sound).catch(() => setPlayingId(null))
    window.setTimeout(() => setPlayingId((cur) => (cur === sound.id ? null : cur)), 4700)
  }, [playingId])

  useEffect(() => () => audio.stopPreview(), [])

  return (
    <div className="screen">
      <div className="topbar">
        <button className="back" onClick={onBack} aria-label="Revenir au choix de l'univers">←</button>
        <span className="uni-chip" style={{ ['--u' as string]: universe.accent }}>
          <span aria-hidden="true">{universe.glyph}</span> {universe.style}
        </span>
      </div>

      <div className="explore-intro">
        <h2>Écoute, puis garde tes sons.</h2>
        <p>
          Il y a plus de sons que de places. Garde-en entre {minSelected} et {maxSelected} : ce sont eux, et seulement
          eux, qui composeront ta pièce.
        </p>
      </div>

      {!ready && <div className="banner warn"><b>Chargement</b><span>Les sons sont en cours de préparation.</span></div>}

      {stations.map(({ section, sounds }) => (
        <section className="station" key={section.id}>
          <div className="station-head">
            <h2>{section.name}</h2>
            <span className="count">{sounds.length} son{sounds.length > 1 ? 's' : ''}</span>
          </div>
          {sounds.map((snd) => (
            <SoundRow
              key={snd.id}
              sound={snd}
              collected={session.selected.includes(snd.id)}
              full={full}
              onToggle={() => onToggle(snd.id)}
              playingId={playingId}
              onPreview={() => preview(snd)}
            />
          ))}
        </section>
      ))}

      <div className="collect-bar">
        <div className="collect-inner">
          <div className="slots" aria-hidden="true">
            {Array.from({ length: maxSelected }, (_, i) => (
              <span key={i} className={`slot${i < session.selected.length ? ' on' : ''}`} />
            ))}
          </div>
          <div className="collect-text">
            <b>{session.selected.length}</b> / {maxSelected} sons gardés
          </div>
          <button className="ghost" onClick={onReset}>réinitialiser</button>
          <button
            className="cta"
            disabled={session.selected.length < minSelected}
            onClick={onCompose}
            aria-label="Composer ma pièce"
          >
            {session.selected.length < minSelected
              ? `encore ${minSelected - session.selected.length} son${minSelected - session.selected.length > 1 ? 's' : ''}`
              : 'Créer ma pièce'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- result -- */

function Result({
  score,
  buffer,
  report,
  selection,
  onRestart,
  onBackToExplore,
}: {
  score: Score
  buffer: AudioBuffer
  report: RenderReport
  selection: Sound[]
  onRestart: () => void
  onBackToExplore: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const handle = useRef<PlayHandle | null>(null)
  const raf = useRef<number>(0)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)

  const tick = useCallback(() => {
    const h = handle.current
    if (!h) return
    setPos(h.currentTime())
    raf.current = requestAnimationFrame(tick)
  }, [])

  const play = useCallback(async () => {
    audio.stopPiece()
    const h = await audio.playPiece(buffer, () => {
      setPlaying(false)
      cancelAnimationFrame(raf.current)
      setPos(buffer.duration)
    })
    handle.current = h
    setPlaying(true)
    setAutoplayBlocked(false)
    raf.current = requestAnimationFrame(tick)
  }, [buffer, tick])

  // one attempt to start on arrival; browsers may refuse without a fresh gesture
  useEffect(() => {
    let cancelled = false
    const id = window.setTimeout(async () => {
      try {
        await play()
      } catch {
        if (!cancelled) setAutoplayBlocked(true)
      }
    }, 420)
    return () => {
      cancelled = true
      window.clearTimeout(id)
      cancelAnimationFrame(raf.current)
      audio.stopPiece()
    }
  }, [play])

  const onPlayClick = () => {
    if (playing) {
      audio.stopPiece()
      setPlaying(false)
      cancelAnimationFrame(raf.current)
      return
    }
    void play()
  }

  const sigTime = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of score.signatures) m.set(s.sourceId, s.start)
    return m
  }, [score.signatures])

  const pct = Math.min(100, (pos / buffer.duration) * 100)
  const ok = report.ok

  return (
    <div className="screen reveal">
      <div className="kicker">Ta pièce est prête</div>
      <h1>{score.universeId === 'reveur' ? 'Ambient créole' : 'Electro Sega'} de tes {selection.length} sons</h1>
      <p className="sub">
        {fmt(buffer.duration)} · {score.bpm} BPM · uniquement les sons que tu as gardés
      </p>

      <div className="player">
        <button
          className={`bigdisc${playing ? ' playing' : ''}`}
          onClick={onPlayClick}
          aria-label={playing ? 'Arrêter la pièce' : 'Écouter la pièce'}
        >
          {playing ? '■' : '▶'}
        </button>
        <div className="progress-wrap">
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Math.round(buffer.duration)}
            aria-valuenow={Math.round(pos)}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="time"><span>{fmt(pos)}</span><span>{fmt(buffer.duration)}</span></div>
          {autoplayBlocked && !playing && (
            <div className="hint">Le navigateur a bloqué la lecture automatique — appuie sur ▶ pour écouter ta pièce.</div>
          )}
        </div>
      </div>

      <div className="piece-list">
        <h2>Les sons que tu as gardés</h2>
        {selection.map((s) => (
          <div className="piece-row" key={s.id}>
            <span>{s.name}</span>
            <span className="tag">reconnaissable</span>
            <span className="t">à {fmt(sigTime.get(s.id) ?? 0)}</span>
          </div>
        ))}
      </div>

      {(score.adaptations.length > 0 || score.limits.length > 0) && (
        <div className="notes">
          {score.adaptations.map((a, i) => (
            <div className="note" key={`a${i}`}><b>Adaptation.</b> {a.reason}</div>
          ))}
          {score.limits.map((l, i) => (
            <div className="note" key={`l${i}`}><b>Limite.</b> {l}</div>
          ))}
        </div>
      )}

      <div className="actions">
        <button className="btn primary" onClick={() => void play()}>Réécouter</button>
        <button className="btn" onClick={() => audio.exportWav(buffer, `sugar-orchestra-${score.universeId}.wav`)}>
          Exporter en WAV
        </button>
        <button className="btn" onClick={onBackToExplore}>Changer un son</button>
        <button className="btn" onClick={onRestart}>Recommencer</button>
      </div>

      <details className="proof">
        <summary>
          Preuve technique — {ok ? '3 invariants vérifiés' : 'invariants à vérifier'} (sons utilisés, reconnaissables, aucun sample externe)
        </summary>
        <pre>{JSON.stringify(report, null, 2)}</pre>
      </details>
    </div>
  )
}

/* ------------------------------------------------------------------ app -- */

export default function App() {
  const [session, setSession] = useState<Session>(loadSession)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [score, setScore] = useState<Score | null>(null)
  const [render, setRender] = useState<{ buffer: AudioBuffer; report: RenderReport } | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const selftest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('selftest')

  useEffect(() => {
    let alive = true
    const start = Date.now()
    const timer = window.setInterval(() => { if (alive) setElapsed(Math.round((Date.now() - start) / 1000)) }, 500)
    audio
      .loadAll((done, total) => { if (alive) setProgress(done / total) })
      .then(() => { if (alive) setReady(true) })
      .catch((e) => { if (alive) setError(String(e)) })
      .finally(() => window.clearInterval(timer))
    return () => { alive = false; window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)) } catch { /* ignore quota */ }
  }, [session])

  const pickUniverse = (u: Universe) => {
    if (!u.available) return
    setSession((s) => ({ universeId: u.id, selected: s.universeId === u.id ? s.selected : [], step: 'explore' }))
  }

  const toggle = (id: string) => {
    setSession((s) => {
      const has = s.selected.includes(id)
      if (has) return { ...s, selected: s.selected.filter((x) => x !== id) }
      if (s.selected.length >= maxSelected) return s
      return { ...s, selected: [...s.selected, id] }
    })
  }

  const compose = async () => {
    const universe = getUniverse(session.universeId ?? '')
    if (!universe) return
    const selection = session.selected.map(soundById).filter((s): s is Sound => Boolean(s))
    if (selection.length < minSelected) return
    setError(null)
    setScore(null)
    setRender(null)
    setSession((s) => ({ ...s, step: 'composing' }))
    try {
      const sc = buildScore({ universe, selection })
      const t0 = performance.now()
      const { buffer, report } = await audio.render(sc)
      // expose the report for the invariant check / demo audit
      ;(window as unknown as { __SUGAR_LAST_RENDER__: unknown }).__SUGAR_LAST_RENDER__ = {
        ...report,
        renderMs: Math.round(performance.now() - t0),
        bpm: sc.bpm,
      }
      setScore(sc)
      setRender({ buffer, report })
      setSession((s) => ({ ...s, step: 'result' }))
    } catch (e) {
      setError((e as Error).message || String(e))
      setSession((s) => ({ ...s, step: 'explore' }))
    }
  }

  const reset = () => {
    audio.stopPiece()
    setSession({ universeId: null, selected: [], step: 'home' })
    setScore(null)
    setRender(null)
  }

  if (selftest) return <SelfTest ready={ready} />

  return (
    <div className="shell">
      {session.step === 'home' && (
        <Home onPick={pickUniverse} ready={ready} progress={progress} resume={session.selected.length ? session : null} />
      )}

      {session.step === 'explore' && (
        <Explore
          session={session}
          onToggle={toggle}
          onBack={() => setSession((s) => ({ ...s, step: 'home' }))}
          onCompose={() => void compose()}
          onReset={reset}
          ready={ready}
        />
      )}

      {session.step === 'composing' && (
        <div className="screen composing">
          <div className="ringwrap"><span className="ring" /><span className="ring" /><span className="ring" /></div>
          <h2>On assemble tes sons…</h2>
          <p>
            Rendu hors ligne dans le navigateur : découpage, transposition, nappes granulaires, mixage. Aucun serveur,
            aucun autre son que les tiens.
          </p>
          <div className="elapsed">{elapsed}s</div>
        </div>
      )}

      {session.step === 'result' && score && render && (
        <Result
          score={score}
          buffer={render.buffer}
          report={render.report}
          selection={session.selected.map(soundById).filter((s): s is Sound => Boolean(s))}
          onRestart={reset}
          onBackToExplore={() => setSession((s) => ({ ...s, step: 'explore' }))}
        />
      )}

      {error && <div className="banner warn"><b>Erreur</b><span>{error}</span></div>}
    </div>
  )
}
