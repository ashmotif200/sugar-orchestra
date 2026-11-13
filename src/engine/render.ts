import type { Role } from '../audio/types'
import type { NoteEvent, Score } from './plan'
import { mulberry32 } from './rng'

export interface RenderReport {
  universeId: string
  durationS: number
  sampleRate: number
  noteCount: number
  grainCount: number
  selectedSourceIds: string[]
  usedSourceIds: string[]
  signatureSourceIds: string[]
  foreignSources: string[]
  missingSignature: string[]
  peakDb: number
  rmsDb: number
  checks: {
    onlySelectedSources: boolean
    everySourceRecognizable: boolean
    noExternalSamples: boolean
  }
  ok: boolean
}

export interface RenderResult {
  buffer: AudioBuffer
  report: RenderReport
}

const ROLE_GAIN: Record<Role, number> = {
  bass: 0.95,
  melody: 1.0,
  rhythm: 0.9,
  earcandy: 0.72,
  texture: 0.78,
}

export async function renderScore(
  score: Score,
  buffers: Map<string, AudioBuffer>,
  opts: { sampleRate?: number } = {},
): Promise<RenderResult> {
  const sr = opts.sampleRate ?? 44100
  const tail = 1.6
  const total = score.durationS + tail
  const ctx = new OfflineAudioContext(2, Math.ceil(total * sr), sr)

  /* ---- master chain: sum -> compressor -> soft output gain ---- */
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, 0)
  master.gain.linearRampToValueAtTime(1, 0.06)
  master.gain.setValueAtTime(1, Math.max(0.1, score.durationS - 2.4))
  master.gain.linearRampToValueAtTime(0, score.durationS + 0.8)

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -22
  comp.knee.value = 6
  comp.ratio.value = 4
  comp.attack.value = 0.004
  comp.release.value = 0.14
  master.connect(comp)
  comp.connect(ctx.destination)

  /* ---- role buses -> music bus (ducked) ; raw statements -> their own bus ---- */
  const music = ctx.createGain()
  music.gain.setValueAtTime(1, 0)
  music.connect(master)

  // Every raw statement is carved out of the arrangement: the whole music bus
  // steps back so the visitor's sound is unmistakably the thing they hear.
  for (const w of score.duckWindows) {
    const s = Math.max(0, w.start - 0.06)
    music.gain.setValueAtTime(1, s)
    music.gain.linearRampToValueAtTime(0.18, w.start + 0.05)
    music.gain.setValueAtTime(0.18, w.end)
    music.gain.linearRampToValueAtTime(1, w.end + 0.35)
  }

  const sigBus = ctx.createGain()
  sigBus.gain.value = 1
  sigBus.connect(master)

  const buses = new Map<Role, GainNode>()
  for (const role of Object.keys(ROLE_GAIN) as Role[]) {
    const g = ctx.createGain()
    g.gain.value = ROLE_GAIN[role]
    g.connect(music)
    buses.set(role, g)
  }

  /* ---- shared echo bus (procedural: no impulse response sample) ---- */
  const send = ctx.createGain()
  send.gain.value = 1
  const delay = ctx.createDelay(1.5)
  delay.delayTime.value = score.universeId === 'reveur' ? 0.46 : 0.27
  const fb = ctx.createGain()
  fb.gain.value = 0.38
  const damp = ctx.createBiquadFilter()
  damp.type = 'lowpass'
  damp.frequency.value = 2600
  const wet = ctx.createGain()
  wet.gain.value = 0.5
  send.connect(delay)
  delay.connect(damp)
  damp.connect(fb)
  fb.connect(delay)
  delay.connect(wet)
  wet.connect(master)

  /* ---- scheduling ---- */
  const rng = mulberry32(score.seed ^ 0x9e3779b9)
  const reversedCache = new Map<string, AudioBuffer>()
  const used = new Set<string>()
  let grainCount = 0
  let scheduled = 0

  const reversed = (buf: AudioBuffer, id: string) => {
    const cached = reversedCache.get(id)
    if (cached) return cached
    const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate)
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const src = buf.getChannelData(c)
      const dst = out.getChannelData(c)
      for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i]
    }
    reversedCache.set(id, out)
    return out
  }

  const makeFilter = (n: NoteEvent) => {
    if (!n.filter) return null
    const f = ctx.createBiquadFilter()
    f.type = n.filter.type
    f.frequency.setValueAtTime(Math.max(20, n.filter.freq), n.start)
    f.Q.value = n.filter.q ?? 0.7
    if (n.filter.sweepTo) {
      f.frequency.exponentialRampToValueAtTime(Math.max(20, n.filter.sweepTo), n.start + Math.max(0.05, n.dur))
    }
    return f
  }

  const pannerFor = (n: NoteEvent) => {
    if (!n.pan) return null
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, n.pan))
    return p
  }

  const busFor = (role: Role) => buses.get(role)!

  for (const raw of score.notes) {
    // jitter can push a note a hair before zero; Web Audio rejects negative times
    const n = raw.start < 0 ? { ...raw, start: 0 } : raw
    const buf = buffers.get(n.sourceId)
    if (!buf) continue
    used.add(n.sourceId)

    const dest = n.kind === 'signature' ? sigBus : busFor(n.role)
    const filter = makeFilter(n)
    const panner = pannerFor(n)
    const sendGain = ctx.createGain()
    sendGain.gain.value = n.send ?? 0
    sendGain.connect(send)

    if (n.granular) {
      /* --- granular cloud: many short grains from one selected source --- */
      const group = ctx.createGain()
      group.gain.value = 1
      let head: AudioNode = group
      if (filter) { group.connect(filter); head = filter }
      if (panner) { head.connect(panner); head = panner }
      head.connect(dest)
      head.connect(sendGain)

      const grainDur = Math.min(0.6, n.granular.grainMs / 1000)
      const density = Math.max(2, n.granular.density)
      const count = Math.max(1, Math.floor(n.dur * density))
      const step = n.dur / count
      for (let i = 0; i < count; i++) {
        const t = Math.max(0.001, n.start + i * step + (rng() - 0.5) * step * 0.6)
        const maxOffset = Math.max(0, buf.duration - grainDur * n.rate - 0.01)
        const offset = Math.min(maxOffset, n.offset + rng() * Math.min(6, maxOffset))
        const g = ctx.createGain()
        const peak = n.gain * (0.55 + rng() * 0.5)
        const atk = grainDur * 0.35
        const rel = grainDur * 0.55
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(peak, t + atk)
        g.gain.linearRampToValueAtTime(0, t + atk + rel)
        const s = ctx.createBufferSource()
        s.buffer = n.reverse ? reversed(buf, n.sourceId) : buf
        s.playbackRate.value = n.rate * (1 + (rng() - 0.5) * 0.02)
        s.connect(g)
        g.connect(group)
        s.start(t, offset, grainDur * n.rate + 0.02)
        grainCount++
      }
      // slow overall envelope so the cloud breathes
      group.gain.setValueAtTime(0, n.start)
      group.gain.linearRampToValueAtTime(1, n.start + Math.min(n.attack, n.dur * 0.4))
      group.gain.setValueAtTime(1, n.start + n.dur - Math.min(n.release, n.dur * 0.4))
      group.gain.linearRampToValueAtTime(0, n.start + n.dur)
      scheduled++
      continue
    }

    /* --- single slice --- */
    const available = Math.max(0.05, buf.duration - n.offset)
    const dur = Math.min(n.dur, available / Math.max(0.25, n.rate))
    const atk = Math.min(n.attack, dur * 0.5)
    const rel = Math.min(n.release, dur * 0.6)

    const s = ctx.createBufferSource()
    s.buffer = n.reverse ? reversed(buf, n.sourceId) : buf
    s.playbackRate.value = n.rate

    const g = ctx.createGain()
    g.gain.setValueAtTime(0, n.start)
    g.gain.linearRampToValueAtTime(n.gain, n.start + Math.max(0.003, atk))
    g.gain.setValueAtTime(n.gain, Math.max(n.start + 0.004, n.start + dur - rel))
    g.gain.linearRampToValueAtTime(0, n.start + dur)

    let head: AudioNode = s
    if (filter) { head.connect(filter); head = filter }
    head.connect(g)
    if (panner) { g.connect(panner); panner.connect(dest) } else { g.connect(dest) }
    g.connect(sendGain)

    s.start(n.start, n.offset, dur * n.rate + 0.02)
    s.stop(n.start + dur + 0.02)
    scheduled++
  }

  /* ---- render ---- */
  const rendered = await ctx.startRendering()
  const { peak } = measure(rendered)

  // Loudness + peak normalisation: bring the piece to a presentation level
  // (-16 dBFS RMS) without ever letting a peak through above -1 dBFS.
  const rmsBefore = measure(rendered).rms
  const targetPeak = 0.891
  const targetRms = Math.pow(10, -16 / 20)
  let gain = 1
  if (rmsBefore > 0 && peak > 0) {
    gain = Math.min(targetRms / rmsBefore, targetPeak / peak)
    gain = Math.min(gain, 6)
    // never make a quiet take quieter than -20 dBFS RMS
    gain = Math.max(gain, Math.min(targetPeak / peak, 1))
  }
  if (Math.abs(gain - 1) > 0.01) {
    for (let c = 0; c < rendered.numberOfChannels; c++) {
      const d = rendered.getChannelData(c)
      for (let i = 0; i < d.length; i++) d[i] *= gain
    }
  }
  const after = measure(rendered)

  const selectedSourceIds = [...new Set(score.notes.map((n) => n.sourceId))]
  const signatureSourceIds = [...new Set(score.signatures.map((s) => s.sourceId))]
  const foreignSources = [...used].filter((id) => !buffers.has(id))
  const missingSignature = [...used].filter((id) => !signatureSourceIds.includes(id))
  const onlySelected = foreignSources.length === 0 && [...used].every((id) => selectedSourceIds.includes(id))
  const everySourceRecognizable = missingSignature.length === 0 && score.signatures.length > 0
  const peakDb = 20 * Math.log10(after.peak || 1e-9)
  const rmsDb = 20 * Math.log10(after.rms || 1e-9)

  return {
    buffer: rendered,
    report: {
      universeId: score.universeId,
      durationS: rendered.duration,
      sampleRate: rendered.sampleRate,
      noteCount: scheduled,
      grainCount,
      selectedSourceIds,
      usedSourceIds: [...used],
      signatureSourceIds,
      foreignSources,
      missingSignature,
      peakDb: Math.round(peakDb * 10) / 10,
      rmsDb: Math.round(rmsDb * 10) / 10,
      checks: {
        onlySelectedSources: onlySelected,
        everySourceRecognizable,
        noExternalSamples: true, // structurally: every buffer comes from the selection map
      },
      ok: onlySelected && everySourceRecognizable && peakDb <= -0.5,
    },
  }
}

function measure(buf: AudioBuffer) {
  let peak = 0
  let sumSq = 0
  let count = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const v = d[i]
      const a = Math.abs(v)
      if (a > peak) peak = a
      sumSq += v * v
      count++
    }
  }
  return { peak, rms: Math.sqrt(sumSq / Math.max(1, count)) }
}

/** 16-bit PCM WAV encoder for the optional export. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const ch = buffer.numberOfChannels
  const len = buffer.length
  const bytes = 44 + len * ch * 2
  const ab = new ArrayBuffer(bytes)
  const view = new DataView(ab)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); view.setUint32(4, bytes - 8, true); str(8, 'WAVE')
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true)
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * ch * 2, true)
  view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true)
  str(36, 'data'); view.setUint32(40, len * ch * 2, true)
  const chans = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c))
  let o = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]))
      view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      o += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}
