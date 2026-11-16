import { useEffect, useState } from 'react'
import { catalog } from '../audio/service'
import { applyEnvelope, bufferPeak, makeupFor, previewWindow, PREVIEW_PEAK } from '../audio/previewEnvelope'

/**
 * Test de non-régression audio — `?audiotest=1`
 *
 * Il répond à une question précise : « les huit samples de la démonstration
 * produisent-ils réellement du son quand l'application les joue ? »
 *
 * Ce que ce test fait, pour chaque sample publié :
 *   1. il le télécharge par le chemin exact qu'utilise le visiteur ;
 *   2. il le décode avec le même `decodeAudioData` que l'application ;
 *   3. il mesure le contenu du buffer décodé (crête, RMS) ;
 *   4. il rejoue la **fenêtre et l'enveloppe de production** (`previewEnvelope.ts`,
 *      les fonctions qu'appelle `preview()`) dans un `OfflineAudioContext` et
 *      mesure le signal obtenu.
 *
 * Pourquoi un rendu hors ligne : un navigateur sans périphérique audio ne produit
 * aucun son audible, donc « j'entends quelque chose » n'est pas une assertion
 * testable. Le rendu hors ligne, lui, est déterministe et mesure exactement le
 * signal que la chaîne enverrait au haut-parleur.
 *
 * Ce que ce test ne prouve pas : que le son sort physiquement de l'appareil
 * (volume système, mode silencieux iOS, sortie Bluetooth). C'est indiqué à
 * l'écran, et c'est le seul point qui demande un test humain.
 */

interface Row {
  code: string
  file: string
  status: 'attente' | 'ok' | 'echec'
  durationS?: number
  decodedPeak?: number
  decodedRms?: number
  renderedPeak?: number
  renderedRms?: number
  detail?: string
}

const DEMO_PREFIX = 'audio/demo/'
const PEAK_MIN = 0.05

const fmt = (n?: number, d = 4) => (typeof n === 'number' ? n.toFixed(d) : '—')

async function measureBuffer(buffer: AudioBuffer) {
  const ch = buffer.getChannelData(0)
  let peak = 0
  let sum = 0
  for (let i = 0; i < ch.length; i++) {
    const v = Math.abs(ch[i])
    if (v > peak) peak = v
    sum += ch[i] * ch[i]
  }
  return { peak, rms: Math.sqrt(sum / ch.length) }
}

async function checkOne(sound: { code: string; file: string; analysis?: { onsets?: number[] } }, ctx: AudioContext): Promise<Row> {
  const row: Row = { code: sound.code, file: sound.file, status: 'attente' }
  try {
    const res = await fetch(new URL(sound.file, document.baseURI).toString())
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${sound.file}`)
    const buf = await ctx.decodeAudioData(await res.arrayBuffer())
    row.durationS = buf.duration
    const decoded = await measureBuffer(buf)
    row.decodedPeak = decoded.peak
    row.decodedRms = decoded.rms

    // Fenêtre + enveloppe + égalisation de PRODUCTION, rendues hors ligne.
    const { offset, duration } = previewWindow(buf.duration, 6, sound.analysis?.onsets?.[0], 0)
    const makeup = makeupFor(bufferPeak(buf))
    const sr = 44100
    const offline = new OfflineAudioContext(Math.max(1, buf.numberOfChannels), Math.ceil(sr * (duration + 0.1)), sr)
    const src = offline.createBufferSource()
    src.buffer = buf
    const gain = offline.createGain()
    applyEnvelope(gain.gain, 0, duration, makeup * PREVIEW_PEAK)
    src.connect(gain)
    gain.connect(offline.destination)
    src.start(0, offset, duration)
    const rendered = await offline.startRendering()
    const out = await measureBuffer(rendered)
    row.renderedPeak = out.peak
    row.renderedRms = out.rms

    const problems: string[] = []
    if (Math.abs(buf.duration - 5) > 0.01) problems.push(`durée ${buf.duration.toFixed(3)} s ≠ 5 s`)
    if (decoded.peak < PEAK_MIN) problems.push(`buffer quasi muet (crête ${decoded.peak.toFixed(4)})`)
    if (out.peak < PEAK_MIN) problems.push(`chaîne de lecture muette (crête ${out.peak.toFixed(4)})`)
    row.status = problems.length === 0 ? 'ok' : 'echec'
    if (problems.length) row.detail = problems.join(' · ')
  } catch (e) {
    row.status = 'echec'
    row.detail = String(e instanceof Error ? e.message : e)
  }
  return row
}

export default function AudioTest() {
  const [rows, setRows] = useState<Row[]>([])
  const [ctxState, setCtxState] = useState('—')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    const sounds = catalog.sounds.filter((s) => (s.file ?? '').startsWith(DEMO_PREFIX))
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ latencyHint: 'playback' })
    setCtxState(ctx.state)
    ;(async () => {
      const out: Row[] = []
      for (const s of sounds) {
        const r = await checkOne(s as never, ctx)
        out.push(r)
        if (alive) setRows([...out])
      }
      if (alive) setDone(true)
    })()
    return () => { alive = false; void ctx.close().catch(() => {}) }
  }, [])

  const total = rows.length
  const ok = rows.filter((r) => r.status === 'ok').length
  const failed = rows.filter((r) => r.status === 'echec').length

  return (
    <div className="shell selftest" style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Test audio — démonstration</h1>
      <p style={{ marginBottom: 12, opacity: 0.75, fontSize: 14 }}>
        Chaque sample est téléchargé par le chemin du visiteur, décodé, puis rejoué
        à travers la fenêtre et l'enveloppe réellement utilisées à la lecture. Le
        signal est mesuré après rendu.
      </p>
      <p style={{ marginBottom: 12, fontSize: 14 }}>
        Contexte audio réel : <b>{ctxState}</b>
        {' · '}
        {done ? <b>{ok}/{total} OK{failed ? ` · ${failed} échec(s)` : ''}</b> : <b>test en cours…</b>}
      </p>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', maxWidth: 900 }}>
        <thead>
          <tr>
            {['', 'Sample', 'Durée', 'Crête buffer', 'RMS buffer', 'Crête rendu', 'RMS rendu', 'Détail'].map((h) => (
              <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #999', padding: '4px 8px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td style={{ padding: '4px 8px' }}>{r.status === 'ok' ? '✅' : r.status === 'echec' ? '❌' : '…'}</td>
              <td style={{ padding: '4px 8px' }}><code>{r.code}</code> <span style={{ opacity: 0.6 }}>{r.file.replace(DEMO_PREFIX, '')}</span></td>
              <td style={{ padding: '4px 8px' }}>{r.durationS ? `${r.durationS.toFixed(3)} s` : '—'}</td>
              <td style={{ padding: '4px 8px' }}>{fmt(r.decodedPeak)}</td>
              <td style={{ padding: '4px 8px' }}>{fmt(r.decodedRms)}</td>
              <td style={{ padding: '4px 8px' }}>{fmt(r.renderedPeak)}</td>
              <td style={{ padding: '4px 8px' }}>{fmt(r.renderedRms)}</td>
              <td style={{ padding: '4px 8px', color: r.status === 'echec' ? '#b00' : 'inherit' }}>{r.detail ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 16, fontSize: 13, opacity: 0.75, maxWidth: 900 }}>
        Ce test ne prouve pas que le son sort de l'appareil : volume système, mode
        silencieux iOS et sortie Bluetooth ne sont pas observables ici. Cette
        vérification reste humaine.
      </p>
    </div>
  )
}
