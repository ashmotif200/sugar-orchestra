import { useEffect, useMemo, useState } from 'react'
import { audio, catalog, peaks, stepSounds, titleOf } from '../../audio/service'
import { t } from '../../i18n'
import { editorialNotes, isMusicallyUsable } from '../../engine/policy'
import { isSoundOpen, usePublication } from '../../data/publication'
import { editorialFor, loadEditorial } from '../../data/editorial'
import { Badge, Button, EmptyState, ErrorBox, PlayIcon, Spinner, Waveform, fmtTime } from '../kit'
import type { Session } from '../../session'
import type { Sound } from '../../audio/types'

export default function Step({
  stepId,
  session,
  onDiscover,
  onToggle,
  onBack,
  onNext,
}: {
  stepId: number
  session: Session
  onDiscover: (id: string) => void
  onToggle: (id: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const step = (catalog.steps ?? []).find((s) => s.id === stepId)
  const sounds = useMemo(() => stepSounds(stepId), [stepId])
  // l'état de publication pilote ce qui est réellement téléchargeable
  const pub = usePublication()
  // par défaut on ouvre le premier son publié : ouvrir la fiche d'un son
  // verrouillé laissait croire qu'il était écoutable alors qu'il ne l'est pas
  // on n'ouvre aucune fiche d'office : sur téléphone, la fiche masque la liste.
  // Le visiteur voit d'abord les sons de l'étape, puis ouvre celui qu'il veut.
  const [openId, setOpenId] = useState<string | null>(null)
  // le contenu éditorial arrive en asynchrone : ce compteur force un rendu une fois chargé
  const [editorialTick, setEditorialTick] = useState(0)
  useEffect(() => {
    let alive = true
    loadEditorial().then(() => { if (alive) setEditorialTick((n) => n + 1) })
    return () => { alive = false }
  }, [])
  const [playing, setPlaying] = useState<string | null>(null)
  /** échec de démarrage de la lecture : affiché, jamais silencieux */
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const open: Sound | undefined = sounds.find((s) => s.id === openId)
  const openLocked = !!open && !isSoundOpen(open.code)

  // Seuls les sons publiés sont réellement téléchargés : un son verrouillé
  // « Bientôt » n'est pas ouvrable (`disabled`), son audio n'a donc personne à
  // servir. Sans ce filtre, une étape tire aussi les fichiers des sons en
  // brouillon — et échoue en 404 quand ils ne sont pas publiés avec le site.
  const ids = useMemo(
    () => sounds.filter((s) => isSoundOpen(s.code)).map((s) => s.id),
    [sounds, pub],
  )

  const load = () => {
    setLoading(true)
    setError(null)
    audio
      .ensure(ids)
      .then(() => setLoading(false))
      .catch((e) => { setError(String(e)); setLoading(false) })
  }
  const [, setAudioTick] = useState(0)
  useEffect(() => audio.subscribe(() => setAudioTick((n) => n + 1)), [])
  useEffect(load, [ids])

  useEffect(() => () => audio.stopPreview(), [])

  const togglePlay = () => {
    if (!open) return
    if (playing === open.id) { audio.stopPreview(); setPlaying(null); return }
    setPlaybackError(null)
    setPlaying(open.id)
    onDiscover(open.id)
    audio.preview(open, 6, () => setPlaying((cur) => (cur === open.id ? null : cur)))
      .catch((e) => {
        setPlaying(null)
        // Ne jamais laisser croire que ça joue : si le navigateur refuse de
        // démarrer la sortie audio, on le dit au lieu de rendre le bouton muet.
        setPlaybackError(e instanceof Error && e.message !== 'autoplay-bloque' ? e.message : 'autoplay-bloque')
      })
  }

  const select = (s: Sound) => {
    setOpenId(s.id)
    onDiscover(s.id)
  }

  if (!step) return <ErrorBox title="Étape inconnue" action={<Button onClick={onBack}>{t('step.back')}</Button>} />

  return (
    <div className={`screen step${open ? ' has-detail' : ''}`}>
      <button className="backlink" onClick={onBack}>‹ {t('step.back')}</button>

      <div className="step-head">
        <p className="kicker">{t('step.label', { id: step.id })}</p>
        <h1 className="h1">{step.title}</h1>
        <p className="sub">{step.summary}</p>
        {step.badge && <Badge tone={step.sensitive ? 'lock' : 'neutral'}>{step.badge}</Badge>}
      </div>

      {step.sensitive && (
        <div className="notice notice-lock" role="note">{t('step.sensitive')}</div>
      )}

      {loading && <Spinner label={t('audio.loading')} />}
      {error && (
        <ErrorBox title={t('audio.failed')} hint={error} action={<Button variant="secondary" onClick={load}>{t('audio.retry')}</Button>} />
      )}

      {sounds.length === 0 && <EmptyState title={t('step.empty')} />}

      {open && (
        <button className="backlink backlink-inline" onClick={() => setOpenId(null)} aria-label={t('step.back')}>
          ‹ {t('step.label', { id: step.id })}
        </button>
      )}

      <div className="step-split">
        <ul className="rows step-list">
          {sounds.map((s) => {
            // politique v2 : plus de cadenas musical ; seule l'absence de fichier bloque.
            // Démo v0.1 : un son non publié dans l'administration est verrouillé « Bientôt ».
            const soon = !isSoundOpen(s.code)
            const locked = soon || !isMusicallyUsable(s)
            const inMusic = session.selected.includes(s.id)
            const seen = session.discovered.includes(s.id)
            return (
              <li key={s.id} className={`row${open?.id === s.id ? ' is-open' : ''}`}>
                <button
                  className="row-main row-main-btn"
                  onClick={() => { if (!locked) select(s) }}
                  disabled={locked}
                  aria-disabled={locked}
                >
                  <p className="row-title">
                    {editorialFor(s.id)?.title ?? titleOf(s)}
                    {seen && <span className="tick" aria-label={t('step.discovered')}> ✓</span>}
                  </p>
                  <div className="row-meta">
                    {soon && <Badge tone="lock">{t('home.soon')}</Badge>}
                    {!soon && locked && <Badge tone="lock">🔒 {t('step.historyOnly')}</Badge>}
                    {!locked && s.availability === 'tbc' && <Badge tone="warn">{t('step.tbc')}</Badge>}
                    {inMusic && <Badge tone="ok">{t('step.added')}</Badge>}
                  </div>
                </button>
                {!locked && (
                  <button
                    className={`row-toggle${inMusic ? ' is-on' : ''}`}
                    onClick={() => onToggle(s.id)}
                    aria-pressed={inMusic}
                    aria-label={`${inMusic ? t('step.remove') : t('step.add')} ${titleOf(s)}`}
                  >
                    {inMusic ? '✓' : '+'}
                  </button>
                )}
                {locked && <span className="row-lock" aria-hidden="true">🔒</span>}
              </li>
            )
          })}
        </ul>

        {open && (
          <article className="fiche" aria-live="polite">
            <h2 className="h2">
              {editorialFor(open.id)?.title ?? titleOf(open)}
              {editorialFor(open.id)?.title && editorialFor(open.id)!.title !== titleOf(open) && (
                <span className="fiche-catalogue-name"> · {titleOf(open)}</span>
              )}
            </h2>
            {editorialFor(open.id)?.shortDesc && (
              <p className="fiche-short">{editorialFor(open.id)!.shortDesc}</p>
            )}
            {audio.get(open.id) ? (
              <Waveform
                peaks={peaks(audio.get(open.id)!, 96)}
                height={72}
                color={playing === open.id ? 'var(--coral)' : 'var(--cane)'}
                progress={playing === open.id ? 0.35 : 0}
                label={`forme d’onde de ${titleOf(open)}`}
              />
            ) : (
              <div className="wave wave-empty" style={{ height: 72 }} aria-hidden="true" />
            )}

            <div className="fiche-actions">
              <button
                className="play-disc"
                onClick={togglePlay}
                disabled={openLocked}
                aria-label={`${playing === open.id ? t('step.stop') : t('step.listen')} ${titleOf(open)}`}
              >
                <PlayIcon playing={playing === open.id} />
              </button>
              <div className="fiche-info">
                <p className="micro">{t('audio.tapToPlay')}</p>
                {audio.get(open.id) && <p className="micro">{fmtTime(audio.get(open.id)!.duration)}</p>}
              </div>
            </div>

            {session.discovered.includes(open.id) ? (
              <p className="discovered"><span className="tick">✓</span> {t('step.discovered')}</p>
            ) : (
              <p className="discovered is-muted">◌ {t('step.notYet')}</p>
            )}

            {playbackError && (
              <div className="notice notice-lock" role="alert">
                <b>{t('audio.blockedTitle')}</b> {t('audio.blockedHint')}
              </div>
            )}

            {(editorialFor(open.id)?.story ?? open.history) && (
              <details className="fiche-story" key={`story-${editorialTick}`}>
                <summary>{t('step.discoverStory')}</summary>
                <div className="fiche-text">
                  {(editorialFor(open.id)?.story ?? open.history ?? '')
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .map((line, i) => <p key={i}>{line}</p>)}
                </div>
              </details>
            )}

            {editorialFor(open.id)?.pedagogy && (
              <div className="fiche-text">
                <p className="label">{t('step.pedagogy')}</p>
                <p>{editorialFor(open.id)!.pedagogy}</p>
              </div>
            )}

            {editorialFor(open.id)?.sources && (
              <p className="credits">
                <span className="label">{t('step.sources')}</span> {editorialFor(open.id)!.sources}
              </p>
            )}

            <p className="credits">
              <span className="label">{t('step.credits')}</span> {open.credits}
            </p>

            {editorialNotes(open).label && (
              <p className="note note-history">ℹ️ {editorialNotes(open).label}</p>
            )}

            {openLocked ? (
              <p className="locked-note">🔒 {t('demo.soonNote')}</p>
            ) : !isMusicallyUsable(open) ? (
              <p className="locked-note">🔒 {t('step.historyOnly')}</p>
            ) : (
              <Button
                wide
                variant={session.selected.includes(open.id) ? 'secondary' : 'primary'}
                onClick={() => onToggle(open.id)}
              >
                {session.selected.includes(open.id) ? `✓ ${t('step.added')} — ${t('step.remove')}` : `+ ${t('step.add')}`}
              </Button>
            )}
          </article>
        )}
      </div>

      <div className="step-nav">
        <Button variant="ghost" onClick={onNext}>{t('step.next')} ›</Button>
      </div>
    </div>
  )
}
