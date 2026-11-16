import { UNIVERSES } from '../../engine/universes'
import { t } from '../../i18n'
import { Button, MascotImage } from '../kit'
import type { Universe } from '../../audio/types'
import { isUniverseOpen, usePublication } from '../../data/publication'

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
  // dépend de la publication : un univers repassé en brouillon devient
  // automatiquement « Bientôt » et non sélectionnable
  usePublication()
  const open = (u: Universe) => isUniverseOpen(u.id)
  const chosen = UNIVERSES.find((u) => u.id === universeId && open(u)) ?? UNIVERSES.find(open) ?? UNIVERSES[0]

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
          const available = open(u)
          const active = u.id === chosen.id && available
          const mascot = u.mascot
          const name = mascot?.name ?? u.name
          const label = t('home.cardLabel', { mascot: name, universe: u.name, emotion: u.emotion })
          return (
            <button
              key={u.id}
              className={`uni-card${available ? '' : ' is-soon'}${active ? ' is-active' : ''}`}
              onClick={() => available && onPick(u)}
              disabled={!available}
              aria-pressed={active}
              aria-label={available ? label : `${name} — ${u.emotion} (${t('home.soon')})`}
            >
              <MascotImage files={mascot?.files} alt={label} accent={u.accent} glyph={u.glyph} />
              <span className="uni-body">
                <span className="uni-mascot">{name}</span>
                <span className="uni-emotion">{u.emotion}</span>
              </span>
              {!available && <span className="uni-soon">{t('home.soon')}</span>}
              {active && <span className="uni-check" aria-hidden="true">✓</span>}
            </button>
          )
        })}
      </div>

      <div className="home-cta">
        <Button wide onClick={onStart} disabled={!open(chosen)}>
          {t('home.ctaMascot', { mascot: chosen.mascot?.name ?? chosen.name })}
        </Button>
        <p className="micro">{t('home.future')}</p>
        <p className="credits home-credit">
          <span className="label">{t('home.creditLabel')}</span> {t('home.credit')}
        </p>
      </div>
    </div>
  )
}
