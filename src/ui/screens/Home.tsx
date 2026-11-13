import { UNIVERSES } from '../../engine/universes'
import { t } from '../../i18n'
import { Button, UniverseMark } from '../kit'
import type { Universe } from '../../audio/types'

export default function Home({
  universeId,
  onPick,
  onStart,
  resumeCount,
  onResume,
}: {
  universeId?: string
  onPick: (u: Universe) => void
  onStart: () => void
  resumeCount: number
  onResume: () => void
}) {
  const chosen = UNIVERSES.find((u) => u.id === universeId && u.available) ?? UNIVERSES[0]

  return (
    <div className="screen home">
      <p className="kicker">{t('app.museum')}</p>
      <h1 className="display">{t('home.h1')}</h1>
      <p className="lead">{t('home.lead')}</p>

      {resumeCount > 0 && (
        <button className="resume" onClick={onResume}>
          ↺ {t('home.resume', { n: resumeCount })}
        </button>
      )}

      <div className="uni-grid">
        {UNIVERSES.map((u) => {
          const active = u.id === chosen.id && u.available
          return (
            <button
              key={u.id}
              className={`uni-card${u.available ? '' : ' is-soon'}${active ? ' is-active' : ''}`}
              style={u.available ? { background: u.fill ?? u.accent, color: u.id === 'sega-trad' ? 'var(--ink)' : '#fffaf0' } : undefined}
              onClick={() => u.available && onPick(u)}
              disabled={!u.available}
              aria-pressed={active}
              aria-label={`${u.name} — ${u.emotion}${u.available ? '' : ` (${t('home.soon')})`}`}
            >
              <UniverseMark icon={u.icon} color={u.available ? (u.id === 'sega-trad' ? 'var(--ink)' : '#fffaf0') : 'var(--mut)'} />
              <span className="uni-name">{u.name}</span>
              <span className="uni-emotion">{u.emotion}</span>
              {!u.available && <span className="uni-soon">{t('home.soon')}</span>}
            </button>
          )
        })}
      </div>

      <div className="home-cta">
        <Button wide onClick={onStart}>{t('home.cta', { universe: chosen.name })}</Button>
        <p className="micro">{t('home.future')}</p>
      </div>
    </div>
  )
}
