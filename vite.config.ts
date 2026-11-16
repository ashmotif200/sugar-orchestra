import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base: the build works both from a local file server at "/"
// and from a GitHub Pages sub-path (/sugar-orchestra/) without rebuild tweaks.
//
// Two build modes:
//   npm run build        → served behind the admin API (dev, preview, Super Admin)
//   npm run build:pages  → static hosting (VITE_STATIC_HOSTING=1): the visitor app
//                          reads bundled snapshots and no /api request is attempted.
//
// `allowedHosts` is the only machine-specific setting. It is read from
// SO_ALLOWED_HOSTS (comma-separated) so a fresh clone does not carry someone
// else's hostname: unset means "no extra host", which is the right default.
const allowedHosts = (process.env.SO_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  // The admin API runs on its own loopback-only server (server/admin-server.mjs).
  // Proxying /api in dev and preview keeps the browser same-origin, so the session
  // cookie stays SameSite=Strict and no CORS relaxation is needed.
  server: {
    port: 5180,
    strictPort: true,
    host: '0.0.0.0',
    ...(allowedHosts.length ? { allowedHosts } : {}),
    proxy: { '/api': { target: 'http://127.0.0.1:5182', changeOrigin: false } },
  },
  preview: {
    port: 5181,
    strictPort: true,
    host: '0.0.0.0',
    ...(allowedHosts.length ? { allowedHosts } : {}),
    proxy: { '/api': { target: 'http://127.0.0.1:5182', changeOrigin: false } },
  },
})
