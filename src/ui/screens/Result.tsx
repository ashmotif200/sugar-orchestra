import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audio, peaks, soundById, titleOf } from '../../audio/service'
import { getUniverse } from '../../engine/universes'
import { t } from '../../i18n'
import { Badge, Button, PlayIcon, Waveform, fmtTime } from '../kit'
import type { Piece } from './Composer'

const PALETTE = ['#E5533D', '#2F6B4F', '#E9A23B', '#2A9D9B', '#3F4A9E', '#8A4B2A', '#7A6EA8', '#B8577A']

export default function Result({
  piece,
  onRestart,
  onCarnet,
}: {
  piece: Piece
  onRestart: () => void
  onCarnet: () => void
}) {
  const { score, buffer, report } = piece
  const universe = getUniverse(score.universeId)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const raf = useRef(0)

  const tick = useCallback(() => {
    setPos(audio.position())
    raf.current = requestAnimationFrame(tick)
  }, [])

  const play = useCallback(async () => {
    audio.stopPiece()
    try {
      await audio.playPiece(buffer, () => { setPlaying(false); cancelAnimationFrame(raf.current); setPos(buffer.duration) })
      setPlaying(true)
      setBlocked(false)
      raf.current = requestAnimationFrame(tick)
      // filet de sécurité : si rien n'avance après 400 ms, on le dit au lieu de
      // laisser un lecteur muet sans explication
      window.setTimeout(() => {
        if (!audio.isPlaying() || audio.position() < 0.05) {
          setPlaying(false)
          setBlocked(true)
        }
      }, 400)
    } catch {
      setPlaying(false)
      setBlocked(true)
    }
  }, [buffer, tick])

  useEffect(() => () => { cancelAnimationFrame(raf.current); audio.stopPiece() }, [])

  const toggle = () => {
    if (playing) { audio.stopPiece(); setPlaying(false); cancelAnimationFrame(raf.current); return }
    void play()
  }

  const p = useMemo(() => peaks(buffer, 160), [buffer])

  // bandes colorées : les moments où chaque son apparaît à l'état brut
  const segments = useMemo(() => {
    return score.signatures.map((sig, i) => ({
      from: Math.max(0, sig.start / buffer.duration),
      to: Math.min(1, (sig.start + Math.max(sig.dur, 0.8)) / buffer.duration),
      color: PALETTE[i % PALETTE.length],
    }))
  }, [score.signatures, buffer.duration])

  const used = useMemo(
    () => [...new Set(score.notes.map((n) => n.sourceId))]
      .map((id) => {
        const s = soundById(id)
        const sig = score.signatures.find((x) => x.sourceId === id)
        const color = PALETTE[score.signatures.findIndex((x) => x.sourceId === id) % PALETTE.length]
        return s ? { sound: s, at: sig?.start ?? 0, color } : null
      })
      .filter((x): x is { sound: NonNullable<ReturnType<typeof soundById>>; at: number; color: string } => Boolean(x))
      .sort((a, b) => a.at - b.at),
    [score],
  )

  return (
    <div className="screen result">
      <p className="kicker">{universe?.name}</p>
      <h1 className="h1">{t('result.title')}</h1>
      <p className="sub">{t('result.duration', { time: fmtTime(buffer.duration), bpm: score.bpm })}</p>

      <div className="player">
        <Waveform peaks={p} segments={segments} progress={buffer.duration ? pos / buffer.duration : 0} height={92} />
        <div className="player-row">
          <button className="play-disc" onClick={toggle} aria-label={playing ? t('result.stop') : t('result.play')}>
            <PlayIcon playing={playing} />
          </button>
          <div className="player-times">
            <span>{fmtTime(pos)}</span>
            <span className="muted">{fmtTime(buffer.duration)}</span>
          </div>
        </div>
        {blocked && (
          <div className="hint hint-loud" role="status">
            <b>{t('audio.blockedTitle')}</b> {t('audio.blockedHint')}
          </div>
        )}
      </div>

      <section className="used">
        <h2 className="h2">{t('result.used')}</h2>
        <ul className="rows">
          {used.map(({ sound, at, color }) => (
            <li key={sound.id} className="row used-row">
              <span className="swatch" style={{ background: color }} aria-hidden="true" />
              <div className="row-main">
                <p className="row-title">{titleOf(sound)}</p>
                <div className="row-meta">
                  <Badge tone="ok">{t('result.signature')}</Badge>
                  <span className="muted">{t('result.at', { time: fmtTime(at) })}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {(score.adaptations.length > 0 || score.limits.length > 0) && (
        <section className="notes">
          {score.adaptations.map((a, i) => (
            <p key={`a${i}`} className="note"><b>{t('result.adaptation')}.</b> {a.reason}</p>
          ))}
          {score.limits.map((l, i) => (
            <p key={`l${i}`} className="note"><b>{t('result.limit')}.</b> {l}</p>
          ))}
        </section>
      )}

      <div className="row-actions">
        <Button onClick={toggle}>{playing ? t('result.stop') : t('result.play')}</Button>
        <Button variant="secondary" onClick={() => audio.exportWav(buffer, `sugar-orchestra-${score.universeId}.wav`)}>
          {t('result.download')}
        </Button>
      </div>
      <div className="row-actions">
        <Button variant="ghost" onClick={onCarnet}>{t('result.back')}</Button>
        <Button variant="ghost" onClick={onRestart}>{t('result.restart')}</Button>
      </div>

      <details className="proof">
        <summary>{t('result.proof')}</summary>
        <pre>{JSON.stringify(report, null, 2)}</pre>
      </details>
    </div>
  )
}
