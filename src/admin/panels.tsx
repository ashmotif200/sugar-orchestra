import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, fmtDate, fmtDur, type DashboardData, type SoundDetail, type SoundRow } from './api'
import type { Navigate } from './AdminApp'

/* ------------------------------------------------------------------ shared */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reload = useCallback(async () => {
    setBusy(true)
    setError(null)
    try { setData(await fnRef.current()) } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message)
    } finally { setBusy(false) }
  }, [])
  useEffect(() => { void reload() }, [reload, ...deps])
  return { data, error, busy, reload }
}

export const Pill = ({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; children: React.ReactNode }) => (
  <span className={`adm-pill adm-pill-${tone}`}>{children}</span>
)

export function Card({ title, actions, children }: { title?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="adm-card">
      {(title || actions) && <header>{title && <h2>{title}</h2>}{actions}</header>}
      {children}
    </section>
  )
}

export function ErrorLine({ msg }: { msg: string | null }) {
  return msg ? <p className="adm-error" role="alert">{msg}</p> : null
}

/* --------------------------------------------------------------- dashboard */
export function Dashboard({ navigate }: { navigate: Navigate }) {
  const { data, error, busy, reload } = useAsync<DashboardData>(() => api.get('/api/dashboard'))
  if (busy && !data) return <p className="adm-muted">Chargement des indicateurs…</p>
  if (error) return <><ErrorLine msg={error} /><button className="adm-ghost" onClick={() => void reload()}>Réessayer</button></>
  if (!data) return null

  const metrics = [
    { k: 'Étapes', v: data.steps, note: `${data.selectedSounds} sons rattachés` },
    { k: 'Sons au catalogue', v: data.sounds, note: `${data.active} actifs · ${data.inactive} inactifs` },
    { k: 'Sons sélectionnés', v: data.selectedSounds, note: `sélection muséographique (v2)` },
    { k: 'Sons sensibles', v: data.sensitive, note: 'interdits à la composition' },
    { k: 'Contenus à vérifier', v: data.pendingReview, note: 'draft ou review' },
    { k: 'Univers musicaux', v: data.universes.length, note: `${data.universes.filter((u) => u.engine_implemented).length} implémenté(s)` },
    { k: 'Analyses à refaire', v: data.analysis.stale, note: `sur ${data.analysis.total} sons` },
    { k: 'Versions audio', v: data.analysis.versions, note: `${data.publications} publication(s)` },
  ]

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Tableau de bord</h1>
          <p className="adm-muted">Données réelles, lues dans la base de l’administration — {fmtDate(data.generatedAt)}.</p>
        </div>
        <button className="adm-ghost" onClick={() => void reload()}>Actualiser</button>
      </header>

      <div className="adm-metrics">
        {metrics.map((m) => (
          <div className="adm-metric" key={m.k}>
            <b>{m.v}</b>
            <span>{m.k}</span>
            <i>{m.note}</i>
          </div>
        ))}
      </div>

      <div className="adm-cols">
        <Card title="Univers musicaux">
          <table className="adm-table">
            <thead><tr><th>Univers</th><th>Statut</th><th>Moteur</th></tr></thead>
            <tbody>
              {data.universes.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b><br /><span className="adm-mono">{u.id}</span></td>
                  <td><Pill tone={u.status === 'published' ? 'ok' : 'muted'}>{u.status}</Pill></td>
                  <td>{u.engine_implemented ? <Pill tone="ok">implémenté</Pill> : <Pill tone="warn">sans compositeur</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="État des fichiers et analyses">
          <dl className="adm-kv">
            <dt>Sons dont le fichier manque</dt><dd>{data.files.missing} / {data.files.checked}</dd>
            <dt>Analyses invalidées</dt><dd>{data.analysis.stale}</dd>
            <dt>Publications</dt><dd>{data.publications}</dd>
          </dl>
          {data.files.missing > 0 && (
            <p className="adm-alert">Des fichiers audio référencés sont absents du disque. Voir la bibliothèque sonore.</p>
          )}
          <button className="adm-ghost" onClick={() => navigate('#/admin/sounds')}>Ouvrir la bibliothèque</button>
        </Card>
      </div>

      <Card title="Dernières modifications">
        {data.recentChanges.length === 0
          ? <p className="adm-muted">Aucune action enregistrée pour l’instant.</p>
          : (
            <table className="adm-table">
              <thead><tr><th>Date</th><th>Compte</th><th>Action</th><th>Objet</th></tr></thead>
              <tbody>
                {data.recentChanges.map((c, i) => (
                  <tr key={i}>
                    <td>{fmtDate(c.at)}</td>
                    <td>{c.actor_email ?? '—'}</td>
                    <td><span className="adm-mono">{c.action}</span></td>
                    <td>{c.entity ? `${c.entity} ${c.entity_id ?? ''}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ sounds */
export function Sounds() {
  const [q, setQ] = useState('')
  const [step, setStep] = useState('')
  const [status, setStatus] = useState('')
  const [onlySensitive, setOnlySensitive] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const { data, error, busy, reload } = useAsync<{ count: number; sounds: SoundRow[] }>(
    () => api.get('/api/sounds'), [])

  const rows = useMemo(() => {
    let r = data?.sounds ?? []
    const needle = q.toLowerCase().trim()
    if (needle) r = r.filter((s) => `${s.id} ${s.name} ${s.credits ?? ''}`.toLowerCase().includes(needle))
    if (step) r = r.filter((s) => String(s.step_id) === step)
    if (status) r = r.filter((s) => s.status === status)
    if (onlySensitive) r = r.filter((s) => s.sensitive === 1)
    return r
  }, [data, q, step, status, onlySensitive])

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Bibliothèque sonore</h1>
          <p className="adm-muted">{data?.count ?? '—'} sons au catalogue · fichiers originaux jamais modifiés par l’administration.</p>
        </div>
        <button className="adm-ghost" onClick={() => void reload()}>Actualiser</button>
      </header>
      <ErrorLine msg={error} />

      <div className="adm-filters">
        <input placeholder="Rechercher (code, nom, crédit)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={step} onChange={(e) => setStep(e.target.value)}>
          <option value="">Toutes les étapes</option>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>Étape {n}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="active">actifs</option>
          <option value="inactive">inactifs</option>
        </select>
        <label className="adm-check">
          <input type="checkbox" checked={onlySensitive} onChange={(e) => setOnlySensitive(e.target.checked)} />
          sensibles seulement
        </label>
        <span className="adm-muted">{rows.length} résultat(s)</span>
      </div>

      {busy && !data ? <p className="adm-muted">Chargement…</p> : (
        <Card>
          <table className="adm-table adm-table-click">
            <thead>
              <tr><th>Code</th><th>Nom</th><th>Étape</th><th>Durée</th><th>Statut</th><th>Licence</th><th>Sensible</th><th>Versions</th><th>Modifié</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => setOpenId(s.id)}>
                  <td className="adm-mono">{s.id}</td>
                  <td>{s.name}</td>
                  <td>{s.step_id ?? '—'}</td>
                  <td>{fmtDur(s.duration_s)}</td>
                  <td><Pill tone={s.status === 'active' ? 'ok' : 'muted'}>{s.status}</Pill></td>
                  <td className="adm-small">{s.license ?? '—'}</td>
                  <td>{s.sensitive ? <Pill tone="bad">sensible</Pill> : <Pill tone="ok">non</Pill>}</td>
                  <td>{s.versions}</td>
                  <td className="adm-small">{fmtDate(s.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {openId && <SoundDetailPanel id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </>
  )
}

function SoundDetailPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, error, busy, reload } = useAsync<SoundDetail>(() => api.get(`/api/sounds/${id}`), [id])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const replace = async (file: File) => {
    if (!window.confirm(`Remplacer le fichier de ${id} par « ${file.name} » ?\n\nL’ancienne version est conservée, une nouvelle version est créée, et les analyses existantes seront invalidées.`)) return
    setBusyAction('replace'); setActionError(null); setNote(null)
    try {
      const r = await api.upload<{ version: number; sha256: string; analysisState: string }>(
        `/api/sounds/${id}/replacement`, file, file.type || 'audio/wav')
      setNote(`Version ${r.version} créée (${r.sha256.slice(0, 12)}…). Analyses marquées « ${r.analysisState} ».`)
      await reload(); onChanged()
    } catch (e) { setActionError(e instanceof ApiError ? e.message : 'échec du remplacement') }
    finally { setBusyAction(null); if (fileRef.current) fileRef.current.value = '' }
  }

  const restore = async (version: number) => {
    if (!window.confirm(`Restaurer la version ${version} ? Une nouvelle version sera créée à partir de celle-ci (rien n’est écrasé).`)) return
    setBusyAction(`restore-${version}`); setActionError(null); setNote(null)
    try {
      const r = await api.send<{ version: number }>('POST', `/api/sounds/${id}/restore/${version}`)
      setNote(`Version ${r.version} créée depuis la version ${version}.`)
      await reload(); onChanged()
    } catch (e) { setActionError(e instanceof ApiError ? e.message : 'échec de la restauration') }
    finally { setBusyAction(null) }
  }

  const reanalyse = async () => {
    setBusyAction('reanalyse'); setActionError(null); setNote(null)
    try {
      const r = await api.send<{ analysisVersion: string }>('POST', `/api/sounds/${id}/reanalyse`)
      setNote(`Analyse relancée avec la chaîne locale (${r.analysisVersion}).`)
      await reload()
    } catch (e) {
      setActionError(e instanceof ApiError ? `Analyse indisponible : ${e.message}${e.detail ? ' — ' + String(e.detail) : ''}` : 'échec')
    } finally { setBusyAction(null) }
  }

  return (
    <div className="adm-drawer" role="dialog" aria-label={`Fiche ${id}`}>
      <div className="adm-drawer-in">
        <header className="adm-head">
          <div>
            <h2>{data?.sound.name ?? id}</h2>
            <p className="adm-muted"><span className="adm-mono">{id}</span> · étape {data?.sound.step_id ?? '—'} · version {data?.sound.version}</p>
          </div>
          <button className="adm-ghost" onClick={onClose}>Fermer</button>
        </header>
        {busy && !data && <p className="adm-muted">Chargement de la fiche…</p>}
        <ErrorLine msg={error} />
        <ErrorLine msg={actionError} />
        {note && <p className="adm-ok">{note}</p>}

        {data && (
          <>
            {data.restriction?.sensitive === 1 && (
              <div className="adm-restriction">
                <b>Son sous restriction éditoriale</b>
                <p>
                  Provenance : {data.restriction.provenance ?? 'catalogue'} · statut : {data.restriction.validation_status}.
                  {' '}Il reste interdit à la composition automatique. L’administration ne peut pas lever cette
                  restriction : elle exige une validation éditoriale explicite, hors de cette interface.
                </p>
              </div>
            )}

            <Card title="Écoute">
              <audio controls preload="none" src={`/api/sounds/${id}/audio`} className="adm-audio" />
              <p className="adm-muted adm-small">
                Le lecteur sert le fichier de la version courante via l’API (authentifiée), pas la copie web publique.
              </p>
            </Card>

            <Card title="Métadonnées (lecture seule)">
              <dl className="adm-kv">
                <dt>Nom</dt><dd>{data.sound.name}</dd>
                <dt>Nature</dt><dd>{data.sound.nature ?? '—'}</dd>
                <dt>Crédits</dt><dd>{data.sound.credits ?? '—'}</dd>
                <dt>Licence</dt><dd>{data.sound.license ?? '—'}</dd>
                <dt>Source</dt><dd>{data.sound.source ?? '—'}</dd>
                <dt>Disponibilité</dt><dd>{data.sound.availability}</dd>
                <dt>Analyse</dt><dd>{data.analysisFresh ? 'à jour' : 'invalidée — à relancer'}</dd>
              </dl>
              <p className="adm-muted adm-small">Les métadonnées du catalogue ne sont pas modifiables ici : elles viennent de l’inventaire du musée.</p>
            </Card>

            <Card title="Remplacer le fichier audio">
              <p className="adm-small">
                Formats acceptés : WAV, MP3, M4A, FLAC (≤ 25 Mo). Le fichier est vérifié (format, intégrité, empreinte),
                conservé comme nouvelle version, et l’original n’est jamais écrasé.
              </p>
              <input ref={fileRef} type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/flac"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void replace(f) }}
                disabled={busyAction !== null} />
              {busyAction === 'replace' && <p className="adm-muted">Envoi et vérification…</p>}
              <div className="adm-row">
                <button className="adm-ghost" disabled={busyAction !== null} onClick={() => void reanalyse()}>
                  {busyAction === 'reanalyse' ? 'Analyse…' : 'Relancer l’analyse acoustique'}
                </button>
                <span className="adm-muted adm-small">Utilise la chaîne d’analyse locale (librosa) si elle est installée.</span>
              </div>
            </Card>

            <Card title={`Versions (${data.versions.length})`}>
              <table className="adm-table">
                <thead><tr><th>Version</th><th>Fichier</th><th>Empreinte</th><th>Durée</th><th>Créée</th><th>Note</th><th /></tr></thead>
                <tbody>
                  {data.versions.map((v) => (
                    <tr key={v.id}>
                      <td><b>v{v.version}</b>{v.version === data.sound.version && <Pill tone="ok">courante</Pill>}</td>
                      <td className="adm-small adm-mono">{v.file_path ? v.file_path.split('/').slice(-2).join('/') : '—'}</td>
                      <td className="adm-mono adm-small">{v.sha256 ? v.sha256.slice(0, 10) + '…' : '—'}</td>
                      <td>{fmtDur(v.duration_s)}</td>
                      <td className="adm-small">{fmtDate(v.analyzed_at)}</td>
                      <td className="adm-small">{v.note ?? '—'}</td>
                      <td>
                        {v.version !== data.sound.version && (
                          <button className="adm-link" disabled={busyAction !== null} onClick={() => void restore(v.version)}>
                            restaurer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {data.analysis && (
              <Card title="Analyse acoustique existante">
                <dl className="adm-kv">
                  {Object.entries(data.analysis).slice(0, 14).map(([k, v]) => (
                    <><dt key={`d-${k}`}>{k}</dt><dd key={`v-${k}`}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></>
                  ))}
                </dl>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
