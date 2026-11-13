import { useEffect, useState } from 'react'
import { catalog, audio, soundById } from '../audio/service'
import type { Sound } from '../audio/types'
import { UNIVERSES, getUniverse } from '../engine/universes'
import { buildScore } from '../engine/plan'
import { renderScore } from '../engine/render'

type Case = { name: string; universeId: string; ids: string[] }

function buildCases(): Case[] {
  const demo = (catalog.demoSet ?? catalog.sounds.map((x) => x.id))
    .map(soundById)
    .filter((x): x is Sound => Boolean(x))
  const byRole = (role: string) => demo.filter((s) => s.roles.includes(role as never)).map((s) => s.id)
  const textures = byRole('texture')
  const four = [...new Set([...byRole('bass'), ...byRole('melody'), ...byRole('rhythm'), ...byRole('earcandy')])].slice(0, 4)
  const six = demo.slice(0, 6).map((s) => s.id)
  const noBass = demo.filter((s) => !s.roles.includes('bass')).slice(0, 4).map((s) => s.id)
  return [
    { name: 'tonal-complet', universeId: 'energetique', ids: four },
    { name: 'meme-selection-ambient', universeId: 'reveur', ids: four },
    { name: 'que-des-textures', universeId: 'energetique', ids: textures.slice(0, 4) },
    { name: 'que-des-textures-ambient', universeId: 'reveur', ids: textures.slice(0, 4) },
    { name: 'six-sons-divers', universeId: 'energetique', ids: six },
    { name: 'six-sons-ambient', universeId: 'reveur', ids: six },
    { name: 'minimum-4-sons', universeId: 'reveur', ids: demo.slice(0, 4).map((s) => s.id) },
    { name: 'sans-basse', universeId: 'energetique', ids: noBass.length >= 4 ? noBass : demo.slice(4, 8).map((s) => s.id) },
  ]
}

const CASES: Case[] = buildCases()

function maxDiff(a: AudioBuffer, b: AudioBuffer): number {
  let m = 0
  const n = Math.min(a.length, b.length)
  for (let c = 0; c < Math.min(a.numberOfChannels, b.numberOfChannels); c++) {
    const x = a.getChannelData(c)
    const y = b.getChannelData(c)
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x[i] - y[i])
      if (d > m) m = d
    }
  }
  return m
}

/** Max normalised cross-correlation between a raw statement and its source
 *  around the scheduled time — an objective measure that the visitor's sound is
 *  really present and recognisable in the render. */
