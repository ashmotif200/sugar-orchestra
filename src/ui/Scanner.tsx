import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { Button } from '../ui/kit'

/**
 * Lecture d'un QR code avec la caméra.
 *
 * Deux limites matérielles assumées, jamais masquées :
 *   1. `getUserMedia` exige un contexte sécurisé (HTTPS ou localhost). En HTTP
 *      sur une IP, le navigateur refuse : on l'explique au lieu de faire semblant.
 *   2. `BarcodeDetector` n'existe pas partout ( Firefox, iOS ancien).
 * Dans les deux cas, l'écran propose la solution de secours : l'appareil photo
 * natif du téléphone, qui ouvre le lien encodé dans le QR.
 */
type Etat = 'init' | 'scan' | 'refus' | 'indisponible'

export default function Scanner({ onDetected, onClose }: { onDetected: (payload: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [etat, setEtat] = useState<Etat>('init')
  const [detail, setDetail] = useState<string | null>(null)
  const stop = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    const fini = () => { stop.current?.(); stop.current = null }

    ;(async () => {
      if (!window.isSecureContext) { setEtat('refus'); setDetail(t('scan.insecure')); return }
      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
      if (!Detector) { setEtat('indisponible'); return }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return }
        if (video.current) { video.current.srcObject = stream; await video.current.play() }
        const detector = new Detector({ formats: ['qr_code'] })
        let alive = true
        const loop = async () => {
          if (!alive || !video.current) return
          try {
            const codes = await detector.detect(video.current)
            if (codes.length > 0) { alive = false; fini(); onDetected(codes[0].rawValue); return }
          } catch { /* image pas encore prête */ }
          requestAnimationFrame(loop)
        }
        setEtat('scan')
        void loop()
        stop.current = () => { alive = false; stream.getTracks().forEach((tr) => tr.stop()) }
      } catch (e) {
        setEtat('refus')
        setDetail(String((e as Error)?.name ?? e))
      }
    })()

    return () => { cancelled = true; fini() }
  }, [onDetected])

  return (
    <div className="scanner">
      <div className="scanner-frame">
        {etat === 'scan' && <video ref={video} playsInline muted className="scanner-video" />}
        {etat !== 'scan' && (
          <div className="scanner-fallback">
            <b>{etat === 'refus' ? t('scan.cameraRefused') : t('scan.noDetector')}</b>
            <p>{detail ?? t('scan.useNative')}</p>
            {etat === 'refus' && <p className="micro">{t('scan.httpsHint')}</p>}
          </div>
        )}
      </div>
      <div className="row-actions">
        <Button wide onClick={onClose}>{t('scan.close')}</Button>
      </div>
    </div>
  )
}
