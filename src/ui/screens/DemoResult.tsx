import { useEffect, useMemo, useRef, useState } from 'react'
import { soundById, titleOf } from '../../audio/service'
import { getUniverse } from '../../engine/universes'
import { t } from '../../i18n'
import { Button } from '../kit'
import { demoMode, demoTrackUrl, demoTrackFallbackUrl } from '../../data/demo'

/**
 * Résultat de la démonstration.
 *
 * Deux sources : AAC-LC (m4a) d'abord, puis le WAV d'origine. Safari iOS ne
 * décode pas le PCM 24 bits du WAV fourni ; l'AAC est la version de diffusion
 * (même mixage, même durée, même niveau), le WAV reste disponible pour les
 * navigateurs qui le préfèrent.
 *
 * Les erreurs sont distinguées : un fichier réellement absent (404) n'est pas
 * une erreur de lecture, et une erreur de lecture ne doit pas être annoncée
 * comme un fichier manquant.
 */
type Erreur = 'absent' | 'lecture' | null

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
  const [erreur, setErreur] = useState<Erreur>(null)
  const url = useMemo(() => demoTrackUrl(), [])
  const fallback = useMemo(() => demoTrackFallbackUrl(), [])
  const sounds = selected.map((id) => soundById(id)).filter(Boolean)

  // Le message « fichier absent » ne doit s'afficher que si le serveur le dit.
  useEffect(() => {
    let alive = true
    fetch(url, { method: 'HEAD' })
      .then((r) => { if (alive && r.status === 404) setErreur('absent') })
      .catch(() => { /* réseau coupé : ce n'est pas une absence de fichier */ })
    return () => { alive = false }
  }, [url])

  // Libère la ressource quand on quitte l'écran.
  useEffect(() => () => {
    const el = audioEl.current
    if (el) { el.pause(); el.removeAttribute('src'); el.load() }
  }, [])

  return (
    <div className="screen result demo-result">
      <p className="kicker">{universe?.name ?? 'Electro Sega'} · {t('demo.label')}</p>
      <h1 className="h1">{t('demo.resultTitle')}</h1>

      <div className="player">
        {erreur !== 'absent' && (
          <audio
            ref={audioEl}
            controls
            preload="metadata"
            playsInline
            className="demo-audio"
            onError={() => setErreur((e) => e ?? 'lecture')}
          >
            <source src={url} type="audio/mp4" />
            <source src={fallback} type="audio/wav" />
            {t('demo.noAudioSupport')}
          </audio>
        )}
        {erreur === 'absent' && (
          <div className="hint-loud" role="status">
            <b>{t('demo.missingTitle')}</b>
            <span>{t('demo.missingBody', { file: demoMode.track })}</span>
          </div>
        )}
        {erreur === 'lecture' && (
          <p className="micro" role="status">{t('demo.playError')}</p>
        )}
        {erreur !== 'absent' && (
          <p className="credits demo-credit">
            <span className="label">{t('demo.creditLabel')}</span> {t('demo.credit')}
          </p>
        )}
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
        </section>
      )}

      <div className="row-actions">
        <Button wide onClick={onRestart}>{t('result.newVisit')}</Button>
        <Button variant="secondary" onClick={onCarnet}>{t('result.back')}</Button>
      </div>
    </div>
  )
}
