#!/usr/bin/env node
/**
 * Apply a published snapshot to the bundle the visitor app imports.
 *
 * This is the only command that changes what a visitor sees, and it is deliberately
 * separate from publishing: publishing writes a snapshot, applying touches the
 * source tree. Running it requires an explicit flag and a note.
 *
 *   npm run admin:apply -- --from 3 --yes --note "muséomix 14/11"
 *
 * It backs up the current files into data/admin/applied-backups/ first.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { db, DATA_DIR, PUB_DIR, ROOT } from '../../server/db.mjs'

const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const flag = (name) => process.argv.includes(`--${name}`)

if (!flag('yes')) {
  console.error('refusé : cette commande modifie les données lues par les visiteurs.')
  console.error('relancez avec --yes --note "<raison>" une fois la publication validée par le propriétaire du projet.')
  process.exit(1)
}

const d = db()
const from = arg('from')
const pub = from
  ? d.prepare('SELECT * FROM publications WHERE id=?').get(Number(from))
  : d.prepare('SELECT * FROM publications ORDER BY id DESC LIMIT 1').get()

if (!pub) {
  console.error('aucune publication à appliquer. Lancez d’abord la publication depuis /admin/content ou l’API.')
  process.exit(1)
}
if (!existsSync(pub.dir)) {
  console.error(`répertoire de publication introuvable: ${pub.dir}`)
  process.exit(1)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = join(DATA_DIR, 'applied-backups', stamp)
mkdirSync(backupDir, { recursive: true })

const targets = [
  { src: join(pub.dir, 'catalog.json'), dst: join(ROOT, 'src', 'data', 'catalog.json') },
  { src: join(pub.dir, 'steps.json'), dst: join(ROOT, 'config', 'steps.json') },
]

for (const t of targets) {
  if (!existsSync(t.src)) { console.error(`snapshot incomplet: ${t.src}`); process.exit(1) }
  if (existsSync(t.dst)) copyFileSync(t.dst, join(backupDir, t.dst.split('/').pop()))
}

for (const t of targets) copyFileSync(t.src, t.dst)

const catalog = JSON.parse(readFileSync(targets[0].dst, 'utf8'))
writeFileSync(join(backupDir, 'APPLIED.json'), JSON.stringify({
  at: new Date().toISOString(), publication: pub.id, note: arg('note', null),
  catalogVersion: catalog.version, sounds: catalog.sounds?.length,
}, null, 2))

d.prepare(`INSERT INTO audit_log (at, actor_id, actor_email, action, entity, entity_id, detail)
           VALUES (?,?,?,?,?,?,?)`)
  .run(new Date().toISOString(), null, 'cli', 'publication.apply', 'publication', String(pub.id),
    JSON.stringify({ note: arg('note', null), backup: backupDir.replace(`${ROOT}/`, '') }))

console.log(`publication ${pub.id} appliquée au bundle visiteur.`)
console.log(`  src/data/catalog.json : ${catalog.sounds?.length ?? 0} sons`)
console.log(`  sauvegarde de l’état précédent : ${backupDir.replace(`${ROOT}/`, '')}`)
console.log('  pensez à relancer `npm run build` pour que la version servie change.')
console.log(`  snapshots disponibles : ${readdirSync(PUB_DIR).length}`)
