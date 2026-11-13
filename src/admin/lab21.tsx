import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, fmtBytes } from './api'
import { Card, ErrorLine, Pill } from './panels'
import { audio, catalog } from '../audio/service'
import { PROFILES } from '../engine-v2/profiles'
import {
  buildPlan21, summarise21, styleFor, BASS_TIMBRES, ENGINE_VERSION_21,
  type EngineMode, type BassTimbre, type V21Plan,
} from '../engine-v2/v21/browser'

/**
 * Laboratoire V2.1 — génération, écoute, comparaison A/B.
 *
 * La compensation de loudness agit à la LECTURE (GainNode), jamais sur le WAV :
 * les fichiers restent intacts et téléchargeables tels que rendus.
 */

interface Slot {
  id: string
  label: string
  buffer: AudioBuffer
  wav: Blob
  bytes: number
  durationS: number
  lufs: number | null
  truePeak: number | null
  meta: Record<string, unknown>
  plan: V21Plan
  summary: ReturnType<typeof summarise21>
  params: { profileId: string; mode: EngineMode; bass: boolean; timbre: BassTimbre; seed: number; target: number }
}

const MODE_LABEL: Record<EngineMode, string> = {
  museum_only: 'Museum Only — samples seuls',
  museum_derived: 'Museum Derived — transformations, sans oscillateur',
  hybrid_synth: 'Hybrid Synth — samples + basse synthétique',
}

const MODE_NOTE: Record<EngineMode, string> = {
  museum_only: 'aucune note synthétique : la basse est désactivée par le mode',
  museum_derived: 'pas encore de resynthèse dédiée : équivaut à Museum Only pour la basse',
  hybrid_synth: 'basse synthétisée par le module C, décidée par le moteur',
}

const TIMBRES: BassTimbre[] = ['percussive', 'warm', 'sub']

/** Gain de compensation pour viser la même loudness perçue, borné à ±12 dB. */
function matchGain(lufsA: number | null, lufsB: number | null, enabled: boolean) {
  if (!enabled || lufsA == null || lufsB == null) return { a: 1, b: 1, note: enabled ? 'LUFS indisponible' : 'compensation désactivée' }
  const target = Math.max(lufsA, lufsB) // on baisse vers le plus fort plutôt que d'amplifier
  const gA = Math.pow(10, Math.min(12, Math.max(-12, target - lufsA)) / 20)
  const gB = Math.pow(10, Math.min(12, Math.max(-12, target - lufsB)) / 20)
  const clamped = Math.abs(target - lufsA) > 12 || Math.abs(target - lufsB) > 12
  return { a: gA, b: gB, note: clamped ? 'écart > 12 dB : compensation partielle' : `compensation ${(20 * Math.log10(gB / gA)).toFixed(1)} dB` }
}

