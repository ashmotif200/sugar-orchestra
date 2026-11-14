import { useCallback, useEffect, useRef, useState } from 'react'
import { audio } from './service'
import type { Sound } from './types'

/**
 * État de lecture d'un sample, partagé par tous les lecteurs de l'application
 * (carnet, fiche d'étape, fiche de poste).
 *
 * La position vient du moteur audio réel (`auditionInfo()`), jamais d'un
 * compteur indépendant : la waveform et le bouton ne peuvent donc pas dériver.
 * La boucle d'animation ne tourne QUE pendant la lecture et s'arrête dès
 * l'arrêt, la pause, la fin ou le démontage.
 */
export interface SamplePlayerState {
  id: string | null
  playing: boolean
  paused: boolean
  position: number
  duration: number
}

const IDLE: SamplePlayerState = { id: null, playing: false, paused: false, position: 0, duration: 0 }

export function useSamplePlayer(seconds = 6) {
  const [state, setState] = useState<SamplePlayerState>(IDLE)
  const raf = useRef(0)
  const alive = useRef(true)

  const stopLoop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])

  const tick = useCallback(function loop() {
    if (!alive.current) return
    const info = audio.auditionInfo()
    if (!info.playing || !info.soundId) {
      stopLoop()
      setState((s) => (s.playing ? { ...s, playing: false, position: 0, paused: false } : s))
      return
    }
    setState((s) => ({ ...s, id: info.soundId, playing: true, paused: false, position: info.position, duration: info.duration }))
    raf.current = requestAnimationFrame(loop)
  }, [stopLoop])

  const start = useCallback((sound: Sound, from = 0) => {
    stopLoop()
    setState({ id: sound.id, playing: true, paused: false, position: from, duration: seconds })
    // le carnet n'a pas forcément décodé ce son : sans ce chargement, preview()
    // échoue sur « son non chargé » et le bouton revient aussitôt sur Play
    audio.ensure([sound.id]).then(() => audio.preview(sound, seconds, () => {
      stopLoop()
      setState({ id: sound.id, playing: false, paused: false, position: 0, duration: seconds })
    }, from)).then(() => {
      raf.current = requestAnimationFrame(tick)
    }).catch(() => {
      stopLoop()
      setState({ id: sound.id, playing: false, paused: false, position: 0, duration: seconds })
    })
  }, [seconds, stopLoop, tick])

  /** Bascule play / pause / reprise pour un sample donné. */
  const toggle = useCallback((sound: Sound) => {
    const info = audio.auditionInfo()
    if (info.playing && info.soundId === sound.id) {
      const pos = audio.pausePreview()
      stopLoop()
      setState({ id: sound.id, playing: false, paused: true, position: pos, duration: info.duration })
      return
    }
    // autre sample en cours : il s'arrête, sa position repart de zéro
    if (info.playing) audio.stopPreview()
    const paused = audio.pausedPreviewInfo()
    const resumeAt = paused && paused.soundId === sound.id ? paused.position : 0
    start(sound, resumeAt)
  }, [start, stopLoop])

  const stop = useCallback(() => {
    audio.stopPreview()
    stopLoop()
    setState(IDLE)
  }, [stopLoop])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      stopLoop()
      audio.stopPreview()
    }
  }, [stopLoop])

  return { state, toggle, stop }
}
