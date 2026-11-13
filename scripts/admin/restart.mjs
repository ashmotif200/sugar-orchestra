#!/usr/bin/env node
/**
 * Redémarrage fiable du serveur Super Admin.
 *
 * Pourquoi ce script existe : `kill <pid du wrapper bash>` laisse l'enfant `node`
 * vivant sur le port. La nouvelle instance échoue alors en EADDRINUSE — souvent
 * silencieusement, puisque l'ancienne continue de répondre. On a ainsi servi des
 * routes inexistantes pendant trois « redémarrages » successifs.
 *
 * Ce script identifie le processus qui TIENT le port (pas le shell), l'arrête,
 * attend la libération réelle du port, démarre, puis attend /api/health.
 *
 *   node scripts/admin/restart.mjs [--port 5182] [--no-start]
 */
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { openSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d }
const PORT = Number(arg('port', process.env.ADMIN_PORT ?? 5182))
const NO_START = process.argv.includes('--no-start')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * PIDs du serveur admin.
 *
 * `ss` n'est PAS installé sur cette machine : une première version de ce script
 * l'appelait, obtenait une liste vide en silence, et ne tuait donc rien — le
 * nouveau processus échouait en EADDRINUSE pendant que l'ancien continuait de
 * répondre. On lit /proc directement, ce qui ne dépend d'aucun outil.
 */
function listeners(port) {
  const pids = []
  let dirs = []
  try {
    dirs = readdirSync('/proc').filter((d) => /^\d+$/.test(d))
  } catch {
    return []
  }
  for (const d of dirs) {
    try {
      const cmd = readFileSync(`/proc/${d}/cmdline`, 'utf8').split('\0').join(' ')
      if (!cmd.includes('admin-server.mjs')) continue
      const env = readFileSync(`/proc/${d}/environ`, 'utf8')
      const m = /(?:^|\0)ADMIN_PORT=(\d+)/.exec(env)
      const envPort = m ? Number(m[1]) : 5182
      if (envPort === port) pids.push(Number(d))
    } catch { /* processus disparu entre-temps */ }
  }
  return pids
}

async function healthy(port, timeoutMs = 8000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (r.ok) return await r.json()
    } catch { /* pas encore prêt */ }
    await sleep(150)
  }
  return null
}

async function main() {
  const before = listeners(PORT)
  if (before.length) {
    console.log(`port ${PORT} tenu par ${before.join(', ')} — arrêt`)
    for (const pid of before) { try { process.kill(pid, 'SIGTERM') } catch { /* déjà mort */ } }
    for (let i = 0; i < 40 && listeners(PORT).length; i++) await sleep(100)
    const still = listeners(PORT)
    if (still.length) {
      console.log(`toujours vivant (${still.join(', ')}) — SIGKILL`)
      for (const pid of still) { try { process.kill(pid, 'SIGKILL') } catch { /* ignore */ } }
      for (let i = 0; i < 40 && listeners(PORT).length; i++) await sleep(100)
    }
    if (listeners(PORT).length) {
      console.error(`échec : le port ${PORT} reste occupé`)
      process.exit(1)
    }
  } else {
    console.log(`port ${PORT} libre`)
  }

  if (NO_START) return

  const log = openSync('/tmp/admin.log', 'w')
  const child = spawn(process.execPath, [join(ROOT, 'server/admin-server.mjs')], {
    cwd: ROOT, detached: true, stdio: ['ignore', log, log],
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  })
  child.unref()
  console.log(`démarré pid ${child.pid}`)

  const health = await healthy(PORT)
  if (!health) {
    console.error('échec : /api/health ne répond pas — voir /tmp/admin.log')
    process.exit(1)
  }
  // preuve que la NOUVELLE instance répond : on vérifie une route récente
  const probe = await fetch(`http://127.0.0.1:${PORT}/api/v2/public/content?locale=fr`)
    .then((r) => r.status).catch(() => 0)
  console.log(`health ok · sonde /api/v2/public/content → HTTP ${probe}`)
  console.log(`pid à l'écoute : ${listeners(PORT).join(', ')}`)
}

main().catch((e) => { console.error('échec:', e.message); process.exit(1) })
