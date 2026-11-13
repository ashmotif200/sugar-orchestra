import type { Catalog, Sound } from './types'
import catalogJson from '../data/catalog.json'
import { renderScore, encodeWav, type RenderReport } from '../engine/render'
import type { Score } from '../engine/plan'

export const catalog = catalogJson as unknown as Catalog

export const soundById = (id: string): Sound | undefined => catalog.sounds.find((s) => s.id === id)

export interface PlayHandle {
  stop: () => void
  currentTime: () => number
  duration: number
}

/**
 * Owns the AudioContext, the decoded PCM of every sound the visitor can hear,
 * the audition player and the piece player. Rendering is delegated to the
 * offline engine (engine/render.ts) so playback is a single buffer: no gaps, no
 * scheduling drift during the presentation.
 */
class AudioService {
  private ctx: AudioContext | null = null
  private buffers = new Map<string, AudioBuffer>()
  private audition: { src: AudioBufferSourceNode; gain: GainNode } | null = null
  private playing: { src: AudioBufferSourceNode; startedAt: number; buffer: AudioBuffer } | null = null
  loaded = false
  loadError: string | null = null

  async context(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor({ latencyHint: 'playback' })
    }
    // Never await resume() outside a gesture: Chrome keeps that promise pending
    // until the user interacts, which would stall decoding.
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
    return this.ctx
  }

  /** Await a running context — only call from inside a click/tap handler. */
  private async runningContext(): Promise<AudioContext> {
    const ctx = await this.context()
    if (ctx.state !== 'running') {
      try { await ctx.resume() } catch { /* handled below */ }
    }
    if (ctx.state !== 'running') {
      // Chrome/Firefox refuse playback without a gesture: say so, never pretend
      throw new Error('autoplay-bloque')
    }
    return ctx
  }

  /** Decode every catalogue sound so the demo never touches the network again. */
  async loadAll(onProgress?: (done: number, total: number) => void): Promise<void> {
    const ctx = await this.context()
    // only the collectable set is decoded: the 40-sound catalogue stays on disk
    const sounds = catalog.sounds.filter((s) => s.inDemoSet !== false)
    let done = 0
    const base = document.baseURI
    await Promise.all(
      sounds.map(async (s) => {
        if (this.buffers.has(s.id)) { done++; return }
        try {
          const url = new URL(s.file, base).toString()
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status} on ${s.file}`)
          const arr = await res.arrayBuffer()
          const buf = await ctx.decodeAudioData(arr)
          this.buffers.set(s.id, buf)
        } catch (e) {
          this.loadError = (e as Error).message
        } finally {
          done++
          onProgress?.(done, sounds.length)
        }
      }),
    )
    this.loaded = this.buffers.size === sounds.length
  }

  has(id: string) { return this.buffers.has(id) }
  get(id: string) { return this.buffers.get(id) }

  /** Individual audition during the visit — the piece itself is never previewed. */
  async preview(sound: Sound, seconds = 4.5): Promise<void> {
    const ctx = await this.runningContext()
    const buf = this.buffers.get(sound.id)
    if (!buf) return
    this.stopPreview()
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    const offset = Math.min(sound.analysis.onsets[0] ?? 0, Math.max(0, buf.duration - seconds - 0.1))
    const dur = Math.min(seconds, buf.duration - offset)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.02)
    gain.gain.setValueAtTime(0.9, ctx.currentTime + dur - 0.25)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur)
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start(0, offset, dur)
    this.audition = { src, gain }
    src.onended = () => { if (this.audition?.src === src) this.audition = null }
  }

  stopPreview() {
    if (this.audition) {
      try { this.audition.src.stop() } catch { /* already stopped */ }
      this.audition = null
    }
  }

  async render(score: Score): Promise<{ buffer: AudioBuffer; report: RenderReport }> {
    await this.context()
    return renderScore(score, this.buffers)
  }

  async playPiece(buffer: AudioBuffer, onDone?: () => void): Promise<PlayHandle> {
    const ctx = await this.runningContext()
    this.stopPiece()
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = 1
    src.connect(gain)
    gain.connect(ctx.destination)
    const startedAt = ctx.currentTime
    src.start()
    this.playing = { src, startedAt, buffer }
    src.onended = () => {
      if (this.playing?.src === src) this.playing = null
      onDone?.()
    }
    return {
      stop: () => { try { src.stop() } catch { /* already stopped */ } },
      currentTime: () => Math.min(buffer.duration, ctx.currentTime - startedAt),
      duration: buffer.duration,
    }
  }

  stopPiece() {
    if (this.playing) {
      try { this.playing.src.stop() } catch { /* already stopped */ }
      this.playing = null
    }
  }

  isPlaying() { return this.playing !== null }
  position() {
    if (!this.playing || !this.ctx) return 0
    return Math.min(this.playing.buffer.duration, this.ctx.currentTime - this.playing.startedAt)
  }

  exportWav(buffer: AudioBuffer, filename: string) {
    const blob = encodeWav(buffer)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }
}

export const audio = new AudioService()

/** Sound ids actually reachable by the visitor in this build. */
export const playableSounds = () => catalog.sounds
export const sectionsWithSounds = () =>
  catalog.sections.filter((sec) => catalog.sounds.some((s) => s.section === sec.id))

// dev/diagnostic handle (used by the self-test page and browser checks)
;(window as unknown as { __sugarAudio: AudioService }).__sugarAudio = audio
