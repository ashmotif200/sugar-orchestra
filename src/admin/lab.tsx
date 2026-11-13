import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, fmtBytes } from './api'
import { Card, ErrorLine, Pill } from './panels'
import { audio, catalog, soundById } from '../audio/service'
import { buildScore, type Score } from '../engine/plan'
import { getUniverse } from '../engine/universes'
import { encodeWav } from '../engine/render'
import { buildPlan, summarisePlan, PROFILES, type ScorePlan } from '../engine-v2/browser'

/**
 * Laboratoire de comparaison V1 / V2.
 *
 * Les deux moteurs reçoivent la MÊME sélection et la MÊME seed. Cela ne rend pas
 * leurs arrangements équivalents : V1 n'a pas de seed comparable et travaille en
 * BPM entier. Le laboratoire sert à écouter, pas à prétendre à une parité.
 */

const CRITERIA = [
  ['groove', 'Groove'],
  ['coherence', 'Cohérence musicale'],
  ['structure', 'Structure'],
  ['variation', 'Variations'],
  ['sound', 'Qualité sonore'],
  ['recognition', 'Reconnaissabilité des samples'],
  ['identity', 'Identité de l’univers'],
  ['pleasure', 'Agrément d’écoute'],
] as const

type Ratings = Record<string, number>

interface Rendered {
  kind: 'v1' | 'v2'
  buffer: AudioBuffer
  bytes: number
  durationS: number
  meta: Record<string, unknown>
  wav?: Blob
}

const RATING_KEY = 'sugar-orchestra.lab.ratings.v1'

