import { useEffect, useRef, useState } from 'react'
import { audio, soundById } from '../../audio/service'
import { buildScore, CompositionRefused, type Score } from '../../engine/plan'
import { getUniverse } from '../../engine/universes'
import { t } from '../../i18n'
import { Button, ErrorBox } from '../kit'
import type { RenderReport } from '../../engine/render'
import type { Session } from '../../session'

export interface Piece {
  score: Score
  buffer: AudioBuffer
  report: RenderReport
}

export default function Composer({
  session,
  onDone,
  onCancel,
}: {
  session: Session
  onDone: (p: Piece) => void
  onCancel: () => void
}) {
  const [phase, setPhase] = useState(0)
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null)
  const cancelled = useRef(false)
  const ran = useRef(false)

  const run = async () => {
    setError(null)
    setPhase(0)
    cancelled.current = false
    const universe = getUniverse(session.universeId)
    const selection = session.selected.map(soundById).filter((s): s is NonNullable<typeof s> => Boolean(s))
    try {
      if (!universe) throw new CompositionRefused('unavailable-universe', 'aucun univers choisi')
      if (!selection.length) throw new CompositionRefused('no-usable-sound', 'aucun son sélectionné')

      setPhase(1) // écoute / décodage réel des sons retenus
      await audio.ensure(selection.map((s) => s.id))
      if (cancelled.current) return

      setPhase(2) // écriture de l'arrangement
      const score = buildScore({ universe, selection })
      await new Promise((r) => setTimeout(r, 260))
      if (cancelled.current) return

      setPhase(3) // rendu audio hors ligne
      const { buffer, report } = await audio.render(score)
      if (cancelled.current) return
      onDone({ score, buffer, report })
    } catch (e) {
      if (cancelled.current) return
      const msg = e instanceof CompositionRefused ? e.message : (e as Error).message
      setError({ title: t('composer.error'), hint: `${t('composer.errorHint')} (${msg})` })
    }
  }

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const phases = [t('composer.phase1'), t('composer.phase2'), t('composer.phase3')]

  return (
    <div className="screen composer">
      <div className="compose-art" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`compose-trunk${phase > i - 1 ? ' is-on' : ''}`} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <h1 className="h1">{t('composer.title')}</h1>

      <ol className="phases" aria-live="polite">
        {phases.map((p, i) => (
          <li key={p} className={`phase${phase > i ? ' is-done' : phase === i + 1 ? ' is-active' : ''}`}>
            <span className="phase-dot" aria-hidden="true">{phase > i ? '✓' : i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>

      {error ? (
        <ErrorBox
          title={error.title}
          hint={error.hint}
          action={
            <div className="row-actions">
              <Button onClick={() => void run()}>{t('composer.retry')}</Button>
              <Button variant="secondary" onClick={onCancel}>{t('composer.cancel')}</Button>
            </div>
          }
        />
      ) : (
        <>
          <p className="micro">{t('composer.hint')}</p>
          <div className="compose-cancel">
            <Button variant="ghost" onClick={() => { cancelled.current = true; audio.stopPiece(); onCancel() }}>
              {t('composer.cancel')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
