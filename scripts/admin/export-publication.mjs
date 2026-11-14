#!/usr/bin/env node
/**
 * Exporte l'état de publication (univers + sons) depuis data/admin/sugar.db vers
 * src/data/publication.json.
 *
 * Pourquoi un export : la démo doit fonctionner sur un téléphone même si l'API
 * d'administration n'est pas joignable (réseau local incertain). L'application
 * tente d'abord l'API (`/api/v2/public/catalog-state`), puis retombe sur ce
 * fichier. Les deux sortent de la MÊME base : ce n'est pas une seconde source,
 * c'est un instantané de la première.
 */
import { DatabaseSync } from 'node:sqlite'
import { writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DB = process.env.SO_DATA_DIR
  ? resolve(process.env.SO_DATA_DIR, 'sugar.db')
  : resolve(ROOT, 'data/admin/sugar.db')
const OUT = resolve(ROOT, 'src/data/publication.json')

if (!existsSync(DB)) {
  console.error(`base absente : ${DB}`)
  process.exit(1)
}

const db = new DatabaseSync(DB)
const universes = db
  .prepare('SELECT id, status, engine_implemented FROM universes ORDER BY id')
  .all()
  .map((u) => ({ id: u.id, status: u.status, engineImplemented: Number(u.engine_implemented) === 1 }))
const sounds = db
  .prepare('SELECT code, status, availability FROM sounds ORDER BY code')
  .all()
  .map((s) => ({ code: s.code, status: s.status, availability: s.availability }))

const payload = {
  _doc:
    "Instantané de publication généré par scripts/admin/export-publication.mjs depuis data/admin/sugar.db. " +
    "Ne pas éditer à la main : relancer le script après un changement de statut dans l'administration.",
  generatedAt: new Date().toISOString(),
  universes,
  sounds,
}
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')

const counts = sounds.reduce((acc, s) => ((acc[s.status] = (acc[s.status] ?? 0) + 1), acc), {})
console.log(`écrit ${OUT}`)
console.log('univers :', universes.map((u) => `${u.id}=${u.status}${u.engineImplemented ? '+impl' : ''}`).join(' · '))
console.log('sons :', Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' · '))
