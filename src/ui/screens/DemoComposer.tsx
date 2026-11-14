import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { Spinner } from '../kit'

/**
 * Écran d'attente du mode démo : aucune génération n'est lancée. Le morceau est
 * précomposé, on ne fait que laisser respirer le parcours avant le résultat.
 */
export default function DemoComposer({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const done = useRef(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const tick = window.setInterval(() => setElapsed(Date.now() - started), 200)
    const end = window.setTimeout(() => {
      if (done.current) return
      done.current = true
      onDone()
    }, 1400)
    return () => { window.clearInterval(tick); window.clearTimeout(end) }
  }, [onDone])

  return (
    <div className="screen composer demo-composer">
      <p className="kicker">{t('demo.kicker')}</p>
      <h1 className="h1">{t('demo.preparing')}</h1>
      <p className="sub">{t('demo.neutral')}</p>
      <Spinner label={elapsed < 700 ? t('demo.phase1') : t('demo.phase2')} />
      <div className="row-actions">
        <button className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
