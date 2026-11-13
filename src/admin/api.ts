/** Typed client for the Super Admin API. Always sends the anti-CSRF header. */

export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

const HEADERS = { 'x-so-admin': '1' }

async function parse(res: Response) {
  const text = await res.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) {
    const message = (body && typeof body === 'object' && 'error' in body)
      ? String((body as { error: string }).error)
      : `HTTP ${res.status}`
    throw new ApiError(res.status, message, (body as { detail?: unknown })?.detail)
  }
  return body
}

export const api = {
  get: <T,>(path: string) => fetch(path, { headers: HEADERS }).then((r) => parse(r) as Promise<T>),
  send: <T,>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
    fetch(path, {
      method,
      headers: { ...HEADERS, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => parse(r) as Promise<T>),
  upload: <T,>(path: string, blob: Blob, contentType: string) =>
    fetch(path, { method: 'POST', headers: { ...HEADERS, 'content-type': contentType }, body: blob })
      .then((r) => parse(r) as Promise<T>),
}

/* ------------------------------------------------------------------- types */
export interface Me {
  user: { id: string; email: string; name: string; role: string; mustChangePassword: boolean }
  permissions: string[]
  rolePermissions: string[]
}

export interface SoundRow {
  id: string; code: string; name: string; step_id: number | null; duration_s: number | null
  status: string; availability: string; sensitive: number; license: string | null
  credits: string | null; nature: string | null; source: string | null; file: string | null; version: number
  updated_at: string; analysis_version: string | null; versions: number
  provenance: string | null; validation_status: string | null
}

export interface SoundVersion {
  id: number; version: number; file_path: string | null; sha256: string | null
  bytes: number | null; duration_s: number | null; sample_rate: number | null
  channels: number | null; analyzed_at: string | null; note: string | null
}

export interface SoundDetail {
  sound: SoundRow
  restriction: { sensitive: number; availability: string; provenance: string | null
    validation_status: string; note: string | null } | null
  versions: SoundVersion[]
  contents: ContentRow[]
  steps: { id: number; name_fr: string; position: number }[]
  analysis: Record<string, unknown> | null
  analysisFresh: boolean
}

export interface ContentRow {
  id: string; sound_id: string; locale: string; title: string | null; short_desc: string | null
  story: string | null; pedagogy: string | null; credits_note: string | null; sources: string | null
  status: 'draft' | 'review' | 'approved' | 'published'; version: number; updated_at: string
  ai_generated: number; sound_name?: string
}

export interface StepRow {
  id: number; code: string; display_no: number; name_fr: string; name_en: string | null
  description: string | null; story: string | null; illustration: string | null
  qr: string | null; status: string; updated_at: string
  sounds?: { sound_id: string; position: number; name: string; sensitive: number }[]
}

export interface UniverseRow {
  id: string; name: string; description: string | null; status: string; version: number
  params: Record<string, unknown> | null; engine_implemented: number
}

export interface DashboardData {
  sounds: number; steps: number; selectedSounds: number; sensitive: number
  active: number; inactive: number; pendingReview: number; publications: number
  universes: { id: string; name: string; status: string; engine_implemented: number }[]
  recentChanges: { at: string; actor_email: string | null; action: string; entity: string | null; entity_id: string | null }[]
  analysis: { total: number; stale: number; versions: number }
  files: { missing: number; checked: number }
  generatedAt: string
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const fmtBytes = (n: number | null | undefined) =>
  n == null ? '—' : n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(1)} Ko` : `${(n / 1048576).toFixed(1)} Mo`

export const fmtDur = (s: number | null | undefined) =>
  s == null ? '—' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