export default function Lab() {
  const sounds = useMemo(() => catalog.sounds, [])
  const [selected, setSelected] = useState<string[]>(['01_01', '01_03', '04_09', '06_04', '05_01'])
  const [profileId, setProfileId] = useState('electro-sega')
  const [seed, setSeed] = useState(20261113)
  const [v1, setV1] = useState<Rendered | null>(null)
  const [v2, setV2] = useState<Rendered | null>(null)
  const [plan, setPlan] = useState<ScorePlan | null>(null)
  const [busy, setBusy] = useState<'v1' | 'v2' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const [ratings, setRatings] = useState<Record<string, Ratings>>(() => {
    try { return JSON.parse(localStorage.getItem(RATING_KEY) ?? '{}') } catch { return {} }
  })

  const note = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString('fr-FR')}  ${m}`, ...l].slice(0, 30))

  useEffect(() => {
    fetch('/api/v2/health').then((r) => r.json()).then((j) => setServerOk(!!j.ok)).catch(() => setServerOk(false))
  }, [])

  const toggle = (id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  const generateV1 = async () => {
    setBusy('v1'); setErr(null)
    try {
      const selection = selected.map((id) => soundById(id)).filter(Boolean) as NonNullable<ReturnType<typeof soundById>>[]
      const universe = getUniverse(profileId) ?? getUniverse('electro-sega')!
      const score: Score = buildScore({ universe, selection })
      const { buffer, report } = await audio.render(score)
      const blob = encodeWav(buffer)
      setV1({
        kind: 'v1', buffer, bytes: blob.size, durationS: buffer.duration,
        meta: { notes: score.notes.length, seed: score.seed, adaptations: score.adaptations.length, limits: score.limits, report }, wav: blob,
      })
      note(`V1 rendu : ${score.notes.length} événements, ${buffer.duration.toFixed(1)} s`)
    } catch (e) {
      setErr(`V1 : ${e instanceof Error ? e.message : 'échec'}`)
    } finally { setBusy(null) }
  }

  const generateV2 = async () => {
    setBusy('v2'); setErr(null)
    try {
      const profile = PROFILES.find((p) => p.id === profileId)
      if (!profile) throw new Error('profil inconnu')
      const selection = selected.map((id) => soundById(id)).filter(Boolean) as NonNullable<ReturnType<typeof soundById>>[]
      const p = buildPlan({ profile, seed, selection })
      setPlan(p)
      const summary = summarisePlan(p)
      note(`plan V2 : ${summary.bars} mesures, ${summary.notes} événements, ${summary.durationS} s`)

      const res = await fetch('/api/v2/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-so-admin': '1' },
        body: JSON.stringify({ plan: p }),
      })
      const body = await res.json()
      if (!res.ok) {
        throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body.detail)
      }
      const wavRes = await fetch(body.url)
      const wav = await wavRes.blob()
      const buffer = await audio.decodeWav(await wav.arrayBuffer())
      setV2({
        kind: 'v2', buffer, bytes: wav.size, durationS: buffer.duration,
        meta: { ...body, plan: summary }, wav,
      })
      note(`V2 rendu par le serveur : ${body.verification?.durationS?.toFixed(1)} s, true peak ${body.verification?.truePeakDb} dBTP, ${body.timing?.totalMs} ms`)
    } catch (e) {
      setErr(e instanceof ApiError ? `V2 : ${e.message}${e.detail ? ' — ' + JSON.stringify(e.detail) : ''}` : `V2 : ${(e as Error).message}`)
    } finally { setBusy(null) }
  }

  const play = async (r: Rendered) => { await audio.playPiece(r.buffer) }
  const download = (r: Rendered) => {
    if (!r.wav) return
    const url = URL.createObjectURL(r.wav)
    const a = document.createElement('a')
    a.href = url
    a.download = `sugar-${r.kind}-${profileId}-seed${r.kind === 'v1' ? (r.meta.seed ?? 'na') : seed}.wav`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const key = `${profileId}:${seed}:${[...selected].sort().join(',')}`
  const setRating = (criterion: string, value: number, which: 'v1' | 'v2') => {
    setRatings((cur) => {
      const entry = { ...(cur[key] ?? {}) }
      entry[`${which}.${criterion}`] = value
      const next = { ...cur, [key]: entry }
      try { localStorage.setItem(RATING_KEY, JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }

  const saving = useCallback((id: string, kind: 'v1' | 'v2') => {
    note(`${kind.toUpperCase()} conservé en local (${id.slice(0, 8)}…)`)
  }, [])

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Laboratoire V1 / V2</h1>
          <p className="adm-muted">
            Même sélection, même seed, deux moteurs. V1 décide en BPM entier, V2 en
            (durée de mesure, temps, subdivision) : leurs arrangements ne sont pas
            comparables note pour note, seulement à l’écoute.
          </p>
        </div>
        <span className={`adm-pill ${serverOk ? 'adm-pill-ok' : 'adm-pill-warn'}`}>
          {serverOk === null ? 'serveur audio…' : serverOk ? 'serveur audio prêt' : 'serveur audio absent — V2 indisponible, V1 reste utilisable'}
        </span>
      </header>
      <ErrorLine msg={err} />

      <div className="adm-cols">
        <Card title="Sélection et paramètres">
          <label className="adm-field">Profil / univers
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.publicName.fr} — v{p.version}{p.artisticStatus === 'hypothesis' ? ' (hypothèse)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="adm-field">Seed
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
          </label>
          <p className="adm-muted adm-small">
            Le seed pilote le plan V2 de façon déterministe. V1 n’expose pas de seed
            comparable : ses rendus ne sont pas reproductibles à l’identique.
          </p>
          <div className="adm-row">
            <button className="adm-ghost" disabled={busy !== null || !selected.length} onClick={() => void generateV1()}>
              {busy === 'v1' ? 'Rendu V1…' : 'Générer V1'}
            </button>
            <button className="adm-primary" disabled={busy !== null || !selected.length || serverOk === false} onClick={() => void generateV2()}>
              {busy === 'v2' ? 'Rendu V2…' : 'Générer V2'}
            </button>
          </div>
        </Card>

        <Card title={`Sons (${selected.length} sélectionnés)`}>
          <div className="adm-lab-sounds">
            {sounds.map((s) => (
              <button
                key={s.id}
                className={`adm-lab-sound ${selected.includes(s.id) ? 'is-on' : ''}`}
                onClick={() => toggle(s.id)}
                title={s.name}
              >
                <span className="adm-mono">{s.id}</span>
                {s.sensitive ? <Pill tone="warn">hist.</Pill> : null}
              </button>
            ))}
          </div>
          <p className="adm-muted adm-small">
            « hist. » = son historiquement sensible. Depuis la politique v2 il est utilisable
            en musique ; l’information reste affichée.
          </p>
        </Card>
      </div>

      {(v1 || v2) && (
        <div className="adm-cols">
          {[v1, v2].map((r) => r && (
            <Card key={r.kind} title={r.kind === 'v1' ? 'V1 — moteur actuel' : 'V2 — moteur hybride'}>
              <dl className="adm-kv">
                <dt>Durée</dt><dd>{r.durationS.toFixed(2)} s</dd>
                <dt>Taille</dt><dd>{fmtBytes(r.bytes)}</dd>
                <dt>True peak</dt><dd>{(r.meta as any)?.verification?.truePeakDb ?? '—'} dBTP</dd>
                <dt>LUFS</dt><dd>{(r.meta as any)?.verification?.lufs ?? '—'}</dd>
                <dt>Événements</dt><dd>{(r.meta as any)?.plan?.notes ?? (r.meta as any)?.notes ?? '—'}</dd>
              </dl>
              <div className="adm-row">
                <button className="adm-ghost" onClick={() => void play(r)}>Écouter</button>
                <button className="adm-ghost" onClick={() => audio.stopPiece()}>Arrêter</button>
                <button className="adm-ghost" onClick={() => download(r)}>Télécharger</button>
                <button className="adm-link" onClick={() => saving(String((r.meta as any)?.id ?? r.kind), r.kind)}>garder</button>
              </div>
              <details className="adm-details">
                <summary>Paramètres et limites</summary>
                <pre className="adm-pre">{JSON.stringify(r.meta, null, 2).slice(0, 4000)}</pre>
              </details>
            </Card>
          ))}
        </div>
      )}

      {plan && (
        <Card title="Plan V2 (inspectable sans audio)">
          <dl className="adm-kv">
            <dt>Profil</dt><dd>{plan.profileId} v{plan.profileVersion}</dd>
            <dt>Mesure</dt><dd>{plan.time.barSeconds} s · {plan.time.beatsPerBar} temps · subdivision {plan.time.subdivision} · swing {plan.time.swing}</dd>
            <dt>Mesures</dt><dd>{plan.bars}</dd>
            <dt>Rôles</dt><dd>{Object.entries(plan.roles).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ') || '—'}</dd>
            <dt>Adaptations</dt><dd>{plan.adaptations.map((a) => a.reason).join(' · ') || '—'}</dd>
            <dt>Limites</dt><dd>{plan.limits.map((l) => l.code).join(', ') || 'aucune'}</dd>
            <dt>Reproductibilité</dt><dd className="adm-mono">{plan.reproducibility.engineVersion} · politique v{plan.reproducibility.policyVersion} · seed {plan.seed}</dd>
          </dl>
        </Card>
      )}

      <Card title="Évaluation à l’écoute (par critère, jamais un score unique)">
        <p className="adm-muted adm-small">
          Notation 1–5 par critère et par moteur, conservée sur cet appareil pour la
          sélection courante ({key.split(':')[0]} · seed {seed}).
        </p>
        <table className="adm-table">
          <thead><tr><th>Critère</th><th>V1</th><th>V2</th></tr></thead>
          <tbody>
            {CRITERIA.map(([id, label]) => (
              <tr key={id}>
                <td>{label}</td>
                {(['v1', 'v2'] as const).map((which) => (
                  <td key={which}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        className={`adm-rate ${ratings[key]?.[`${which}.${id}`] === n ? 'is-on' : ''}`}
                        onClick={() => setRating(id, n, which)}
                      >{n}</button>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Journal du laboratoire">
        {log.length ? <pre className="adm-pre">{log.join('\n')}</pre> : <p className="adm-muted">Aucune action.</p>}
      </Card>
    </>
  )
}
