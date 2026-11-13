#!/usr/bin/env node
/**
 * Backup the Super Admin data: the SQLite database (consistent copy via VACUUM INTO)
 * plus the versioned audio files and published snapshots.
 *
 *   npm run admin:backup                 -> data/admin/backups/<timestamp>/
 *   npm run admin:backup -- --keep 5     -> prune older backups, keep 5
 *
 * Restoring is a documented manual step on purpose: an automatic restore that runs
 * unattended is how backups destroy live data.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { db, DATA_DIR, FILES_DIR, PUB_DIR } from '../../server/db.mjs'

const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def
}

const BACKUPS = join(DATA_DIR, 'backups')
const keep = Number(arg('keep', '10'))
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dir = join(BACKUPS, stamp)

mkdirSync(dir, { recursive: true })

// VACUUM INTO produces a consistent single-file copy even with WAL active.
const d = db()
const dbCopy = join(dir, 'sugar.db')
d.exec(`VACUUM INTO '${dbCopy.replace(/'/g, "''")}'`)

let files = 0
if (existsSync(FILES_DIR)) {
  cpSync(FILES_DIR, join(dir, 'files'), { recursive: true })
  const walk = (p) => readdirSync(p, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? walk(join(p, e.name)) : 1), 0)
  files = walk(FILES_DIR)
}
if (existsSync(PUB_DIR)) cpSync(PUB_DIR, join(dir, 'publications'), { recursive: true })

const size = (p) => readdirSync(p, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? size(join(p, e.name)) : statSync(join(p, e.name)).size), 0)

console.log(`backup: ${dir}`)
console.log(`  database: ${(statSync(dbCopy).size / 1024).toFixed(1)} KiB`)
console.log(`  audio versions: ${files} fichier(s)`)
console.log(`  total: ${(size(dir) / 1048576).toFixed(2)} MiB`)

if (Number.isFinite(keep) && keep > 0 && existsSync(BACKUPS)) {
  const all = readdirSync(BACKUPS).sort()
  const excess = all.slice(0, Math.max(0, all.length - keep))
  for (const old of excess) rmSync(join(BACKUPS, old), { recursive: true, force: true })
  if (excess.length) console.log(`  pruned ${excess.length} ancien(s) backup(s), ${keep} conservé(s)`)
}
