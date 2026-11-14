import { useMemo, useRef, useState } from 'react'
import { soundById, titleOf } from '../../audio/service'
import { getUniverse } from '../../engine/universes'
import { t } from '../../i18n'
import { Button } from '../kit'
import { demoMode, demoTrackUrl } from '../../data/demo'

/**
 * Résultat de la démonstration : un morceau précomposé, identique pour chaque
 * visiteur. Aucune formulation ne prétend qu'il a été calculé à partir des sons
 * collectés — le texte le dit explicitement.
 */
export default function DemoResult({
  selected,
  onRestart,
  onCarnet,
}: {
  selected: string[]
  onRestart: () => void
  onCarnet: () => void
}) {
  const universe = getUniverse(demoMode.universeId)
  const audioEl = useRef<HTMLAudioElement>(null)
  const [failed, setFailed] = useState(false)
  const url = useMemo(() => demoTrackUrl(), [])
  const sounds = selected.map((id) => soundById(id)).filter(Boolean)

  return (
    <div className="screen result demo-result">
      <p className="kicker">{universe?.name ?? 'Electro Sega'} · {t('demo.label')}</p>
      <h1 className="h1">{t('demo.resultTitle')}</h1>
      <p className="lead">{t('demo.resultLead')}</p>

      <div className="player">
        {!failed ? (
          <audio
            ref={audioEl}
            src={url}
            controls
            preload="metadata"
            playsInline
            className="demo-audio"
            onError={() => setFailed(true)}
          >
            {t('demo.noAudioSupport')}
          </audio>
        ) : (
          <div className="hint-loud" role="status">
            <b>{t('demo.missingTitle')}</b>
            <span>{t('demo.missingBody', { file: demoMode.track })}</span>
          </div>
        )}
        <p className="micro">{t('demo.sameForEveryone')}</p>
      </div>

      {sounds.length > 0 && (
        <section className="used">
          <h2 className="h2">{t('demo.collected')}</h2>
          <ul>
            {sounds.map((s) => (
              <li key={s!.id} className="used-row">
                <span className="row-title">{titleOf(s!)}</span>
              </li>
            ))}
          </ul>
          <p className="micro">{t('demo.collectedNote')}</p>
        </section>
      )}

      <div className="row-actions">
        <Button wide onClick={onRestart}>{t('result.newVisit')}</Button>
        <Button variant="secondary" onClick={onCarnet}>{t('result.back')}</Button>
      </div>
    </div>
  )
}
