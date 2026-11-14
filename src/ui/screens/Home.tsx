import { UNIVERSES } from '../../engine/universes'
import { t } from '../../i18n'
import { Button, MascotImage } from '../kit'
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
          const mascot = u.mascot
          const label = mascot
            ? t('home.cardLabel', { mascot: mascot.name, universe: u.name, emotion: u.emotion })
            : `${u.name} — ${u.emotion}`
          return (
            <button
              key={u.id}
              className={`uni-card${u.available ? '' : ' is-soon'}${active ? ' is-active' : ''}`}
              onClick={() => u.available && onPick(u)}
              disabled={!u.available}
              aria-pressed={active}
              aria-label={u.available ? label : `${label} (${t('home.soon')})`}
            >
              <MascotImage
                files={mascot?.files}
                alt={label}
                accent={u.accent}
                glyph={u.glyph}
              />
              <span className="uni-body">
                {mascot && <span className="uni-mascot">{mascot.name}</span>}
                <span className="uni-name">{u.name}</span>
                <span className="uni-emotion">{u.emotion}</span>
              </span>
              {!u.available && <span className="uni-soon">{t('home.soon')}</span>}
              {active && <span className="uni-check" aria-hidden="true">✓</span>}
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
