import { catalog, stepSounds } from '../../audio/service'
import { t } from '../../i18n'
import { Badge } from '../kit'
import type { Session } from '../../session'

export default function Parcours({
  session,
  onOpen,
}: {
  session: Session
  onOpen: (id: number) => void
}) {
  const steps = catalog.steps ?? []
  const discovered = new Set(session.discovered)
  const done = steps.filter((st) => {
    const sounds = stepSounds(st.id)
    return sounds.length > 0 && sounds.every((s) => discovered.has(s.id))
  }).length

  return (
    <div className="screen">
      <h1 className="h1">{t('parcours.title')}</h1>
      <p className="sub">{done > 0 ? t('parcours.progress', { n: done, total: steps.length }) : t('parcours.progressZero')}</p>

      <ol className="cane">
        {steps.map((st) => {
          const sounds = stepSounds(st.id)
          const found = sounds.filter((s) => discovered.has(s.id)).length
          const state = found === 0 ? 'todo' : found === sounds.length ? 'done' : 'doing'
          return (
            <li key={st.id} className={`cane-node is-${state}`}>
              <button className="cane-btn" onClick={() => onOpen(st.id)} aria-label={`${t('step.label', { id: st.id })} — ${st.title}`}>
                <span className="cane-dot" aria-hidden="true">{found === sounds.length && sounds.length > 0 ? '✓' : st.id}</span>
                <span className="cane-body">
                  <span className="cane-title">{st.id} · {st.title}</span>
                  <span className="cane-meta">
                    {state === 'done' && <Badge tone="ok">{t('parcours.discovered')}</Badge>}
                    {state === 'doing' && <Badge tone="warn">{t('parcours.inProgress')}</Badge>}
                    {state === 'todo' && <span className="muted">{t('parcours.toDiscover')}</span>}
                    {st.badge && <Badge tone={st.sensitive ? 'lock' : 'neutral'}>{st.badge}</Badge>}
                    <span className="muted">· {t('parcours.sounds', { n: sounds.length, s: sounds.length > 1 ? 's' : '' })}</span>
                  </span>
                </span>
                <span className="cane-chevron" aria-hidden="true">›</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
