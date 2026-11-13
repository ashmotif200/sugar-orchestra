import type { ReactNode } from 'react'
import { t } from '../i18n'

/* ---------------------------------------------------------------- button -- */
export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  wide,
  type = 'button',
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
  wide?: boolean
  type?: 'button' | 'submit'
  ariaLabel?: string
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}${wide ? ' btn-wide' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- badge -- */
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'lock' | 'accent' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

/* ------------------------------------------------------------- waveform -- */
export interface Segment { from: number; to: number; color: string }

export function Waveform({
  peaks,
  segments,
  progress = 0,
  color = 'var(--cane)',
  height = 64,
  label,
}: {
  peaks: number[]
  segments?: Segment[]
  progress?: number
  color?: string
  height?: number
  label?: string
}) {
  const total = peaks.length || 1
  const barColor = (i: number) => {
    if (!segments?.length) return color
    const rel = i / total
    const seg = segments.find((s) => rel >= s.from && rel < s.to)
    return seg?.color ?? color
  }
  return (
    <div
      className="wave"
      style={{ height }}
      role="img"
      aria-label={label ?? 'forme d’onde'}
    >
      {peaks.map((p, i) => (
        <span
          key={i}
          className={`wave-bar${i / total <= progress ? ' played' : ''}`}
          style={{ height: `${Math.max(4, p * 100)}%`, background: barColor(i) }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ tabs -- */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; count?: number }[]
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          className={`tab${value === it.value ? ' is-active' : ''}`}
          onClick={() => onChange(it.value)}
        >
          {it.label}
          {typeof it.count === 'number' && <span className="tab-count">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ empty/error -- */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true">◌</div>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

export function ErrorBox({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="errorbox" role="alert">
      <p className="error-title">{title}</p>
      {hint && <p className="error-hint">{hint}</p>}
      {action && <div className="error-action">{action}</div>}
    </div>
  )
}

/* --------------------------------------------------------------- spinner -- */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner-dot" />
      <span className="spinner-dot" />
      <span className="spinner-dot" />
      {label && <span className="spinner-label">{label}</span>}
    </div>
  )
}

/* ---------------------------------------------------------------- icons -- */
export function PlayIcon({ playing }: { playing: boolean }) {
  return <span aria-hidden="true">{playing ? '■' : '▶'}</span>
}

export function UniverseMark({ icon, color }: { icon?: string; color: string }) {
  const common = { stroke: color, fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round' as const }
  return (
    <svg className="uni-mark" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      {icon === 'zigzag' && <polyline points="4,22 10,10 16,22 22,10 28,22" {...common} />}
      {icon === 'cercles' && (
        <>
          <circle cx="16" cy="16" r="11" {...common} />
          <circle cx="16" cy="16" r="6" {...common} />
          <circle cx="16" cy="16" r="1.6" fill={color} stroke="none" />
        </>
      )}
      {icon === 'onde' && <path d="M3 18c4-8 7-8 11 0s7 8 11 0 4-6 4-6" {...common} />}
      {icon === 'courbe' && <path d="M3 22c6 0 8-12 14-12s6 10 12 10" {...common} />}
      {!icon && <circle cx="16" cy="16" r="10" {...common} />}
    </svg>
  )
}

/** Petit texte utilitaire : "3 sons", "Bientôt"… */
export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`
export const tStep = (id: number) => t('step.label', { id })
