#!/usr/bin/env node
/**
 * Démo v0.1 — activation des huit samples de la démonstration.
 *
 * Source de vérité : la table `sounds` de data/admin/sugar.db (la même que
 * l'administration). Aucune seconde liste n'est créée : on change le statut de
 * publication, et le parcours visiteur le lit.
 *
 *   node scripts/admin/demo-samples.mjs            # publie les 8, verrouille les autres
 *   node scripts/admin/demo-samples.mjs --restore  # remet tout en 'active'
 *   node scripts/admin/demo-samples.mjs --dry-run  # affiche le diff sans écrire
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DB = process.env.SO_DATA_DIR
  ? resolve(process.env.SO_DATA_DIR, 'sugar.db')
  : resolve(ROOT, 'data/admin/sugar.db')

/** Les huit codes de la démo v0.1. Les autres sons restent au catalogue. */
export const DEMO_CODES = ['01_02', '01_05', '02_01', '02_04', '04_07', '04_09', '04_10', '06_04']

const restore = process.argv.includes('--restore')
const dryRun = process.argv.includes('--dry-run')

if (!existsSync(DB)) {
  console.error(`base absente : ${DB}`)
  process.exit(1)
}

const db = new DatabaseSync(DB)
const rows = db.prepare('SELECT id, code, status FROM sounds ORDER BY code').all()
const missing = DEMO_CODES.filter((c) => !rows.some((r) => r.code === c))
if (missing.length) {
  console.error(`codes absents du catalogue : ${missing.join(', ')}`)
  process.exit(1)
}

const setStatus = db.prepare("UPDATE sounds SET status = ?, updated_at = ? WHERE code = ?")
const now = new Date().toISOString()
let published = 0
let drafted = 0

db.exec('BEGIN')
try {
  for (const r of rows) {
    const want = restore ? 'active' : DEMO_CODES.includes(r.code) ? 'published' : 'draft'
    if (r.status !== want) {
      if (!dryRun) setStatus.run(want, now, r.code)
      if (want === 'published') published++
      else if (want === 'draft') drafted++
    }
  }
  db.exec(dryRun ? 'ROLLBACK' : 'COMMIT')
} catch (e) {
  db.exec('ROLLBACK')
  throw e
}

if (dryRun) {
  console.log(`[dry-run] ${published} son(s) à publier, ${drafted} à verrouiller`)
} else {
  const stats = db.prepare('SELECT status, COUNT(*) n FROM sounds GROUP BY status').all()
  console.log(`mis à jour : ${published} publié(s), ${drafted} verrouillé(s)`)
  console.log('état :', stats.map((s) => `${s.status}=${s.n}`).join(' · '))
  console.log(`actifs : ${DEMO_CODES.join(', ')}`)
}
