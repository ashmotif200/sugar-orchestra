import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, fmtDate, type ContentRow, type Me, type SoundRow, type StepRow, type UniverseRow } from './api'
import { audio, catalog, soundById } from '../audio/service'
import { buildScore, CompositionRefused, type Score } from '../engine/plan'
import { UNIVERSES } from '../engine/universes'
import { Card, ErrorLine, Pill, useAsync } from './panels'

/* ----------------------------------------------------------------- content */
const STATUS_TONE = { draft: 'muted', review: 'warn', approved: 'ok', published: 'ok' } as const

export function Content() {
  const [selected, setSelected] = useState<{ soundId: string; locale: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const { data, error, busy, reload } = useAsync<{ count: number; content: ContentRow[] }>(
    () => api.get('/api/content'))

  const rows = useMemo(() => {
    const r = data?.content ?? []
    return statusFilter ? r.filter((c) => c.status === statusFilter) : r
  }, [data, statusFilter])

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Contenus &amp; histoires</h1>
          <p className="adm-muted">
            Circuit éditorial : brouillon → relecture → approuvé → publié. Une modification ne remplace jamais
            le contenu public avant publication.
          </p>
        </div>
        <button className="adm-ghost" onClick={() => void reload()}>Actualiser</button>
      </header>
      <ErrorLine msg={error} />

      <div className="adm-filters">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="draft">brouillon</option>
          <option value="review">en relecture</option>
          <option value="approved">approuvé</option>
          <option value="published">publié</option>
        </select>
        <span className="adm-muted">{rows.length} fiche(s) · {busy ? 'chargement…' : `${data?.count ?? 0} au total`}</span>
      </div>

      <Card>
        <table className="adm-table adm-table-click">
          <thead><tr><th>Son</th><th>Langue</th><th>Titre</th><th>Statut</th><th>Version</th><th>Modifié</th><th>IA</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => setSelected({ soundId: c.sound_id, locale: c.locale })}>
                <td className="adm-mono">{c.sound_id}</td>
                <td>{c.locale}</td>
                <td>{c.title ?? <span className="adm-muted">(sans titre)</span>}</td>
                <td><Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill></td>
                <td>v{c.version}</td>
                <td className="adm-small">{fmtDate(c.updated_at)}</td>
                <td>{c.ai_generated ? <Pill tone="warn">IA</Pill> : '—'}</td>
              </tr>
            ))}
            {!rows.length && !busy && (
              <tr><td colSpan={7} className="adm-muted">
                Aucun contenu encore rédigé. Sélectionnez un son dans la bibliothèque ou créez une fiche ci-dessous.
              </td></tr>
            )}
          </tbody>
        </table>
        <div className="adm-row">
          <NewContentForm onCreated={(soundId, locale) => { void reload(); setSelected({ soundId, locale }) }} />
        </div>
      </Card>

      {selected && (
        <ContentEditor
          soundId={selected.soundId}
          locale={selected.locale}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </>
  )
}

