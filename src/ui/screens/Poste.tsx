import { useEffect, useMemo, useState } from 'react'
import { audio, soundById, titleOf } from '../../audio/service'
import { t } from '../../i18n'
import { Badge, Button, PlayIcon, fmtTime } from '../kit'
import { isSoundOpen } from '../../data/publication'
import { posteById, resolveQr, type Poste as PosteType } from '../../data/postes'

/**
 * Fiche de découverte d'un poste, ouverte par un QR code.
 *
 * Le scan n'ajoute que ce qui est autorisé : un son non publié n'est jamais
 * collecté, un doublon n'est jamais créé. La description vient du poste ou du
 * contenu éditorial ; si elle manque, on écrit « Description à venir » — on
 * n'invente jamais de texte historique.
 */
export default function Poste({
  routeId,
  routeKey,
  selected,
  onCollect,
  onCarnet,
  onParcours,
  editorial,
}: {
  routeId: number
  routeKey?: string
  selected: string[]
  onCollect: (soundId: string) => void
  onCarnet: () => void
  onParcours: () => void
  editorial?: string | null
}) {
  const poste: PosteType | undefined = routeKey ? resolveQr(routeKey) : posteById(routeId)
  const sound = poste ? soundById(poste.sampleCode) : undefined
  const open = !!sound && isSoundOpen(sound.code)
  const already = !!sound && selected.includes(sound.id)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const description = poste?.description ?? editorial ?? null

  const collected = useMemo(() => already, [already])

  // collecte automatique au scan, une seule fois, et seulement si autorisé
  useEffect(() => {
    if (!sound || !open || already) return
    onCollect(sound.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound?.id, open])

  useEffect(() => () => { audio.stopPreview() }, [])

  if (!poste) {
    return (
      <div className="screen">
        <p className="kicker">{t('poste.kicker')}</p>
        <h1 className="h1">{t('poste.unknownTitle')}</h1>
        <p className="sub">{t('poste.unknownBody')}</p>
        <div className="row-actions">
          <Button onClick={onParcours}>{t('poste.backToParcours')}</Button>
        </div>
      </div>
    )
  }

  const toggle = async () => {
    if (!sound || !open) return
    if (playing) { audio.stopPreview(); setPlaying(false); return }
    setError(null)
    setPlaying(true)
    try {
      await audio.preview(sound, 6, () => setPlaying(false))
    } catch (e) {
      setPlaying(false)
      setError(t('poste.playError'))
    }
  }

  return (
    <div className="screen poste">
      <p className="kicker">{t('poste.kicker')} · {poste.id}/8</p>
      <h1 className="h1">{poste.title}</h1>
      <p className="sub">{sound ? titleOf(sound) : poste.sampleCode}</p>

      {!open && (
        <div className="hint-loud" role="status">
          <b>{t('poste.lockedTitle')}</b> {t('poste.lockedBody')}
        </div>
      )}

      <article className="fiche">
        <p className="label">{t('poste.description')}</p>
        {description ? (
          <div className="fiche-text">
            {description.split('\n').map((line, i) => <p key={i}>{line}</p>)}
          </div>
        ) : (
          <p className="fiche-text is-muted">{t('poste.todo')}</p>
        )}

        {sound && open && (
          <>
            <div className="fiche-actions">
              <button
                className="play-disc"
                onClick={toggle}
                aria-label={`${playing ? t('step.stop') : t('step.listen')} ${titleOf(sound)}`}
              >
                <PlayIcon playing={playing} />
              </button>
              <div className="fiche-info">
                <p className="micro">{playing ? t('poste.playing') : t('poste.playHint')}</p>
                {audio.get(sound.id) && <p className="micro">{fmtTime(audio.get(sound.id)!.duration)}</p>}
              </div>
            </div>
            {error && <p className="hint-loud">{error}</p>}
          </>
        )}

        <p className={collected ? 'discovered' : 'discovered is-muted'}>
          {collected ? <><span className="tick">✓</span> {t('poste.collected')}</> : `◌ ${t('poste.notCollected')}`}
        </p>
        {collected && <Badge tone="ok">{t('poste.inCarnet')}</Badge>}
      </article>

      <div className="row-actions">
        <Button wide onClick={onParcours}>{t('poste.continue')}</Button>
        <Button variant="secondary" onClick={onCarnet}>{t('carnet.title')}</Button>
      </div>
    </div>
  )
}
