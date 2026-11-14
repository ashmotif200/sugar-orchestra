import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base: the build works both from a local file server at "/"
// and from a GitHub Pages sub-path (/sugar-orchestra/) without rebuild tweaks.
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
    proxy: { '/api': { target: 'http://127.0.0.1:5182', changeOrigin: false } },
  },
  preview: {
    port: 5181,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: ['hermes.tail6111a5.ts.net'],
    proxy: { '/api': { target: 'http://127.0.0.1:5182', changeOrigin: false } },
  },
})
