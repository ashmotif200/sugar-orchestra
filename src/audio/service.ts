import type { Catalog, Sound } from './types'
import { applyEnvelope, bufferPeak, makeupFor, previewWindow, PREVIEW_PEAK as PREVIEW_CEILING } from './previewEnvelope'
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
  private audition: { src: AudioBufferSourceNode; gain: GainNode; soundId: string; startedAt: number; offset: number; dur: number } | null = null
  private pausedPreview: { soundId: string | null; position: number } | null = null
  private playing: { src: AudioBufferSourceNode; startedAt: number; buffer: AudioBuffer } | null = null
  private listeners = new Set<Listener>()
  private loading = new Set<string>()
  private pending = new Map<string, Promise<void>>()
  /** vrai une fois qu'un buffer muet a ouvert la sortie pendant un geste */
  private primed = false
  /** crête mesurée de chaque buffer décodé, pour l'égalisation de préécoute */
  private peaks = new Map<string, number>()
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
   * Débloque la sortie audio À L'INTÉRIEUR d'un geste utilisateur.
   *
   * Pourquoi c'est nécessaire — et pourquoi ce n'était pas fait :
   *
   * `ensure()` (montage d'un écran) crée l'AudioContext sans geste. Le contexte
   * naît alors `suspended`. Jusqu'ici, la reprise était tentée plus tard, depuis
   * une chaîne de promesses : `await this.context()` puis `await ctx.resume()`.
   * Deux awaits suffisent à sortir de l'activation utilisateur sur Safari iOS, et
   * `resume()` y reste alors sans effet — la promesse ne se résout pas, aucune
   * erreur n'est levée, et l'application affichait « Arrêter » sans qu'un seul
   * échantillon soit joué. Chrome de bureau a le même mode d'échec quand la
   * politique de lecture automatique est stricte.
   *
   * La règle est donc : créer/réveiller le contexte de façon SYNCHRONE dans le
   * geste, sans aucun `await` avant l'appel à `resume()`. Cette méthode ne rend
   * pas de promesse à attendre — elle agit immédiatement.
   */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        this.ctx = new Ctor({ latencyHint: 'playback' })
      }
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
      // Un buffer silencieux d'une trame force certains navigateurs à ouvrir la
      // sortie pendant le geste. Coût nul, effet mesurable sur iOS.
      if (this.ctx.state === 'running' && !this.primed) {
        const src = this.ctx.createBufferSource()
        src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
        src.connect(this.ctx.destination)
        src.start(0)
        this.primed = true
      }
    } catch { /* pas de contexte : l'appel suivant expliquera l'échec */ }
  }

  /**
   * Attend que le contexte soit réellement `running`, avec une borne de temps.
   *
   * Le point délicat : `resume()` peut **ne jamais se résoudre**. C'était le cas
   * dans l'environnement de mesure (aucun périphérique de sortie) et c'est le
   * comportement documenté de Safari iOS quand le contexte n'a pas été débloqué
   * dans un geste. Attendre `resume()` sans borne laissait donc l'interface
   * annoncer une lecture qui n'existait pas : bouton sur « Arrêter », aucun
   * `start()`, aucune erreur, aucun son.
   *
   * On ne met donc pas un garde-temps *après* `resume()`, on met `resume()` **en
   * course** avec lui. Au pire on échoue au bout de 1,5 s avec une erreur
   * explicite ; jamais on ne ment indéfiniment.
   */
  private async runningContext(): Promise<AudioContext> {
    const ctx = this.contextSync()
    if (ctx.state !== 'running') {
      await Promise.race([
        ctx.resume().catch(() => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ])
    }
    if (ctx.state !== 'running') throw new Error('autoplay-bloque')
    return ctx
  }

  /** Le contexte produit-il réellement du son en ce moment ? */
  isRunning(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  /** État du contexte, pour le diagnostic (jamais utilisé pour décider du parcours). */
  contextState(): string {
    return this.ctx ? this.ctx.state : 'absent'
  }

  /** Obtient le contexte sans jamais attendre : sûr dans un gestionnaire de geste. */
  private contextSync(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor({ latencyHint: 'playback' })
    }
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
  /** Position réelle de la préécoute, en secondes (0 si rien ne joue). */
  auditionInfo(): { soundId: string | null; position: number; duration: number; playing: boolean } {
    const a = this.audition
    if (!a || !this.ctx) return { soundId: null, position: 0, duration: 0, playing: false }
    const elapsed = Math.max(0, this.ctx.currentTime - a.startedAt)
    return {
      soundId: a.soundId,
      position: Math.min(a.dur, a.offset + elapsed),
      duration: a.dur,
      playing: true,
    }
  }

  /** Met la préécoute en pause en mémorisant la position, sans la perdre. */
  pausePreview(): number {
    const info = this.auditionInfo()
    this.stopPreview()
    this.pausedPreview = { soundId: info.soundId, position: info.position }
    return info.position
  }

  pausedPreviewInfo() { return this.pausedPreview }

  async preview(sound: Sound, seconds = 6, onEnded?: () => void, startAt = 0): Promise<void> {
    // Déblocage SYNCHRONE, dans le geste de l'utilisateur : aucun await avant.
    this.unlock()
    const ctx = await this.runningContext()
    const buf = this.buffers.get(sound.id)
    if (!buf) throw new Error('son non chargé')
    this.stopPreview()
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    // `analysis` est optionnel : un catalogue réimporté peut ne pas le porter.
    // Lire `sound.analysis.onsets[0]` sans garde faisait échouer la préécoute
    // avant même le démarrage — le bouton restait donc sur « Écouter ».
    // Fenêtre et enveloppe vivent dans `previewEnvelope.ts`, partagées avec le
    // test de non-régression : ce qui est testé est le code exécuté.
    const { offset, duration: dur } = previewWindow(
      buf.duration, seconds, sound.analysis?.onsets?.[0], startAt,
    )
    // Les huit samples sont 18 à 23 dB sous le morceau final (crêtes 0,20 à 0,87).
    // Sans égalisation, quatre d'entre eux sont inaudibles sur un haut-parleur de
    // téléphone alors que le fichier est valide. Voir `makeupFor` : égalisation par
    // la crête du fichier, plafonnée, sans compression et sans toucher aux fichiers.
    let peak = this.peaks.get(sound.id)
    if (peak === undefined) { peak = bufferPeak(buf); this.peaks.set(sound.id, peak) }
    applyEnvelope(gain.gain, ctx.currentTime, dur, makeupFor(peak) * PREVIEW_CEILING)
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start(0, offset, dur)
    this.audition = { src, gain, soundId: sound.id, startedAt: ctx.currentTime, offset, dur }
    this.pausedPreview = null
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
    this.unlock()
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