export default function Lab21() {
  const sounds = useMemo(() => catalog.sounds, [])
  const [selected, setSelected] = useState<string[]>(['01_01', '01_03', '04_02', '04_09', '06_04'])
  const [profileId, setProfileId] = useState('electro-sega')
  const [mode, setMode] = useState<EngineMode>('hybrid_synth')
  const [bass, setBass] = useState(true)
  const [timbre, setTimbre] = useState<BassTimbre>('percussive')
  const [seed, setSeed] = useState(20261121)
  const [target, setTarget] = useState(36)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [slotA, setSlotA] = useState<Slot | null>(null)
  const [slotB, setSlotB] = useState<Slot | null>(null)
  const [match, setMatch] = useState(true)
  const [playing, setPlaying] = useState<'A' | 'B' | null>(null)
  const [log, setLog] = useState<string[]>([])
  const ctxRef = useRef<AudioContext | null>(null)
  const srcRef = useRef<AudioBufferSourceNode | null>(null)

  const note = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString('fr-FR')}  ${m}`, ...l].slice(0, 30))

  useEffect(() => () => { srcRef.current?.stop(); ctxRef.current?.close() }, [])

  const effectiveBass = mode === 'hybrid_synth' && bass

  const generate = async (slot: 'A' | 'B') => {
    setBusy(true); setErr(null)
    try {
      const profile = PROFILES.find((p) => p.id === profileId)
      if (!profile) throw new Error('profil inconnu')
      const selection = selected.map((id) => sounds.find((s) => s.id === id)).filter(Boolean) as typeof sounds
      const plan = buildPlan21({
        profile, seed, selection,
        mode: effectiveBass ? 'hybrid_synth' : mode === 'museum_derived' ? 'museum_derived' : 'museum_only',
        styleModel: styleFor(profileId),
        targetSeconds: target,
        capabilityMatrixSource: 'capability-matrix.json (17 sons)',
      })
      // timbre choisi dans l'interface : on remplace celui de la politique
      if (plan.bassSynth && effectiveBass) plan.bassSynth = { ...BASS_TIMBRES[timbre] }
      const summary = summarise21(plan)
      note(`${slot} · plan ${summary.bars} mesures · ${summary.notes} événements · basse ${summary.bassNotes}`)

      const res = await fetch('/api/v2/render', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-so-admin': '1' },
        body: JSON.stringify({ plan }),
      })
      const body = await res.json()
      if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`, body.detail)
      const wav = await (await fetch(body.url)).blob()
      const buffer = await audio.decodeWav(await wav.arrayBuffer())
      const slotData: Slot = {
        id: body.id, label: `${profile.publicName.fr} · ${mode}${effectiveBass ? ` · ${timbre}` : ' · sans basse'} · seed ${seed}`,
        buffer, wav, bytes: wav.size, durationS: body.verification?.durationS ?? buffer.duration,
        lufs: body.verification?.lufs ?? null, truePeak: body.verification?.truePeakDb ?? null,
        meta: body, plan, summary,
        params: { profileId, mode, bass: effectiveBass, timbre, seed, target },
      }
      if (slot === 'A') setSlotA(slotData); else setSlotB(slotData)
      note(`${slot} rendu · ${slotData.durationS.toFixed(2)} s · LUFS ${slotData.lufs} · ${body.timing?.totalMs} ms`)
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.message}${e.detail ? ' — ' + JSON.stringify(e.detail) : ''}` : (e as Error).message)
    } finally { setBusy(false) }
  }

  const play = async (slot: 'A' | 'B', s: Slot | null) => {
    if (!s) return
    srcRef.current?.stop()
    ctxRef.current ??= new AudioContext()
    const ctx = ctxRef.current
    await ctx.resume()
    const gain = matchGain(slotA?.lufs ?? null, slotB?.lufs ?? null, match)
    const g = ctx.createGain()
    g.gain.value = slot === 'A' ? gain.a : gain.b
    const src = ctx.createBufferSource()
    src.buffer = s.buffer
    src.connect(g).connect(ctx.destination)
    src.onended = () => setPlaying((p) => (p === slot ? null : p))
    src.start()
    srcRef.current = src
    setPlaying(slot)
  }

  const download = (s: Slot) => {
    const url = URL.createObjectURL(s.wav)
    const a = document.createElement('a')
    a.href = url; a.download = `v21-${s.params.profileId}-${s.params.mode}-seed${s.params.seed}.wav`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const gain = matchGain(slotA?.lufs ?? null, slotB?.lufs ?? null, match)

  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Laboratoire V2.1</h1>
          <p className="adm-muted">
            Moteur {ENGINE_VERSION_21} — motifs issus des références, variations mesurées, basse hybrid.
            La compensation de loudness agit à l’écoute, jamais sur les fichiers.
          </p>
        </div>
      </header>
      <ErrorLine msg={err} />

      <div className="adm-cols">
        <Card title="Paramètres">
          <label className="adm-field">Univers
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.publicName.fr}{p.artisticStatus === 'hypothesis' ? ' (hypothèse)' : ''}
                  {styleFor(p.id) ? '' : ' — sans modèle de style'}
                </option>
              ))}
            </select>
          </label>
          <label className="adm-field">Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as EngineMode)}>
              {(Object.keys(MODE_LABEL) as EngineMode[]).map((m) => (
                <option key={m} value={m}>{MODE_LABEL[m]}</option>
              ))}
            </select>
          </label>
          <p className="adm-muted adm-small">{MODE_NOTE[mode]}</p>

          <label className="adm-field">Basse synthétique
            <input type="checkbox" checked={bass} disabled={mode !== 'hybrid_synth'}
              onChange={(e) => setBass(e.target.checked)} />
          </label>
          <label className="adm-field">Timbre
            <select value={timbre} disabled={!effectiveBass} onChange={(e) => setTimbre(e.target.value as BassTimbre)}>
              {TIMBRES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="adm-field">Seed
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
          </label>
          <label className="adm-field">Durée cible (s)
            <input type="number" min={20} max={60} value={target} onChange={(e) => setTarget(Number(e.target.value) || 36)} />
          </label>
          <div className="adm-row">
            <button className="adm-ghost" disabled={busy || !selected.length} onClick={() => void generate('A')}>
              {busy ? 'Rendu…' : 'Générer A'}
            </button>
            <button className="adm-primary" disabled={busy || !selected.length} onClick={() => void generate('B')}>
              Générer B
            </button>
          </div>
          <p className="adm-muted adm-small">
            Astuce A/B : générez A, changez un seul paramètre (mode, timbre, seed), puis B.
          </p>
        </Card>

        <Card title={`Sons (${selected.length})`}>
          <div className="adm-lab-sounds">
            {sounds.map((s) => (
              <button key={s.id} className={`adm-lab-sound ${selected.includes(s.id) ? 'is-on' : ''}`}
                onClick={() => setSelected((c) => (c.includes(s.id) ? c.filter((x) => x !== s.id) : [...c, s.id]))}
                title={s.name}>
                <span className="adm-mono">{s.id}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Comparaison A / B">
        <label className="adm-field adm-inline">
          <input type="checkbox" checked={match} onChange={(e) => setMatch(e.target.checked)} />
          Compensation de loudness à l’écoute ({gain.note})
        </label>
        <table className="adm-table">
          <thead>
            <tr><th /><th>A</th><th>B</th></tr>
          </thead>
          <tbody>
            <tr><td>Paramètres</td>
              <td>{slotA ? `${slotA.params.mode}${slotA.params.bass ? ` · ${slotA.params.timbre}` : ''} · seed ${slotA.params.seed}` : '—'}</td>
              <td>{slotB ? `${slotB.params.mode}${slotB.params.bass ? ` · ${slotB.params.timbre}` : ''} · seed ${slotB.params.seed}` : '—'}</td></tr>
            <tr><td>Durée</td><td>{slotA?.durationS.toFixed(2) ?? '—'} s</td><td>{slotB?.durationS.toFixed(2) ?? '—'} s</td></tr>
            <tr><td>LUFS</td><td>{slotA?.lufs ?? '—'}</td><td>{slotB?.lufs ?? '—'}</td></tr>
            <tr><td>True peak</td><td>{slotA?.truePeak ?? '—'} dBTP</td><td>{slotB?.truePeak ?? '—'} dBTP</td></tr>
            <tr><td>Événements</td><td>{slotA?.summary.notes ?? '—'}</td><td>{slotB?.summary.notes ?? '—'}</td></tr>
            <tr><td>Notes de basse</td><td>{slotA?.summary.bassNotes ?? '—'}</td><td>{slotB?.summary.bassNotes ?? '—'}</td></tr>
            <tr><td>Motifs utilisés</td><td>{slotA?.summary.patternsUsed ?? '—'}</td><td>{slotB?.summary.patternsUsed ?? '—'}</td></tr>
            <tr><td>Variations</td><td>{slotA?.summary.variations ?? '—'} (sim. {slotA?.summary.meanSimilarity ?? '—'})</td><td>{slotB?.summary.variations ?? '—'} (sim. {slotB?.summary.meanSimilarity ?? '—'})</td></tr>
            <tr><td>Taille</td><td>{slotA ? fmtBytes(slotA.bytes) : '—'}</td><td>{slotB ? fmtBytes(slotB.bytes) : '—'}</td></tr>
            <tr><td>Écoute</td>
              <td><button className="adm-ghost" disabled={!slotA} onClick={() => void play('A', slotA)}>{playing === 'A' ? '■ stop' : '▶ A'}</button></td>
              <td><button className="adm-ghost" disabled={!slotB} onClick={() => void play('B', slotB)}>{playing === 'B' ? '■ stop' : '▶ B'}</button></td></tr>
            <tr><td>Télécharger</td>
              <td><button className="adm-ghost" disabled={!slotA} onClick={() => slotA && download(slotA)}>WAV A</button></td>
              <td><button className="adm-ghost" disabled={!slotB} onClick={() => slotB && download(slotB)}>WAV B</button></td></tr>
          </tbody>
        </table>
        <p className="adm-muted adm-small">
          A et B ne sont pas le même arrangement lorsque la seed, le mode ou le timbre diffèrent :
          le tableau montre les paramètres réels de chaque rendu.
        </p>
      </Card>

      {[['A', slotA], ['B', slotB]].map(([k, s]) => s && (
        <Card key={k as string} title={`Plan ${k as string} — ${(s as Slot).label}`}>
          <dl className="adm-kv">
            <dt>Rôles</dt><dd>{Object.entries((s as Slot).plan.roles).filter(([, v]) => v.length).map(([r, v]) => `${r}: ${v.join(', ')}`).join(' · ') || '—'}</dd>
            <dt>Sections</dt><dd>{(s as Slot).summary.sections}</dd>
            <dt>Harmonie</dt><dd>{(s as Slot).plan.harmony.source} — {(s as Slot).plan.harmony.note}</dd>
            <dt>Basse</dt><dd>{(s as Slot).plan.bassSynth ? `${(s as Slot).plan.bassSynth!.timbre} · ${(s as Slot).summary.bassHz.join(' / ')} Hz` : 'aucune'}</dd>
            <dt>Limites</dt><dd>{(s as Slot).summary.limits.join(', ') || 'aucune'}</dd>
            <dt>Adaptations</dt><dd>{(s as Slot).summary.adaptations.join(' · ') || '—'}</dd>
          </dl>
          <details className="adm-details">
            <summary>Plan JSON et métadonnées</summary>
            <pre className="adm-pre">{JSON.stringify({ plan: (s as Slot).plan, render: (s as Slot).meta }, null, 2).slice(0, 6000)}</pre>
          </details>
        </Card>
      ))}

      <Card title="Journal">
        {log.length ? <pre className="adm-pre">{log.join('\n')}</pre> : <p className="adm-muted">Aucune génération.</p>}
        {slotA && slotB && (
          <p className="adm-small">
            <Pill tone={slotA.params.mode === slotB.params.mode && slotA.params.seed === slotB.params.seed ? 'warn' : 'ok'}>
              {slotA.params.mode === slotB.params.mode && slotA.params.seed === slotB.params.seed ? 'A et B partagent mode et seed' : 'A et B diffèrent'}
            </Pill>
          </p>
        )}
      </Card>
    </>
  )
}
