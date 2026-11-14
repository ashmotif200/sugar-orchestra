#!/usr/bin/env node
/**
 * Fait pointer les huit sons de la démo vers leurs fichiers 5 s fournis.
 *
 * Ne touche à rien d'autre : identifiants, titres, crédits, licences, sections et
 * provenances sont conservés. L'ancien chemin est mémorisé dans `originalFile`
 * pour pouvoir revenir en arrière (`--restore`).
 *
 *   node scripts/catalog/use-demo-audio.mjs [--restore]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CATALOG = resolve(ROOT, 'src/data/catalog.json')
const CODES = ['01_02', '01_05', '02_01', '02_04', '04_07', '04_09', '04_10', '06_04']
const restore = process.argv.includes('--restore')

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))
let changed = 0
for (const s of catalog.sounds) {
  if (!CODES.includes(s.code)) continue
  if (restore) {
    if (s.originalFile) { s.file = s.originalFile; delete s.originalFile; changed++ }
  } else {
    const target = `audio/demo/${s.code}.wav`
    if (s.file !== target) {
      s.originalFile = s.originalFile ?? s.file
      s.file = target
      changed++
    }
  }
}
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n')
console.log(`${restore ? 'restauré' : 'mis à jour'} : ${changed} son(s)`)
for (const s of catalog.sounds.filter((x) => CODES.includes(x.code))) {
  console.log(` ${s.code} → ${s.file}`)
}
