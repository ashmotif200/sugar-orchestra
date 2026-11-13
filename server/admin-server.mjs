/**
 * Sugar Orchestra — Super Admin HTTP server.
 *
 * Serves the built SPA from dist/ and the admin API from /api. Binds to loopback
 * by default: an administration interface must not be reachable from the museum
 * LAN or the internet without an explicit decision and TLS in front of it.
 *
 *   node server/admin-server.mjs                 # 127.0.0.1:5182
 *   SO_HOST=0.0.0.0 SO_PORT=5200 node server/admin-server.mjs   # explicit only
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { handleApi, HttpError } from './api.mjs'
import { ROOT, db, seedFromBundle } from './db.mjs'

const HOST = process.env.SO_HOST ?? '127.0.0.1'
const PORT = Number(process.env.SO_PORT ?? 5182)
const DIST = join(ROOT, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
}

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  // The app is a local bundle: no third-party script, no eval. Inline styles are
  // used by React/Vite, so style-src keeps 'unsafe-inline'; scripts do not.
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
}

function serveStatic(req, res, url) {
  if (!existsSync(DIST)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('dist/ absent — lancez `npm run build` avant de démarrer le serveur admin.')
    return
  }
  const rel = decodeURIComponent(url.pathname)
  if (rel.includes('\0') || rel.includes('..')) {
    res.writeHead(400).end('bad path')
    return
  }
  let file = normalize(join(DIST, rel))
  if (!file.startsWith(DIST)) { res.writeHead(403).end('forbidden'); return }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  const st = statSync(file)
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'content-length': st.size,
    'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
  })
  createReadStream(file).pipe(res)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v)
      await handleApi(req, res, url)
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('method not allowed')
      return
    }
    serveStatic(req, res, url)
  } catch (err) {
    if (err instanceof HttpError) {
      if (!res.headersSent) {
        res.writeHead(err.status, { 'content-type': 'application/json; charset=utf-8' })
      }
      res.end(JSON.stringify({ error: err.message, detail: err.detail ?? null }))
      return
    }
    // Never leak a stack trace or server internals to the client.
    console.error('[admin] unhandled error:', err?.message ?? err)
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    }
    res.end(JSON.stringify({ error: 'erreur interne du serveur' }))
  }
})

db()
const seed = seedFromBundle()
server.listen(PORT, HOST, () => {
  console.log(`[admin] ${seed.seeded ? 'seeded from bundle' : 'database ready'} — listening on http://${HOST}:${PORT}`)
  console.log(`[admin] admin entry: http://${HOST}:${PORT}/#/admin`)
  if (!process.env.SO_ADMIN_PROVISIONED && db().prepare('SELECT COUNT(*) n FROM users').get().n === 0) {
    console.log('[admin] no accounts yet — run: npm run admin:provision')
  }
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(() => process.exit(0)) })
}
