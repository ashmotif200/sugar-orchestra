import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { t } from '../i18n'
import { Button } from '../ui/kit'

/**
 * Lecture d'un QR code avec la caméra.
 *
 * Décodage : `jsQR`, décodeur JavaScript pur. `BarcodeDetector` a été écarté
 * comme dépendance principale : Safari iOS ne l'implémente pas (c'était la
 * cause du message « non prise en charge » alors que la caméra était autorisée).
 *
 * Contraintes matérielles assumées et jamais masquées :
 *   - `getUserMedia` exige un contexte sécurisé (HTTPS). En HTTP, on l'explique.
 *   - un refus de permission est affiché avec son motif.
 *   - le flux caméra est toujours arrêté : à la détection, à la fermeture, au
 *     démontage du composant.
 */
type Etat = 'init' | 'scan' | 'refus' | 'erreur'

export default function Scanner({
  onDetected,
  onClose,
}: {
  onDetected: (payload: string) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [etat, setEtat] = useState<Etat>('init')
  const [detail, setDetail] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let timer = 0
    let locked = false

    const stopCam = () => {
      stream.current?.getTracks().forEach((tr) => tr.stop())
      stream.current = null
    }
    const fail = (kind: Etat, msg: string | null) => {
      if (!alive) return
      stopCam()
      setEtat(kind)
      setDetail(msg)
    }

    ;(async () => {
      if (!window.isSecureContext) {
        fail('refus', t('scan.insecure'))
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        fail('refus', t('scan.noCameraApi'))
        return
      }

      // caméra arrière d'abord, puis n'importe laquelle (certains iPhone
      // n'exposent pas de facingMode exploitable en mode « ideal »)
      let media: MediaStream | null = null
      try {
        media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch {
        try {
          media = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        } catch (e) {
          const name = (e as DOMException)?.name ?? 'Erreur'
          fail('refus', `${name}`)
          return
        }
      }
      if (!alive) {
        media.getTracks().forEach((tr) => tr.stop())
        return
      }
      stream.current = media
      const el = video.current
      if (!el) return
      el.srcObject = media
      el.setAttribute('playsinline', 'true')
      try {
        await el.play()
      } catch {
        fail('erreur', t('scan.playFailed'))
        return
      }
      setEtat('scan')

      const ctx = canvas.current?.getContext('2d', { willReadFrequently: true }) ?? null
      if (!ctx) {
        fail('erreur', t('scan.noCanvas'))
        return
      }

      const tick = () => {
        if (!alive || locked) return
        const v = video.current
        const c = canvas.current
        if (v && c && v.readyState >= 2 && v.videoWidth > 0) {
          // échantillonnage réduit : suffisant pour un QR, beaucoup moins coûteux
          const w = Math.min(640, v.videoWidth)
          const h = Math.round((v.videoHeight / v.videoWidth) * w)
          c.width = w
          c.height = h
          ctx.drawImage(v, 0, 0, w, h)
          try {
            const img = ctx.getImageData(0, 0, w, h)
            const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
            if (code?.data) {
              locked = true
              stopCam()
              onDetected(code.data)
              return
            }
          } catch {
            /* image partielle : on réessaie au tour suivant */
          }
        }
        timer = window.setTimeout(tick, 180)
      }
      tick()
    })()

    return () => {
      alive = false
      window.clearTimeout(timer)
      stopCam()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="scanner" role="dialog" aria-modal="true" aria-label={t('scan.open')}>
      <div className="scanner-frame">
        <div className="scanner-stage">
          <video ref={video} playsInline muted autoPlay className="scanner-video" />
          <canvas ref={canvas} className="scanner-canvas" aria-hidden="true" />
          {etat === 'scan' && (
            <>
              <div className="scanner-guide" aria-hidden="true" />
              <p className="scanner-hint">{t('scan.aim')}</p>
            </>
          )}
          {etat !== 'scan' && (
            <div className="scanner-fallback">
              <b>{etat === 'refus' ? t('scan.cameraRefused') : t('scan.cameraError')}</b>
              <p>{detail ?? t('scan.useNative')}</p>
              {etat === 'refus' && <p className="micro">{t('scan.useNative')}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="scanner-actions">
        <Button wide onClick={onClose}>{t('scan.close')}</Button>
      </div>
    </div>
  )
}