function NewContentForm({ onCreated }: { onCreated: (soundId: string, locale: string) => void }) {
  const [soundId, setSoundId] = useState('')
  const [locale, setLocale] = useState('fr')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const create = async () => {
    setBusy(true); setErr(null)
    try {
      await api.send('PATCH', `/api/content/${soundId}:${locale}`, {})
      onCreated(soundId, locale)
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') } finally { setBusy(false) }
  }
  return (
    <>
      <input placeholder="code du son (ex. 01_01)" value={soundId} onChange={(e) => setSoundId(e.target.value)} />
      <select value={locale} onChange={(e) => setLocale(e.target.value)}>
        <option value="fr">français</option>
        <option value="en">anglais</option>
      </select>
      <button className="adm-primary" disabled={!soundId || busy} onClick={() => void create()}>
        Créer une fiche
      </button>
      <ErrorLine msg={err} />
    </>
  )
}

function ContentEditor({ soundId, locale, onClose, onChanged }: {
  soundId: string; locale: string; onClose: () => void; onChanged: () => void
}) {
  const [form, setForm] = useState({ title: '', short_desc: '', story: '', pedagogy: '', credits_note: '', sources: '', ai_generated: false })
  const [status, setStatus] = useState<string>('draft')
  const [versions, setVersions] = useState<{ version: number; status: string; at: string; note: string | null }[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ content: ContentRow; versions: { version: number; status: string; at: string; note: string | null }[] }>(`/api/content/${soundId}:${locale}`)
      setForm({
        title: d.content.title ?? '', short_desc: d.content.short_desc ?? '', story: d.content.story ?? '',
        pedagogy: d.content.pedagogy ?? '', credits_note: d.content.credits_note ?? '',
        sources: d.content.sources ?? '', ai_generated: !!d.content.ai_generated,
      })
      setStatus(d.content.status)
      setVersions(d.versions)
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec du chargement') }
  }, [soundId, locale])
  useEffect(() => { void load() }, [load])

  const save = async () => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      const r = await api.send<{ content: ContentRow }>('PATCH', `/api/content/${soundId}:${locale}`, form)
      setStatus(r.content.status)
      setMsg(`Enregistré en version ${r.content.version} (statut : ${r.content.status}).`)
      await load(); onChanged()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') } finally { setBusy(false) }
  }

  const transition = async (to: string) => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await api.send('POST', `/api/content/${soundId}:${locale}/transition`, { to })
      setStatus(to)
      setMsg(`Statut : ${to}.`)
      await load(); onChanged()
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.message}${e.detail ? ' — autorisé : ' + JSON.stringify(e.detail) : ''}` : 'échec')
    } finally { setBusy(false) }
  }

  const revert = async (version: number) => {
    if (!window.confirm(`Revenir à la version ${version} ? Elle sera recopiée comme nouveau brouillon.`)) return
    setBusy(true); setErr(null); setMsg(null)
    try {
      const r = await api.send<{ version: number }>('POST', `/api/content/${soundId}:${locale}/revert/${version}`)
      setMsg(`Version ${r.version} créée à partir de la version ${version} (brouillon).`)
      await load(); onChanged()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') } finally { setBusy(false) }
  }

  const field = (k: keyof typeof form, label: string, rows?: number) => (
    <label className="adm-field">
      {label}
      {rows
        ? <textarea rows={rows} value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        : <input value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />}
    </label>
  )

  return (
    <div className="adm-drawer" role="dialog" aria-label={`Contenu ${soundId}`}>
      <div className="adm-drawer-in">
        <header className="adm-head">
          <div>
            <h2>{soundId} · {locale}</h2>
            <p className="adm-muted">Statut actuel : <Pill tone={STATUS_TONE[status as keyof typeof STATUS_TONE] ?? 'muted'}>{status}</Pill></p>
          </div>
          <button className="adm-ghost" onClick={onClose}>Fermer</button>
        </header>
        <ErrorLine msg={err} />
        {msg && <p className="adm-ok">{msg}</p>}

        <Card title="Texte">
          {field('title', 'Titre public')}
          {field('short_desc', 'Description courte', 2)}
          {field('story', 'Histoire détaillée', 6)}
          {field('pedagogy', 'Contenu pédagogique', 4)}
          {field('credits_note', 'Note de crédits')}
          {field('sources', 'Sources historiques')}
          <label className="adm-check">
            <input type="checkbox" checked={form.ai_generated}
              onChange={(e) => setForm({ ...form, ai_generated: e.target.checked })} />
            texte assisté par IA (ne pourra pas être approuvé comme information vérifiée)
          </label>
          <div className="adm-row">
            <button className="adm-primary" disabled={busy} onClick={() => void save()}>
              {busy ? 'Enregistrement…' : 'Enregistrer en brouillon'}
            </button>
          </div>
        </Card>

        <Card title="Circuit éditorial">
          <div className="adm-row">
            <button className="adm-ghost" disabled={busy || status !== 'draft'} onClick={() => void transition('review')}>Envoyer en relecture</button>
            <button className="adm-ghost" disabled={busy || status !== 'review'} onClick={() => void transition('approved')}>Approuver</button>
            <button className="adm-ghost" disabled={busy || status !== 'approved'} onClick={() => void transition('published')}>Publier ce contenu</button>
          </div>
          <p className="adm-muted adm-small">
            Publier ce contenu le marque comme publiable ; la version visiteur ne change qu’après une
            publication explicite du catalogue (voir Système).
          </p>
        </Card>

        <Card title={`Historique (${versions.length})`}>
          <table className="adm-table">
            <thead><tr><th>Version</th><th>Statut</th><th>Date</th><th>Note</th><th /></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={`${v.version}-${v.at}`}>
                  <td>v{v.version}</td>
                  <td>{v.status}</td>
                  <td className="adm-small">{fmtDate(v.at)}</td>
                  <td className="adm-small">{v.note ?? '—'}</td>
                  <td><button className="adm-link" disabled={busy} onClick={() => void revert(v.version)}>revenir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- steps */
export function Steps() {
  const { data, error, busy, reload } = useAsync<{ steps: StepRow[] }>(() => api.get('/api/steps'))
  const [openId, setOpenId] = useState<number | null>(null)

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Étapes du musée</h1>
          <p className="adm-muted">
            Sept étapes (base : <span className="adm-mono">config/steps.v2.json</span>). L’identifiant est stable ;
            le numéro d’affichage en découle et n’est pas modifiable. Les étapes ne correspondent pas aux anciennes
            séquences du catalogue : un son peut appartenir à une étape différente de sa séquence d’inventaire.
          </p>
        </div>
        <button className="adm-ghost" onClick={() => void reload()}>Actualiser</button>
      </header>
      <ErrorLine msg={error} />
      {busy && !data && <p className="adm-muted">Chargement…</p>}

      <div className="adm-steps">
        {(data?.steps ?? []).map((s) => (
          <button key={s.id} className={`adm-step ${openId === s.id ? 'is-on' : ''}`} onClick={() => setOpenId(s.id)}>
            <b>{s.display_no}</b>
            <span>{s.name_fr}</span>
            <i>{s.sounds?.length ?? 0} son(s) · {s.status}</i>
          </button>
        ))}
      </div>

      {openId != null && <StepEditor id={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </>
  )
}

function StepEditor({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [step, setStep] = useState<StepRow | null>(null)
  const [sounds, setSounds] = useState<{ sound_id: string; position: number; name: string; sensitive: number }[]>([])
  const [allSounds, setAllSounds] = useState<SoundRow[]>([])
  const [addId, setAddId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ step: StepRow; sounds: typeof sounds }>(`/api/steps/${id}`)
      setStep(d.step)
      setSounds(d.sounds)
      const all = await api.get<{ sounds: SoundRow[] }>('/api/sounds')
      setAllSounds(all.sounds)
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') }
  }, [id])
  useEffect(() => { void load() }, [load])

  const saveStep = async () => {
    if (!step) return
    setBusy(true); setErr(null); setMsg(null)
    try {
      await api.send('PATCH', `/api/steps/${id}`, {
        name_fr: step.name_fr, name_en: step.name_en, description: step.description,
        story: step.story, illustration: step.illustration, qr: step.qr, status: step.status,
      })
      setMsg('Étape enregistrée.')
      await load(); onChanged()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') } finally { setBusy(false) }
  }

  const saveOrder = async (next: typeof sounds) => {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await api.send('PUT', `/api/steps/${id}/sounds`, { sounds: next.map((s) => s.sound_id) })
      setSounds(next)
      setMsg('Ordre des sons enregistré.')
      onChanged()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') } finally { setBusy(false) }
  }

  const move = (i: number, dir: -1 | 1) => {
    const next = [...sounds]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    void saveOrder(next)
  }

  if (!step) return <p className="adm-muted">Chargement de l’étape…</p>

  return (
    <div className="adm-drawer" role="dialog" aria-label={`Étape ${id}`}>
      <div className="adm-drawer-in">
        <header className="adm-head">
          <div>
            <h2>Étape {step.display_no} — {step.name_fr}</h2>
            <p className="adm-muted"><span className="adm-mono">{step.code}</span> · identifiant stable {step.id}</p>
          </div>
          <button className="adm-ghost" onClick={onClose}>Fermer</button>
        </header>
        <ErrorLine msg={err} />
        {msg && <p className="adm-ok">{msg}</p>}

        <Card title="Contenu de l’étape">
          <label className="adm-field">Nom (français)
            <input value={step.name_fr} onChange={(e) => setStep({ ...step, name_fr: e.target.value })} />
          </label>
          <label className="adm-field">Nom (anglais)
            <input value={step.name_en ?? ''} onChange={(e) => setStep({ ...step, name_en: e.target.value })} />
          </label>
          <label className="adm-field">Description
            <textarea rows={3} value={step.description ?? ''} onChange={(e) => setStep({ ...step, description: e.target.value })} />
          </label>
          <label className="adm-field">Histoire
            <textarea rows={4} value={step.story ?? ''} onChange={(e) => setStep({ ...step, story: e.target.value })} />
          </label>
          <div className="adm-row">
            <label className="adm-field">Illustration (chemin)
              <input value={step.illustration ?? ''} onChange={(e) => setStep({ ...step, illustration: e.target.value })} />
            </label>
            <label className="adm-field">QR code / lien profond
              <input value={step.qr ?? ''} onChange={(e) => setStep({ ...step, qr: e.target.value })} />
            </label>
            <label className="adm-field">Statut
              <select value={step.status} onChange={(e) => setStep({ ...step, status: e.target.value })}>
                <option value="draft">brouillon</option>
                <option value="review">en relecture</option>
                <option value="published">publiée</option>
              </select>
            </label>
          </div>
          <button className="adm-primary" disabled={busy} onClick={() => void saveStep()}>Enregistrer l’étape</button>
        </Card>

        <Card title={`Sons associés (${sounds.length})`}>
          <table className="adm-table">
            <thead><tr><th>#</th><th>Son</th><th>Nom</th><th>Restriction</th><th>Ordre</th></tr></thead>
            <tbody>
              {sounds.map((s, i) => (
                <tr key={s.sound_id}>
                  <td>{i + 1}</td>
                  <td className="adm-mono">{s.sound_id}</td>
                  <td>{s.name}</td>
                  <td>{s.sensitive ? <Pill tone="bad">sensible</Pill> : <Pill tone="ok">libre</Pill>}</td>
                  <td>
                    <button className="adm-link" disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</button>{' '}
                    <button className="adm-link" disabled={busy || i === sounds.length - 1} onClick={() => move(i, 1)}>↓</button>{' '}
                    <button className="adm-link" disabled={busy}
                      onClick={() => void saveOrder(sounds.filter((x) => x.sound_id !== s.sound_id))}>retirer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="adm-row">
            <select value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">ajouter un son…</option>
              {allSounds.filter((s) => !sounds.some((x) => x.sound_id === s.id)).map((s) => (
                <option key={s.id} value={s.id}>{s.id} — {s.name}{s.sensitive ? ' (sensible)' : ''}</option>
              ))}
            </select>
            <button className="adm-ghost" disabled={!addId || busy}
              onClick={() => {
                const s = allSounds.find((x) => x.id === addId)
                if (s) void saveOrder([...sounds, { sound_id: s.id, position: sounds.length + 1, name: s.name, sensitive: s.sensitive }])
                setAddId('')
              }}>Ajouter</button>
          </div>
          <p className="adm-muted adm-small">
            Ajouter un son sensible à une étape ne le rend pas utilisable en composition : le moteur l’exclut
            toujours (garde-fou inchangé).
          </p>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- music */
export function Music() {
  const { data, error, busy, reload } = useAsync<{ universes: UniverseRow[]; note: string }>(() => api.get('/api/music'))
  const [editing, setEditing] = useState<Record<string, { name: string; description: string; status: string }>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const save = async (u: UniverseRow) => {
    const form = editing[u.id] ?? { name: u.name, description: u.description ?? '', status: u.status }
    setErr(null); setMsg(null)
    try {
      await api.send('PATCH', `/api/music/${u.id}`, form)
      setMsg(`${u.name} enregistré.`)
      await reload()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') }
  }

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Studio musical</h1>
          <p className="adm-muted">
            Données de référence des quatre univers. Les paramètres d’arrangement ne sont pas modifiables ici :
            le moteur ne les lit pas encore, et un contrôle qui ne change rien serait un mensonge d’interface.
          </p>
        </div>
        <button className="adm-ghost" onClick={() => void reload()}>Actualiser</button>
      </header>
      <ErrorLine msg={error} />
      <ErrorLine msg={err} />
      {msg && <p className="adm-ok">{msg}</p>}
      {busy && !data && <p className="adm-muted">Chargement…</p>}

      <div className="adm-grid">
        {(data?.universes ?? []).map((u) => {
          const form = editing[u.id] ?? { name: u.name, description: u.description ?? '', status: u.status }
          return (
            <Card key={u.id} title={u.name}>
              <p className="adm-mono adm-small">{u.id} · v{u.version}</p>
              <p>
                {u.engine_implemented
                  ? <Pill tone="ok">compositeur présent</Pill>
                  : <Pill tone="warn">aucun compositeur dans le moteur</Pill>}
              </p>
              <dl className="adm-kv">
                <dt>Paramètres moteur</dt>
                <dd><span className="adm-mono">{JSON.stringify(u.params ?? {})}</span></dd>
              </dl>
              <label className="adm-field">Nom
                <input value={form.name} onChange={(e) => setEditing({ ...editing, [u.id]: { ...form, name: e.target.value } })} />
              </label>
              <label className="adm-field">Description
                <textarea rows={2} value={form.description}
                  onChange={(e) => setEditing({ ...editing, [u.id]: { ...form, description: e.target.value } })} />
              </label>
              <label className="adm-field">Statut
                <select value={form.status}
                  onChange={(e) => setEditing({ ...editing, [u.id]: { ...form, status: e.target.value } })}>
                  <option value="draft">brouillon</option>
                  <option value="published">publié</option>
                </select>
              </label>
              <button className="adm-ghost" onClick={() => void save(u)}>Enregistrer</button>
            </Card>
          )
        })}
      </div>
      <p className="adm-muted adm-small">{data?.note}</p>
    </>
  )
}

/* --------------------------------------------------------------- developer */
export function Developer() {
  const [stepId, setStepId] = useState(1)
  const [universeId, setUniverseId] = useState('electro-sega')
  const [selected, setSelected] = useState<string[]>([])
  const [discovered, setDiscovered] = useState<string[]>([])
  const [log, setLog] = useState<string[]>([])
  const [rejected, setRejected] = useState<{ id: string; reason: string }[]>([])
  const [render, setRender] = useState<{ url: string; report: Record<string, unknown>; duration: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)

  const diag = useAsync<Record<string, never>>(() => api.get('/api/system/diagnostics'))
  const stepSounds = useMemo(() => catalog.sounds.filter((s) => s.stepId === stepId), [stepId])
  const available = useMemo(() => UNIVERSES.filter((u) => u.available), [])

  const note = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString('fr-FR')}  ${line}`, ...l].slice(0, 40))

  const discover = (id: string) => {
    setDiscovered((d) => (d.includes(id) ? d : [...d, id]))
    note(`découverte simulée : ${id}`)
  }

  const toggle = (id: string) => {
    const s = soundById(id)
    if (!s) return
    if (s.sensitive || s.availability === 'not_musical') {
      note(`refusé : ${id} est ${s.sensitive ? 'sensible' : 'non musical'} — jamais en composition`)
      return
    }
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
    note(`${selected.includes(id) ? 'retiré' : 'sélectionné'} : ${id}`)
  }

  const checkServer = async () => {
    setErr(null); setRejected([])
    try {
      const r = await api.send<{ accepted: string[]; rejected: { id: string; reason: string }[] }>(
        'POST', '/api/dev/selection', { universeId, soundIds: selected })
      setRejected(r.rejected)
      note(`contrôle serveur : ${r.accepted.length} accepté(s), ${r.rejected.length} refusé(s)`)
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') }
  }

  const compose = async () => {
    setBusy(true); setErr(null); setRender(null)
    try {
      const universe = UNIVERSES.find((u) => u.id === universeId)
      if (!universe) throw new Error('univers inconnu')
      const selection = selected.map((id) => soundById(id)).filter(Boolean) as NonNullable<ReturnType<typeof soundById>>[]
      const score: Score = buildScore({ universe, selection })
      const { buffer, report } = await audio.render(score)
      bufferRef.current = buffer
      setRender({
        url: '',
        report: {
          duration: buffer.duration.toFixed(2) + ' s',
          notes: score.notes.length,
          signatureSources: score.signatures.length,
          limits: score.limits,
          adaptations: score.adaptations.map((a) => `${a.role} ← ${a.sourceId}`),
          seed: score.seed,
          roles: score.roles,
          report,
        },
        duration: buffer.duration,
      })
      note(`composition : ${score.notes.length} événements, ${score.signatures.length} signatures, ${buffer.duration.toFixed(2)} s`)
    } catch (e) {
      if (e instanceof CompositionRefused) setErr(`composition refusée par le moteur : ${e.message}`)
      else setErr(e instanceof Error ? e.message : 'échec de composition')
    } finally { setBusy(false) }
  }

  const play = async () => {
    if (!bufferRef.current) return
    await audio.playPiece(bufferRef.current)
    note('lecture du rendu')
  }

  const download = () => {
    if (!bufferRef.current) return
    audio.exportWav(bufferRef.current, `admin-test-${universeId}-${Date.now()}.wav`)
    note('export WAV du rendu')
  }

  const reset = () => {
    setSelected([]); setDiscovered([]); setRejected([]); setLog([]); setRender(null)
    audio.stopPiece()
    note('session de test réinitialisée')
  }

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Outils développeur</h1>
          <p className="adm-muted">
            Simulation et tests locaux. Aucune session visiteur n’est touchée : cet état vit uniquement dans
            cette page. Les compositions utilisent le moteur existant, sans modification.
          </p>
        </div>
        <button className="adm-ghost" onClick={reset}>Réinitialiser la session de test</button>
      </header>
      <ErrorLine msg={err} />

      <div className="adm-cols">
        <Card title="Simulation du parcours">
          <div className="adm-row">
            <label className="adm-field">Étape
              <select value={stepId} onChange={(e) => setStepId(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>Étape {n}</option>)}
              </select>
            </label>
          </div>
          <table className="adm-table">
            <thead><tr><th>Son</th><th>Nom</th><th>État</th><th /></tr></thead>
            <tbody>
              {stepSounds.map((s) => (
                <tr key={s.id}>
                  <td className="adm-mono">{s.id}</td>
                  <td>{s.title ?? s.name}</td>
                  <td>
                    {discovered.includes(s.id) && <Pill tone="ok">découvert</Pill>}{' '}
                    {selected.includes(s.id) && <Pill tone="warn">sélectionné</Pill>}{' '}
                    {(s.sensitive || s.availability === 'not_musical') && <Pill tone="bad">interdit</Pill>}
                  </td>
                  <td>
                    <button className="adm-link" onClick={() => discover(s.id)}>découvrir</button>{' '}
                    <button className="adm-link" onClick={() => toggle(s.id)}>
                      {selected.includes(s.id) ? 'retirer' : 'sélectionner'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="adm-small adm-muted">
            Simulation de scan QR : les liens profonds du parcours sont <span className="adm-mono">#/etape/1…7</span>.
            Ouvrir <a href={`#/etape/${stepId}`}>#/etape/{stepId}</a> reproduit l’arrivée par QR code.
          </p>
          <dl className="adm-kv">
            <dt>Découverts</dt><dd>{discovered.length}</dd>
            <dt>Sélectionnés</dt><dd>{selected.length}</dd>
          </dl>
        </Card>

        <Card title="Test de composition">
          <label className="adm-field">Univers
            <select value={universeId} onChange={(e) => setUniverseId(e.target.value)}>
              {available.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.bpm} BPM)</option>)}
              {UNIVERSES.filter((u) => !u.available).map((u) => (
                <option key={u.id} value={u.id} disabled>{u.name} — sans compositeur</option>
              ))}
            </select>
          </label>
          <div className="adm-row">
            <button className="adm-ghost" disabled={!selected.length} onClick={() => void checkServer()}>
              Vérifier la sélection côté serveur
            </button>
            <button className="adm-primary" disabled={!selected.length || busy} onClick={() => void compose()}>
              {busy ? 'Composition…' : 'Composer avec le moteur'}
            </button>
          </div>
          {rejected.length > 0 && (
            <ul className="adm-list">
              {rejected.map((r) => <li key={r.id}><b>{r.id}</b> — {r.reason}</li>)}
            </ul>
          )}
          {render && (
            <>
              <div className="adm-row">
                <button className="adm-ghost" onClick={() => void play()}>Écouter</button>
                <button className="adm-ghost" onClick={() => audio.stopPiece()}>Arrêter</button>
                <button className="adm-ghost" onClick={download}>Télécharger le WAV</button>
              </div>
              <pre className="adm-pre">{JSON.stringify(render.report, null, 2)}</pre>
              <p className="adm-muted adm-small">
                Ces valeurs sont celles du moteur : durée, nombre d’événements, signatures, adaptations et limites.
                Aucun paramètre non lu par le moteur n’est affiché.
              </p>
            </>
          )}
        </Card>
      </div>

      <Card title="Journal de la session de test">
        {log.length ? <pre className="adm-pre">{log.join('\n')}</pre> : <p className="adm-muted">Aucune action.</p>}
      </Card>

      <Card title="Diagnostics" actions={<button className="adm-ghost" onClick={() => void diag.reload()}>Actualiser</button>}>
        <ErrorLine msg={diag.error} />
        {diag.data ? <pre className="adm-pre">{JSON.stringify(diag.data, null, 2)}</pre>
          : <p className="adm-muted">Chargement…</p>}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------- users */
export function Users({ me }: { me: Me | null }) {
  const { data, error, busy, reload } = useAsync<{ users: (Me['user'] & { is_active: number; created_at: string; last_login_at: string | null })[]; roles: string[] }>(
    () => api.get('/api/users'))
  const [form, setForm] = useState({ email: '', name: '', role: 'viewer', password: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const create = async () => {
    setErr(null); setMsg(null)
    try {
      await api.send('POST', '/api/users', form)
      setMsg(`Compte créé pour ${form.email}.`)
      setForm({ email: '', name: '', role: 'viewer', password: '' })
      await reload()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') }
  }

  const update = async (id: string, patch: Record<string, unknown>) => {
    setErr(null); setMsg(null)
    try {
      await api.send('PATCH', `/api/users/${id}`, patch)
      setMsg('Compte mis à jour.')
      await reload()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'échec') }
  }

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Comptes &amp; rôles</h1>
          <p className="adm-muted">
            Les permissions sont vérifiées côté serveur. Un rôle ne peut pas contourner une restriction éditoriale.
          </p>
        </div>
        <button className="adm-ghost" onClick={() => void reload()}>Actualiser</button>
      </header>
      <ErrorLine msg={error} />
      <ErrorLine msg={err} />
      {msg && <p className="adm-ok">{msg}</p>}

      <Card title="Comptes">
        {busy && !data ? <p className="adm-muted">Chargement…</p> : (
          <table className="adm-table">
            <thead><tr><th>Email</th><th>Nom</th><th>Rôle</th><th>Actif</th><th>Dernière connexion</th><th /></tr></thead>
            <tbody>
              {(data?.users ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.email}{u.id === me?.user.id && <Pill tone="ok">vous</Pill>}</td>
                  <td>{u.name}</td>
                  <td>
                    <select value={u.role} disabled={u.id === me?.user.id}
                      onChange={(e) => void update(u.id, { role: e.target.value })}>
                      {(data?.roles ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>{u.is_active ? <Pill tone="ok">actif</Pill> : <Pill tone="muted">désactivé</Pill>}</td>
                  <td className="adm-small">{fmtDate(u.last_login_at)}</td>
                  <td>
                    <button className="adm-link" disabled={u.id === me?.user.id}
                      onClick={() => void update(u.id, { is_active: !u.is_active })}>
                      {u.is_active ? 'désactiver' : 'réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Créer un compte">
        <div className="adm-row">
          <label className="adm-field">Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="adm-field">Nom
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="adm-field">Rôle
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {(data?.roles ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="adm-field">Mot de passe (≥ 16 caractères)
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
        </div>
        <button className="adm-primary" disabled={!form.email || form.password.length < 16} onClick={() => void create()}>
          Créer le compte
        </button>
        <p className="adm-muted adm-small">Le mot de passe n’est jamais renvoyé par l’API ni journalisé.</p>
      </Card>
    </>
  )
}

/* ---------------------------------------------------------------- settings */
export function Settings() {
  const diag = useAsync<Record<string, unknown>>(() => api.get('/api/system/diagnostics'))
  const pubs = useAsync<{ publications: { id: number; created_at: string; created_by: string | null; note: string | null }[] }>(
    () => api.get('/api/publications'))
  const audit = useAsync<{ entries: { at: string; actor_email: string | null; action: string; entity: string | null; entity_id: string | null }[] }>(
    () => api.get('/api/audit?limit=30'))

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Système</h1>
          <p className="adm-muted">Diagnostics, publications et journal d’audit.</p>
        </div>
        <button className="adm-ghost" onClick={() => { void diag.reload(); void pubs.reload(); void audit.reload() }}>
          Actualiser
        </button>
      </header>

      <Card title="Diagnostics">
        <ErrorLine msg={diag.error} />
        {diag.data ? <pre className="adm-pre">{JSON.stringify(diag.data, null, 2)}</pre>
          : <p className="adm-muted">Chargement…</p>}
      </Card>

      <Card title="Publications">
        <p className="adm-small">
          Une publication écrit un instantané dans <span className="adm-mono">data/admin/publications/</span>.
          Elle ne modifie pas le parcours visiteur : appliquer un instantané au bundle est une commande distincte
          (<span className="adm-mono">npm run admin:apply -- --yes</span>), volontairement manuelle.
        </p>
        {pubs.data?.publications.length
          ? (
            <table className="adm-table">
              <thead><tr><th>#</th><th>Date</th><th>Compte</th><th>Note</th></tr></thead>
              <tbody>
                {pubs.data.publications.map((p) => (
                  <tr key={p.id}><td>{p.id}</td><td>{fmtDate(p.created_at)}</td>
                    <td>{p.created_by ?? '—'}</td><td>{p.note ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          )
          : <p className="adm-muted">Aucune publication enregistrée.</p>}
      </Card>

      <Card title="Sauvegardes">
        <p className="adm-small">
          La sauvegarde est une commande explicite : <span className="adm-mono">npm run admin:backup</span>.
          Elle copie la base (VACUUM INTO), les fichiers audio versionnés et les publications dans
          <span className="adm-mono"> data/admin/backups/&lt;horodatage&gt;/</span>. La restauration est manuelle
          et documentée dans <span className="adm-mono">docs/admin/README.md</span> — une restauration automatique
          est la façon dont une sauvegarde détruit des données vivantes.
        </p>
      </Card>

      <Card title="Journal d’audit (30 dernières actions)">
        <ErrorLine msg={audit.error} />
        {audit.data ? (
          <table className="adm-table">
            <thead><tr><th>Date</th><th>Compte</th><th>Action</th><th>Objet</th></tr></thead>
            <tbody>
              {audit.data.entries.map((e, i) => (
                <tr key={i}><td className="adm-small">{fmtDate(e.at)}</td>
                  <td className="adm-small">{e.actor_email ?? 'cli'}</td>
                  <td className="adm-mono adm-small">{e.action}</td>
                  <td className="adm-small">{e.entity} {e.entity_id}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="adm-muted">Chargement…</p>}
      </Card>
    </>
  )
}
