import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './fonts.css'
import './styles.css'

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
