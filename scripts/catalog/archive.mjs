#!/usr/bin/env node
/**
 * Archivage non destructif du catalogue historique.
 *
 *   node scripts/catalog/archive.mjs archive [--dir <chemin>] [--yes]
 *   node scripts/catalog/archive.mjs verify  [--dir <chemin>]
 *   node scripts/catalog/archive.mjs restore [--dir <chemin>] [--yes]
 *
 * L'archive est autonome : elle contient les originaux, les versions de diffusion,
 * le catalogue, la configuration des étapes et un export des tables concernées.
 * Rien n'est supprimé ni déplacé : les fichiers source restent en place.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { db, ROOT } from '../../server/db.mjs'

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d }
const flag = (n) => process.argv.includes(`--${n}`)
const cmd = process.argv[2]
const DIR = resolve(arg('dir', join(ROOT, 'data/archive/catalog-40')))

const sha256 = (p) => {
  const h = createHash('sha256')
  h.update(readFileSync(p))
  return h.digest('hex')
}

const ORIG = join(ROOT, 'assets/originals')
const PUB = join(ROOT, 'public/audio')

function doArchive() {
  if (existsSync(DIR) && readdirSync(DIR).length && !flag('force')) {
    console.error(`archive déjà présente : ${DIR}\nrelancez avec --force pour la régénérer.`)
    process.exit(1)
  }
  const d = db()
  const sounds = d.prepare('SELECT * FROM sounds ORDER BY id').all()
  const links = d.prepare('SELECT * FROM step_sounds ORDER BY step_id, position').all()
  const versions = d.prepare('SELECT * FROM sound_versions ORDER BY sound_id, version').all()
  const content = d.prepare('SELECT * FROM content ORDER BY id').all()
  const restrictions = d.prepare('SELECT * FROM restrictions ORDER BY sound_id').all()
  const steps = d.prepare('SELECT * FROM steps ORDER BY display_no').all()

  for (const sub of ['originals', 'diffusion', 'data']) mkdirSync(join(DIR, sub), { recursive: true })

  const manifest = {
    createdAt: new Date().toISOString(),
    kind: 'catalog-archive',
    note: 'Archive non destructive : les fichiers source restent en place. '
      + 'Les identifiants archivés ne doivent jamais être réattribués à d’autres sons.',
    counts: { sounds: sounds.length, stepLinks: links.length, versions: versions.length,
      content: content.length, restrictions: restrictions.length, steps: steps.length },
    files: [], missing: [],
  }

  const copy = (src, sub, role, soundId = null) => {
    if (!existsSync(src)) { manifest.missing.push({ role, path: relative(ROOT, src), soundId }); return }
    const dst = join(DIR, sub, src.split('/').pop())
    copyFileSync(src, dst)
    manifest.files.push({ role, soundId, name: src.split('/').pop(), bytes: statSync(dst).size, sha256: sha256(dst) })
  }

  for (const s of sounds) {
    copy(join(ORIG, `${s.id}.wav`), 'originals', 'original', s.id)
    copy(join(PUB, `${s.id}.m4a`), 'diffusion', 'diffusion', s.id)
  }
  for (const [src, name, role] of [
    [join(ROOT, 'src/data/catalog.json'), 'catalog.json', 'catalog'],
    [join(ROOT, 'config/steps.json'), 'steps.json', 'steps-config'],
  ]) {
    if (existsSync(src)) {
      copyFileSync(src, join(DIR, 'data', name))
      manifest.files.push({ role, soundId: null, name, bytes: statSync(join(DIR, 'data', name)).size, sha256: sha256(join(DIR, 'data', name)) })
    }
  }
  writeFileSync(join(DIR, 'data', 'db-export.json'), JSON.stringify(
    { exportedAt: manifest.createdAt, sounds, step_sounds: links, sound_versions: versions,
      content, restrictions, steps }, null, 2))

  writeFileSync(join(DIR, 'MANIFESTE.json'), JSON.stringify(manifest, null, 2))
  writeFileSync(join(DIR, 'SHA256SUMS.txt'),
    manifest.files.map((f) => `${f.sha256}  ${f.role}/${f.name}`).sort().join('\n') + '\n')

  const sum = manifest.files.reduce((n, f) => n + f.bytes, 0)
  console.log(`archive : ${DIR}`)
  console.log(`  ${manifest.files.length} fichiers · ${(sum / 1048576).toFixed(1)} Mo`)
  console.log(`  originaux ${manifest.files.filter((f) => f.role === 'original').length}/${sounds.length}`
    + ` · diffusion ${manifest.files.filter((f) => f.role === 'diffusion').length}`
    + ` · métadonnées ${manifest.counts.sounds} sons, ${manifest.counts.stepLinks} liens d'étape`)
  if (manifest.missing.length) console.log(`  MANQUANTS : ${manifest.missing.length} (voir MANIFESTE.json)`)
  console.log('  originaux et fichiers source inchangés.')
}

function doVerify() {
  const mPath = join(DIR, 'MANIFESTE.json')
  if (!existsSync(mPath)) { console.error(`aucune archive : ${DIR}`); process.exit(1) }
  const manifest = JSON.parse(readFileSync(mPath, 'utf8'))
  let ok = 0
  const bad = []
  for (const f of manifest.files) {
    const p = join(DIR, f.role.startsWith('catalog') || f.role === 'steps-config' ? 'data' : (f.role === 'original' ? 'originals' : 'diffusion'), f.name)
    if (!existsSync(p)) { bad.push(`${f.role}/${f.name} absent`); continue }
    if (sha256(p) === f.sha256) ok++
    else bad.push(`${f.role}/${f.name} empreinte différente`)
  }
  console.log(`vérification : ${ok}/${manifest.files.length} empreintes conformes`)
  if (bad.length) { bad.slice(0, 10).forEach((b) => console.log('  KO', b)); process.exit(1) }
  console.log(`  ${manifest.counts.sounds} sons · ${manifest.counts.stepLinks} associations d'étape · archive ${manifest.createdAt}`)
}

function doRestore() {
  if (!flag('yes')) {
    console.error('refusé : la restauration réécrit des fichiers du catalogue.')
    console.error('relancez avec --yes après vérification de l’archive.')
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(join(DIR, 'MANIFESTE.json'), 'utf8'))
  let restored = 0
  for (const f of manifest.files) {
    if (f.role !== 'original' && f.role !== 'diffusion') continue
    const dir = f.role === 'original' ? ORIG : PUB
    const dst = join(dir, f.name)
    if (existsSync(dst) && sha256(dst) === f.sha256) continue
    copyFileSync(join(DIR, f.role === 'original' ? 'originals' : 'diffusion', f.name), dst)
    restored++
  }
  console.log(`restauration : ${restored} fichier(s) réécrit(s) depuis l’archive`)
  console.log('  les lignes de base (sons, associations, contenus) n’ont pas été supprimées : '
    + 'elles sont dans data/db-export.json si un rétablissement complet est nécessaire.')
}

switch (cmd) {
  case 'archive': doArchive(); break
  case 'verify': doVerify(); break
  case 'restore': doRestore(); break
  default:
    console.log('usage : archive.mjs archive|verify|restore [--dir <chemin>] [--yes] [--force]')
    process.exit(1)
}
