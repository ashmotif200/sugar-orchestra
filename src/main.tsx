import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { audio } from './audio/service'
import './fonts.css'
import './styles.css'
import './scanner.css'

// ---------------------------------------------------------------------------
// Déblocage de la sortie audio au premier geste.
//
// Safari iOS (et Chrome en politique stricte) n'autorise un AudioContext à
// produire du son que s'il a été créé ou repris DANS un geste utilisateur. Créer
// le contexte au montage d'un écran puis tenter `resume()` plus tard, à travers
// une chaîne de promesses, laisse le contexte muet sans lever la moindre erreur :
// l'interface annonçait « Arrêter » alors qu'aucun échantillon n'était joué.
//
// On débloque donc au tout premier contact, avant tout `await`, et on garde
// l'écouteur tant que le contexte n'est pas réellement `running`.
// ---------------------------------------------------------------------------
const unlockAudio = () => {
  audio.unlock()
  if (audio.isRunning()) {
    window.removeEventListener('pointerdown', unlockAudio, true)
    window.removeEventListener('touchend', unlockAudio, true)
    window.removeEventListener('keydown', unlockAudio, true)
  }
}
window.addEventListener('pointerdown', unlockAudio, true)
window.addEventListener('touchend', unlockAudio, true)
window.addEventListener('keydown', unlockAudio, true)

// dev diagnostic: keep uncaught errors readable from the browser console
;(window as unknown as { __sugarErrors: string[] }).__sugarErrors = []
window.addEventListener('error', (e) => {
  ;(window as unknown as { __sugarErrors: string[] }).__sugarErrors.push(String(e.error?.stack || e.message))
})
window.addEventListener('unhandledrejection', (e) => {
  ;(window as unknown as { __sugarErrors: string[] }).__sugarErrors.push('unhandled: ' + String((e.reason as Error)?.stack || e.reason))
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
