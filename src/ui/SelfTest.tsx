import { useEffect, useRef, useState } from 'react'
import { audio, catalog, soundById } from '../audio/service'
import type { Sound } from '../audio/types'
import { isMusicallyUsable } from '../engine/policy'
import { UNIVERSES, getUniverse } from '../engine/universes'
import { buildScore } from '../engine/plan'
import { renderScore } from '../engine/render'

type Case = { name: string; universeId: string; ids: string[] }

const usable = () => catalog.sounds.filter((s) => isMusicallyUsable(s))

function buildCases(): Case[] {
  const all = usable()
  // `roles` peut être absent du catalogue publié : sans ce garde-fou, ce code
  // s'exécute à l'import du module et fait échouer le montage de toute l'application.
  const withRole = (r: string) => all.filter((s) => (s.roles ?? []).includes(r as never))
  const diverse: string[] = []
  for (const role of ['bass', 'melody', 'rhythm', 'earcandy', 'texture']) {
    const pick = withRole(role).find((s) => !diverse.includes(s.id))
    if (pick) diverse.push(pick.id)
  }
  const byStep = new Map<number, string>()
  for (const s of all) if (s.stepId && !byStep.has(s.stepId)) byStep.set(s.stepId, s.id)
  const spread = [...byStep.values()].slice(0, 6)
  const textures = withRole('texture').slice(0, 4).map((s) => s.id)
  return [
    { name: 'cinq-roles', universeId: 'electro-sega', ids: diverse.slice(0, 5) },
    { name: 'cinq-roles-sega', universeId: 'sega-trad', ids: diverse.slice(0, 5) },
    { name: 'reparti-7-etapes', universeId: 'electro-sega', ids: spread },
    { name: 'reparti-7-etapes-sega', universeId: 'sega-trad', ids: spread },
    { name: 'que-des-textures', universeId: 'electro-sega', ids: textures },
    { name: 'que-des-textures-sega', universeId: 'sega-trad', ids: textures },
    { name: 'deux-sons', universeId: 'electro-sega', ids: diverse.slice(0, 2) },
    { name: 'un-seul-son', universeId: 'sega-trad', ids: diverse.slice(0, 1) },
  ]
}

const ALL_CASES = buildCases()

/** Un lot = la moitié des cas : assez léger pour un onglet de navigateur. */
function casesForBatch(): Case[] {
  const b = new URLSearchParams(window.location.search).get('batch')
  if (b === '1') return ALL_CASES.slice(0, Math.ceil(ALL_CASES.length / 2))
  if (b === '2') return ALL_CASES.slice(Math.ceil(ALL_CASES.length / 2))
  return ALL_CASES
}
const CASES = casesForBatch()

function maxDiff(a: AudioBuffer, b: AudioBuffer): number {
  let m = 0
  const n = Math.min(a.length, b.length)
  for (let c = 0; c < Math.min(a.numberOfChannels, b.numberOfChannels); c++) {
    const x = a.getChannelData(c)
    const y = b.getChannelData(c)
    for (let i = 0; i < n; i++) { const d = Math.abs(x[i] - y[i]); if (d > m) m = d }
  }
  return m
}

/** Corrélation du passage brut avec l'enregistrement source (±60 ms). */
function correlate(rendered: AudioBuffer, source: AudioBuffer, atSec: number, offsetSec: number, win = 0.35) {
  const r = rendered.getChannelData(0)
  const s = source.getChannelData(0)
  const sr = source.sampleRate
  const n = Math.floor(win * sr)
  const off = Math.floor(offsetSec * sr)
  const centre = Math.floor(atSec * rendered.sampleRate)
  let best = 0
  for (let lagMs = -50; lagMs <= 50; lagMs += 4) {
    const base = centre + Math.round((lagMs / 1000) * rendered.sampleRate)
    if (base < 0 || base + n >= r.length) continue
    let num = 0, es = 0, er = 0
    for (let i = 0; i < n; i += 2) {
      const a = s[off + i] || 0
      const b = r[base + i] || 0
      num += a * b; es += a * a; er += b * b
    }
    const c = num / Math.sqrt((es || 1e-9) * (er || 1e-9))
    if (c > best) best = c
  }
  return best
}

/** Corrélation d'enveloppe : seule mesure valable pour les sources large bande. */
function envCorrelate(rendered: AudioBuffer, source: AudioBuffer, atSec: number, offsetSec: number, win = 0.6, frame = 0.02) {
  const r = rendered.getChannelData(0)
  const s = source.getChannelData(0)
  const sr = source.sampleRate
  const rsr = rendered.sampleRate
  const nF = Math.floor(win / frame)
  const fs = Math.floor(frame * sr)
  const fz = Math.floor(frame * rsr)
  let best = 0
  for (let lagMs = -50; lagMs <= 50; lagMs += 4) {
    const bR = Math.floor(atSec * rsr) + Math.round((lagMs / 1000) * rsr)
    const bS = Math.floor(offsetSec * sr)
    if (bR < 0 || bS + nF * fs >= s.length) continue
    const A: number[] = [], B: number[] = []
    for (let f = 0; f < nF; f++) {
      let a = 0, b = 0
      for (let i = 0; i < fs; i++) { const v = s[bS + f * fs + i] || 0; a += v * v }
      for (let i = 0; i < fz; i++) { const v = r[bR + f * fz + i] || 0; b += v * v }
      A.push(Math.sqrt(a / fs)); B.push(Math.sqrt(b / fz))
    }
    const mean = (x: number[]) => x.reduce((p, c) => p + c, 0) / x.length
    const ma = mean(A), mb = mean(B)
    let num = 0, da = 0, db = 0
    for (let i = 0; i < A.length; i++) { const a = A[i] - ma, b = B[i] - mb; num += a * b; da += a * a; db += b * b }
    const c = num / Math.sqrt((da || 1e-9) * (db || 1e-9))
    if (c > best) best = c
  }
  return best
}

