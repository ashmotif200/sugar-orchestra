import type { Catalog, Sound } from './types'
import catalogJson from '../data/catalog.json'
import { renderScore, encodeWav, type RenderReport } from '../engine/render'
import type { Score } from '../engine/plan'

export const catalog = catalogJson as unknown as Catalog

export const allSounds = (): Sound[] => catalog.sounds
export const soundById = (id: string): Sound | undefined => catalog.sounds.find((s) => s.id === id)
export const stepSounds = (stepId: number): Sound[] => catalog.sounds.filter((s) => s.stepId === stepId)
export const titleOf = (s: Sound): string => s.title ?? s.name

export interface PlayHandle {
  stop: () => void
  currentTime: () => number
  duration: number
}

type Listener = () => void

/**
 * Possède l'AudioContext, les PCM décodés, l'écoute individuelle et la lecture
 * de la pièce. Les sons sont décodés à la demande, par étape : ouvrir l'étape 6
 * ne télécharge pas les 40 fichiers.
 */
class AudioService {
  private ctx: AudioContext | null = null
  private buffers = new Map<string, AudioBuffer>()
  private audition: { src: AudioBufferSourceNode; gain: GainNode } | null = null
  private playing: { src: AudioBufferSourceNode; startedAt: number; buffer: AudioBuffer } | null = null
  private listeners = new Set<Listener>()
  private loading = new Set<string>()
  private pending = new Map<string, Promise<void>>()
  loadError: string | null = null

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { for (const fn of this.listeners) fn() }

  async context(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor({ latencyHint: 'playback' })
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
    return this.ctx
  }

  /**
   * Décode un WAV déjà rendu (restauration d'une composition depuis IndexedDB).
   * Ne touche ni au moteur ni aux sons du catalogue : c'est le même
   * decodeAudioData que pour les samples, appliqué à un fichier produit par nous.
   */
  async decodeWav(data: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = await this.context()
    // slice(0) : decodeAudioData détache le buffer fourni, on garde l'original intact
    return await ctx.decodeAudioData(data.slice(0))
  }

  /** Réservé aux gestes utilisateur : échoue franchement si le navigateur refuse. */
  private async runningContext(): Promise<AudioContext> {
    const ctx = await this.context()
    if (ctx.state !== 'running') {
      try { await ctx.resume() } catch { /* vérifié juste après */ }
    }
    if (ctx.state !== 'running') throw new Error('autoplay-bloque')
    return ctx
  }

  /**
   * Décode les sons demandés (une seule fois chacun) et attend aussi les
   * décodages déjà en vol : un second appel ne doit pas rendre la main avant
   * que les buffers soient réellement là.
   */
  async ensure(ids: string[], onProgress?: (done: number, total: number) => void): Promise<void> {
    const ctx = await this.context()
    const toStart = ids.filter((id) => !this.buffers.has(id) && !this.pending.has(id))
    const total = toStart.length
    let done = 0
    for (const id of toStart) {
      const p = (async () => {
        this.loading.add(id)
        const sound = soundById(id)
        try {
          if (!sound) throw new Error(`son inconnu ${id}`)
          const res = await fetch(new URL(sound.file, document.baseURI).toString())
          if (!res.ok) throw new Error(`HTTP ${res.status} sur ${sound.file}`)
          const buf = await ctx.decodeAudioData(await res.arrayBuffer())
          this.buffers.set(id, buf)
          this.loadError = null
        } catch (e) {
          this.loadError = (e as Error).message
        } finally {
          this.loading.delete(id)
          this.pending.delete(id)
          done++
          onProgress?.(done, total)
          this.emit()
        }
      })()
      this.pending.set(id, p)
    }
    await Promise.all(ids.map((id) => this.pending.get(id) ?? Promise.resolve()))
  }

  has(id: string) { return this.buffers.has(id) }
  get(id: string) { return this.buffers.get(id) }
  isLoading(id: string) { return this.loading.has(id) }

  /** Écoute individuelle. Jamais de lecture automatique. */
  async preview(sound: Sound, seconds = 6, onEnded?: () => void): Promise<void> {
    const ctx = await this.runningContext()
    const buf = this.buffers.get(sound.id)
    if (!buf) throw new Error('son non chargé')
    this.stopPreview()
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    const offset = Math.min(sound.analysis.onsets[0] ?? 0, Math.max(0, buf.duration - seconds - 0.2))
    const dur = Math.min(seconds, buf.duration - offset)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.03)
    gain.gain.setValueAtTime(0.9, ctx.currentTime + dur - 0.4)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur)
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start(0, offset, dur)
    this.audition = { src, gain }
    this.emit()
    src.onended = () => {
      if (this.audition?.src === src) { this.audition = null; this.emit() }
      onEnded?.()
    }
  }

  stopPreview() {
    if (this.audition) {
      try { this.audition.src.stop() } catch { /* déjà arrêté */ }
      this.audition = null
      this.emit()
    }
  }

  isPreviewing() { return this.audition !== null }

  async render(score: Score): Promise<{ buffer: AudioBuffer; report: RenderReport }> {
    await this.context()
    const ids = [...new Set(score.notes.map((n) => n.sourceId))]
    await this.ensure(ids)
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
    // Si le navigateur refuse de démarrer, il ne faut pas laisser croire que la
    // lecture a commencé : on arrête et on lève une erreur explicite.
    if (ctx.state !== 'running') {
      try { src.stop() } catch { /* déjà arrêté */ }
      throw new Error('autoplay-bloque')
    }
    this.playing = { src, startedAt, buffer }
    this.emit()
    src.onended = () => {
      if (this.playing?.src === src) { this.playing = null; this.emit() }
      onDone?.()
    }
    return {
      stop: () => { try { src.stop() } catch { /* déjà arrêté */ } },
      currentTime: () => Math.min(buffer.duration, ctx.currentTime - startedAt),
      duration: buffer.duration,
    }
  }

  stopPiece() {
    if (this.playing) {
      try { this.playing.src.stop() } catch { /* déjà arrêté */ }
      this.playing = null
      this.emit()
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

/** Pics normalisés pour les formes d'onde. */
export function peaks(buffer: AudioBuffer, bins = 120): number[] {
  const data = buffer.getChannelData(0)
  const block = Math.floor(data.length / bins) || 1
  const rms: number[] = []
  let max = 0
  for (let i = 0; i < bins; i++) {
    let sum = 0, n = 0
    for (let j = i * block; j < Math.min((i + 1) * block, data.length); j += 2) {
      const v = data[j]
      sum += v * v
      n++
    }
    const v = Math.sqrt(sum / Math.max(1, n))
    rms.push(v)
    if (v > max) max = v
  }
  // échelle adoucie : une pièce compressée garde une silhouette lisible
  return rms.map((v) => (max > 0 ? Math.pow(v / max, 0.55) : 0))
}

// point d'inspection (autotest + diagnostic navigateur)
;(window as unknown as { __sugarAudio: AudioService }).__sugarAudio = audio
