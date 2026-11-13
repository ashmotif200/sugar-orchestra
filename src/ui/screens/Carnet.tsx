import { useEffect, useMemo, useState } from 'react'
import { audio, peaks, soundById, titleOf } from '../../audio/service'
import { t } from '../../i18n'
import { Badge, Button, EmptyState, PlayIcon, Tabs, Waveform, fmtTime } from '../kit'
import type { Session } from '../../session'

export default function Carnet({
  session,
  onToggle,
  onCompose,
  onParcours,
  onPreview,
}: {
  session: Session
  onToggle: (id: string) => void
  onCompose: () => void
  onParcours: () => void
  onPreview: (id: string) => void
}) {
  const [tab, setTab] = useState<'discovered' | 'selected'>('discovered')
  const [, setAudioTick] = useState(0)
  useEffect(() => audio.subscribe(() => setAudioTick((n) => n + 1)), [])
  const ids = tab === 'discovered' ? session.discovered : session.selected
  const items = useMemo(() => ids.map(soundById).filter(Boolean), [ids])
  const n = session.selected.length
  const canCompose = n > 0

  return (
    <div className="screen carnet">
      <h1 className="h1">{t('carnet.title')}</h1>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'discovered', label: t('carnet.discovered'), count: session.discovered.length },
          { value: 'selected', label: t('carnet.selected'), count: session.selected.length },
        ]}
      />

      {items.length === 0 ? (
        <EmptyState
          title={tab === 'discovered' ? t('carnet.emptyDiscovered') : t('carnet.emptySelected')}
          hint={tab === 'discovered' ? t('carnet.emptyDiscoveredHint') : t('carnet.emptySelectedHint')}
          action={<Button variant="secondary" onClick={onParcours}>{t('carnet.goParcours')}</Button>}
        />
      ) : (
        <ul className="rows">
          {items.map((s) => {
            if (!s) return null
            const inMusic = session.selected.includes(s.id)
            const locked = s.availability === 'not_musical' || s.sensitive
            const buf = audio.get(s.id)
            return (
              <li key={s.id} className="row">
                <button className="row-play" onClick={() => onPreview(s.id)} aria-label={`${t('step.listen')} ${titleOf(s)}`}>
                  <PlayIcon playing={false} />
                </button>
                <div className="row-main">
                  <p className="row-title">{titleOf(s)}</p>
                  <div className="row-meta">
                    {locked ? <Badge tone="lock">🔒 {t('step.historyOnly')}</Badge> : <span className="muted">Étape {s.stepId}</span>}
                    {buf && <span className="muted">· {fmtTime(buf.duration)}</span>}
                  </div>
                  {buf && <Waveform peaks={peaks(buf, 48)} height={26} progress={0} />}
                </div>
                {locked ? (
                  <span className="row-lock" aria-hidden="true">🔒</span>
                ) : (
                  <button
                    className={`row-toggle${inMusic ? ' is-on' : ''}`}
                    onClick={() => onToggle(s.id)}
                    aria-pressed={inMusic}
                    aria-label={`${inMusic ? t('step.remove') : t('step.add')} ${titleOf(s)}`}
                  >
                    {inMusic ? '✓' : '+'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {n > 0 && n < 3 && <p className="hint">{t('carnet.hintFew', { n, s: n > 1 ? 's' : '' })}</p>}

      <div className="bottom-bar">
        <Button wide disabled={!canCompose} onClick={onCompose}>
          {canCompose ? t('carnet.compose', { n, s: n > 1 ? 's' : '' }) : t('carnet.composeEmpty')}
        </Button>
      </div>
    </div>
  )
}