export default function SelfTest() {
  const [out, setOut] = useState('préparation…')
  const [done, setDone] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    // StrictMode monte l'effet deux fois : sans ce verrou, deux passes de rendu
    // tournent en parallèle et se disputent le cache audio.
    if (started.current) return
    started.current = true
    void (async () => {
      try {
      const cases: unknown[] = []
      const sums: string[] = []
      for (let n = 0; n < CASES.length; n++) {
        const c = CASES[n]
        setOut(`rendu ${n + 1}/${CASES.length} — ${c.name}…`)
        const universe = getUniverse(c.universeId) ?? UNIVERSES[0]
        const selection = c.ids.map(soundById).filter((s): s is Sound => Boolean(s))
        await audio.ensure(selection.map((s) => s.id))
        const missing = selection.filter((s) => !audio.get(s.id))
        if (missing.length) {
          cases.push({ name: c.name, universe: c.universeId, ok: false, error: `audio non décodé : ${missing.map((m) => m.code).join(', ')} (${audio.loadError})` })
          continue
        }
        const buffers = new Map(selection.map((s) => [s.id, audio.get(s.id)!]))
        const score = buildScore({ universe, selection })
        const { buffer, report } = await renderScore(score, buffers, { sampleRate: 32000 })

        const corrs = score.signatures.map((sig) => {
          const note = score.notes.find((x) => x.kind === 'signature' && x.sourceId === sig.sourceId)!
          const src = buffers.get(sig.sourceId)
          if (!src) return { id: sig.sourceId, at: 0, raw: 0, env: 0, corr: 0 }
          const raw = correlate(buffer, src, sig.start, note.offset)
          const env = envCorrelate(buffer, src, sig.start, note.offset)
          return { id: sig.sourceId, at: Math.round(sig.start * 10) / 10, raw: +raw.toFixed(2), env: +env.toFixed(2), corr: +Math.max(raw, env).toFixed(2) }
        })
        const minCorr = Math.min(...corrs.map((x) => x.corr))
        const sum = (() => { let h = 0; const d = buffer.getChannelData(0); for (let i = 0; i < d.length; i += 97) h = (h * 31 + Math.round(d[i] * 1e6)) | 0; return (h >>> 0).toString(16) })()
        sums.push(sum)

        let determinism: Record<string, unknown> = {}
        if (c.name === 'cinq-roles') {
          const s2 = buildScore({ universe, selection: [...selection].reverse() })
          const r2 = await renderScore(s2, buffers, { sampleRate: 32000 })
          determinism = { sameSeed: s2.seed === score.seed, maxDiff: Number(maxDiff(buffer, r2.buffer).toExponential(2)), reproducible: maxDiff(buffer, r2.buffer) < 1e-5 }
        }

        const expected = selection.map((x) => x.id).sort()
        const reported = [...report.signatureSourceIds].sort()
        const everySelectedHasSignature = JSON.stringify(reported) === JSON.stringify(expected)
        const durationInRange = buffer.duration >= 28 && buffer.duration <= 46
        cases.push({
          name: c.name,
          universe: c.universeId,
          selected: expected,
          durationS: Math.round(buffer.duration * 10) / 10,
          bpm: score.bpm,
          notes: report.noteCount,
          grains: report.grainCount,
          peakDb: report.peakDb,
          rmsDb: report.rmsDb,
          signatures: score.signatures.length,
          adaptations: score.adaptations.length,
          limits: score.limits,
          recognizability: corrs,
          minCorrelation: minCorr,
          checks: {
            onlySelectedSources: report.checks.onlySelectedSources,
            everySourceRecognizable: report.checks.everySourceRecognizable,
            noExternalSamples: report.checks.noExternalSamples,
            everySelectedHasSignature,
            durationInRange,
            noClipping: report.peakDb <= -0.5,
            statementAudible: minCorr >= 0.45,
          },
          ok: report.ok && everySelectedHasSignature && durationInRange && minCorr >= 0.45,
          checksum: sum,
          determinism,
        })
        buffers.clear()
      }
      const payload = {
        sounds: catalog.sounds.length,
        steps: catalog.steps?.length,
        cases,
        distinctSelections: sums.length > 1 && new Set(sums).size > 1,
        allOk: cases.every((x) => (x as { ok: boolean }).ok),
      }
      ;(window as unknown as { __SUGAR_SELFTEST__: unknown }).__SUGAR_SELFTEST__ = payload
      console.log('SUGAR_SELFTEST ' + JSON.stringify(payload))
      setOut(JSON.stringify(payload, null, 2))
      setDone(true)
      } catch (e) {
        setOut(`ERREUR: ${String((e as Error).stack || e)}`)
      }
    })()
    // pas de nettoyage : cette page de diagnostic publie son résultat même si
    // React remonte l'effet (StrictMode)
  }, [done])

  return (
    <div className="shell selftest">
      <h1 style={{ fontSize: '1.4rem', margin: '24px 0 12px' }}>Sugar Orchestra — vérification des invariants</h1>
      <p style={{ fontSize: '.84rem', marginBottom: 12 }}>
        Rend {CASES.length} pièces hors ligne (deux univers, sélections riches et pauvres, 1 et 2 sons) et vérifie : sources
        étrangères, signature de chaque son, durée, saturation, déterminisme, reconnaissabilité mesurée.
      </p>
      <pre>{out}</pre>
    </div>
  )
}
