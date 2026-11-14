#!/usr/bin/env node
/**
 * Import des 8 nouveaux samples du musée.
 *
 *   node scripts/catalog/import-samples.mjs --template
 *   node scripts/catalog/import-samples.mjs --manifest <fichier> [--dry-run|--yes]
 *
 * Trois niveaux conservés séparément :
 *   1. original brut  -> assets/originals/<id>.wav   (copié, jamais transformé)
 *   2. version de diffusion -> public/audio/<id>.m4a (ffmpeg, pour le navigateur)
 *   3. métadonnées -> base (sons, associations d'étape, contenu brouillon)
 *
 * Ne supprime rien, ne remplace aucun son existant, ne publie rien.
 * Les sons importés entrent en statut « draft » : ils n'apparaissent au visiteur
 * qu'après une publication explicite.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { db, ROOT, nowIso } from '../../server/db.mjs'

const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d }
const flag = (n) => process.argv.includes(`--${n}`)
const ORIG = join(ROOT, 'assets/originals')
const PUB = join(ROOT, 'public/audio')
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')

const TEMPLATE = {
  note: 'Remplissez un objet par fichier. Les identifiants 90_01 à 90_08 sont réservés à la démo : '
    + 'ils ne réutilisent aucun identifiant historique (01_01…08_03).',
  samples: Array.from({ length: 8 }, (_, i) => ({
    id: `90_0${i + 1}`,
    file: `/chemin/vers/fichier_${i + 1}.wav`,
    name: '',
    stepId: null,
    description: '',
    source: '',
    author: '',
    license: '',
    sensitive: false,
  })),
}

if (flag('template')) {
  const out = join(ROOT, 'scripts/catalog/import-8-samples.template.json')
  writeFileSync(out, JSON.stringify(TEMPLATE, null, 2))
  console.log(`modèle écrit : ${out}`)
  console.log('remplacez les chemins et les métadonnées, puis relancez sans --template.')
  process.exit(0)
}

const manifestPath = arg('manifest')
if (!manifestPath) {
  console.error('usage : import-samples.mjs --template | --manifest <fichier> [--dry-run|--yes]')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const samples = manifest.samples ?? []
const execute = flag('yes') && !flag('dry-run')

if (samples.length !== 8) {
  console.error(`le manifeste doit décrire 8 samples, il en contient ${samples.length}.`)
  process.exit(1)
}

const d = db()
const existing = new Set(d.prepare('SELECT id FROM sounds').all().map((r) => r.id))
const errors = []
const plan = []

for (const s of samples) {
  if (!/^\d{2}_\d{2}$/.test(s.id ?? '')) errors.push(`${s.id}: identifiant au format NN_NN attendu`)
  else if (existing.has(s.id)) errors.push(`${s.id}: identifiant déjà utilisé — ne jamais réattribuer un identifiant historique`)
  if (!s.file || !existsSync(s.file)) errors.push(`${s.id}: fichier introuvable (${s.file})`)
  if (!s.name) errors.push(`${s.id}: nom affiché manquant`)
  if (!s.license) errors.push(`${s.id}: licence manquante (à renseigner, jamais à supposer)`)
  if (s.stepId != null && !d.prepare('SELECT 1 FROM steps WHERE id=?').get(s.stepId)) {
    errors.push(`${s.id}: étape ${s.stepId} inexistante`)
  }
  if (s.file && existsSync(s.file)) {
    const hash = sha256(s.file)
    const dup = d.prepare('SELECT id FROM sound_versions WHERE sha256=?').get(hash)
    if (dup) errors.push(`${s.id}: fichier identique à ${dup.id} déjà importé`)
    plan.push({ ...s, sha256: hash, bytes: statSync(s.file).size, duration: null })
  }
}

if (errors.length) {
  console.error('import refusé :')
  errors.forEach((e) => console.error('  -', e))
  process.exit(1)
}

if (!execute) {
  console.log('mode simulation (aucune écriture) — relancez avec --yes pour importer')
  for (const p of plan) console.log(`  ${p.id}  ${p.name}  étape ${p.stepId ?? '—'}  ${(p.bytes / 1048576).toFixed(2)} Mo  ${p.sha256.slice(0, 12)}…`)
  process.exit(0)
}

mkdirSync(ORIG, { recursive: true })
mkdirSync(PUB, { recursive: true })
const at = nowIso()
const report = []

for (const p of plan) {
  const origDst = join(ORIG, `${p.id}.wav`)
  if (existsSync(origDst)) throw new Error(`${origDst} existe déjà — import interrompu, rien n’est écrasé`)
  copyFileSync(p.file, origDst)
  if (sha256(origDst) !== p.sha256) throw new Error(`${p.id}: copie corrompue`)

  // version de diffusion : même traitement que les 40 sons historiques (AAC 96 kbps mono)
  const m4aDst = join(PUB, `${p.id}.m4a`)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', origDst, '-ac', '1', '-c:a', 'aac', '-b:a', '96k', m4aDst])
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration:stream=sample_rate,channels', '-of', 'json', origDst], { encoding: 'utf8' }))
  const duration = Number(probe.format?.duration ?? 0)

  d.prepare(`INSERT INTO sounds (id, code, name, step_id, duration_s, status, availability,
              sensitive, license, credits, nature, source, file, version, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(p.id, p.id, p.name, p.stepId, duration, 'draft', 'available', p.sensitive ? 1 : 0,
      p.license, p.author ?? null, 'museum', p.source ?? null, `audio/${p.id}.m4a`, 1, at, at)

  d.prepare(`INSERT INTO sound_versions (sound_id, version, file_path, sha256, bytes, created_at)
             VALUES (?,?,?,?,?,?)`)
    .run(p.id, 1, origDst, p.sha256, p.bytes, at)

  if (p.stepId != null) {
    const pos = (d.prepare('SELECT COALESCE(MAX(position),0)+1 n FROM step_sounds WHERE step_id=?').get(p.stepId).n)
    d.prepare('INSERT INTO step_sounds (step_id, sound_id, position) VALUES (?,?,?)').run(p.stepId, p.id, pos)
  }
  d.prepare(`INSERT INTO restrictions (sound_id, sensitive, availability, note, updated_at)
             VALUES (?,?,?,?,?)`)
    .run(p.id, p.sensitive ? 1 : 0, 'available', 'import démo 8 sons', at)

  if (p.description) {
    d.prepare(`INSERT INTO content (id, sound_id, locale, title, short_desc, story, status, version, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(`${p.id}:fr`, p.id, 'fr', p.name, null, p.description, 'draft', 1, at)
  }

  report.push({ id: p.id, name: p.name, stepId: p.stepId, duration: Number(duration.toFixed(2)),
    original: origDst.replace(`${ROOT}/`, ''), diffusion: m4aDst.replace(`${ROOT}/`, ''), sha256: p.sha256 })
  console.log(`  importé ${p.id} · ${p.name} · ${duration.toFixed(1)} s · étape ${p.stepId ?? '—'}`)
}

writeFileSync(join(ROOT, 'data/archive/import-8-samples-report.json'),
  JSON.stringify({ at, count: report.length, note: 'sons en statut draft — non visibles avant publication', samples: report }, null, 2))
console.log(`\n${report.length} samples importés en brouillon. Le catalogue publié n’a pas changé.`)
console.log('prochaine étape : vérifier les 8 fichiers, répartir les étapes, puis publier explicitement.')