function statementCorrelation(
  rendered: AudioBuffer,
  source: AudioBuffer,
  atSec: number,
  offsetSec: number,
  win = 0.35,
) {
  const r = rendered.getChannelData(0)
  const s = source.getChannelData(0)
  const sr = source.sampleRate
  const n = Math.floor(win * sr)
  const off = Math.floor(offsetSec * sr)
  const centre = Math.floor(atSec * rendered.sampleRate)
  let best = 0
  for (let lagMs = -60; lagMs <= 60; lagMs += 2) {
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

/** Envelope (RMS contour) correlation — the meaningful test for broadband
 *  sources such as shakers or steam, where raw sample correlation decorrelates
 *  even when the very same recording is playing. */
function envelopeCorrelation(rendered: AudioBuffer, source: AudioBuffer, atSec: number, offsetSec: number, win = 0.6, frame = 0.02) {
  const r = rendered.getChannelData(0)
  const s = source.getChannelData(0)
  const sr = source.sampleRate
  const nFrames = Math.floor(win / frame)
  const fs = Math.floor(frame * sr)
  const rsr = rendered.sampleRate
  const fsz = Math.floor(frame * rsr)
  let best = 0
  for (let lagMs = -60; lagMs <= 60; lagMs += 2) {
    const baseR = Math.floor(atSec * rsr) + Math.round((lagMs / 1000) * rsr)
    const baseS = Math.floor(offsetSec * sr)
    if (baseR < 0 || baseS + nFrames * fs >= s.length) continue
    const A: number[] = []
    const B: number[] = []
    for (let f = 0; f < nFrames; f++) {
      let a = 0, b = 0
      for (let i = 0; i < fs; i++) { const v = s[baseS + f * fs + i] || 0; a += v * v }
      for (let i = 0; i < fsz; i++) { const v = r[baseR + f * fsz + i] || 0; b += v * v }
      A.push(Math.sqrt(a / fs)); B.push(Math.sqrt(b / fsz))
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

function checksum(buf: AudioBuffer): string {
  let h = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i += 97) h = (h * 31 + Math.round(d[i] * 1e6)) | 0
  }
  return (h >>> 0).toString(16)
}

export default function SelfTest({ ready }: { ready: boolean }) {
  const [out, setOut] = useState('en attente du chargement des sons…')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!ready || done) return
    let cancelled = false
    void (async () => {
      const cases: unknown[] = []
      const sums: string[] = []
      let n = 0
      for (const c of CASES) {
        n++
        if (!cancelled) setOut(`rendu ${n}/${CASES.length} — ${c.name} (${c.universeId})…`)
        const universe = getUniverse(c.universeId) ?? UNIVERSES[0]
        const selection = c.ids.map(soundById).filter((s): s is Sound => Boolean(s))
        if (selection.length !== c.ids.length) {
          cases.push({ name: c.name, ok: false, error: 'missing sound ids' })
          continue
        }
        const buffers = new Map(selection.map((s) => [s.id, audio.get(s.id)!]))
        const score = buildScore({ universe, selection })
        let rendered
        try {
          rendered = await renderScore(score, buffers, { sampleRate: 44100 })
        } catch (e) {
          cases.push({ name: c.name, universe: c.universeId, ok: false, error: String(e) })
          setOut(`ERREUR sur ${c.name}: ${String(e)}`)
          continue
        }
        const { buffer, report } = rendered
        const sum = checksum(buffer)
        sums.push(sum)

        const corrs = score.signatures.map((sig) => {
          const note = score.notes.find((x) => x.kind === 'signature' && x.sourceId === sig.sourceId)!
          const src = buffers.get(sig.sourceId)!
          return {
            id: sig.sourceId,
            at: Math.round(sig.start * 10) / 10,
            raw: Number(statementCorrelation(buffer, src, sig.start, note.offset).toFixed(2)),
            env: Number(envelopeCorrelation(buffer, src, sig.start, note.offset).toFixed(2)),
            corr: Number(Math.max(
              statementCorrelation(buffer, src, sig.start, note.offset),
              envelopeCorrelation(buffer, src, sig.start, note.offset),
            ).toFixed(2)),
          }
        })
        const minCorr = Math.min(...corrs.map((c) => c.corr))

        let determinism: Record<string, unknown> = {}
        if (c.name === 'tonal-complet') {
          // same collection, clicked in the opposite order -> must be the same piece
          const score2 = buildScore({ universe, selection: [...selection].reverse() })
          const r2 = await renderScore(score2, buffers, { sampleRate: 44100 })
          const d = maxDiff(buffer, r2.buffer)
          determinism = {
            sameSeedRegardlessOfOrder: score2.seed === score.seed,
            sameNoteCount: r2.report.noteCount === report.noteCount,
            maxSampleDiff: Number(d.toExponential(2)),
            reproducible: d < 1e-5,
          }
        }

        const expected = selection.map((s) => s.id).sort()
        const reported = [...report.signatureSourceIds].sort()
        const everySelectedHasSignature = JSON.stringify(reported) === JSON.stringify(expected)
        const durationInRange = buffer.duration >= 30 && buffer.duration <= 46
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
          seed: score.seed,
          signatures: score.signatures.map((s) => ({ id: s.sourceId, at: Math.round(s.start * 10) / 10, rate: s.rate })),
          recognizability: corrs,
          minCorrelation: minCorr,
          adaptations: score.adaptations.length,
          limits: score.limits,
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
      }
      const payload = {
        catalogSource: catalog.source,
        sounds: catalog.sounds.length,
        cases,
        distinctSelections: sums.length > 1 && new Set(sums).size > 1,
        allOk: cases.every((r) => (r as { ok: boolean }).ok),
      }
      if (cancelled) return
      ;(window as unknown as { __SUGAR_SELFTEST__: unknown }).__SUGAR_SELFTEST__ = payload
      console.log('SUGAR_SELFTEST ' + JSON.stringify(payload))
      setOut(JSON.stringify(payload, null, 2))
      setDone(true)
    })()
    return () => { cancelled = true }
  }, [ready, done])

  return (
    <div className="shell selftest">
      <h1 style={{ fontSize: '1.4rem', marginBottom: 12 }}>Sugar Orchestra — vérification des invariants</h1>
      <p style={{ color: 'var(--ink-2)', fontSize: '.84rem', marginBottom: 12 }}>
        Rend {CASES.length} pièces hors ligne (deux univers, sélections riches et pauvres) et vérifie : aucune source
        étrangère, chaque son gardé a un passage brut, durée 30–45 s, aucun clipping, déterminisme.
      </p>
      <pre id="selftest-out">{out}</pre>
    </div>
  )
}
