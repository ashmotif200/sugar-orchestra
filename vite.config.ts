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
  server: { port: 5180, host: '0.0.0.0' },
  preview: { port: 5181, host: '0.0.0.0' },
})
