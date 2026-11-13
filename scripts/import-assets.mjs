#!/usr/bin/env node
// Importe les assets réels du musée : Inventaire.csv + zip des 40 WAV.
//
//   npm run import-assets -- --zip "/chemin/Sons_sucre_40_pistes_20s.zip" \
//                             --inventory "/chemin/Inventaire.csv" \
//                             [--roles "/chemin/..." ] [--dry-run] [--keep-originals]
//
// Ce que fait le script :
//   1. vérifie chaque correspondance code -> fichier et signale toute anomalie ;
//   2. conserve les WAV originaux hors du dossier public (assets/originals) ;
//   3. produit des copies web compressées (AAC mono) dans public/audio/ ;
//   4. mesure chaque son (analyse acoustique réelle) et propose des rôles ;
//   5. réécrit src/data/catalog.json en conservant codes, crédits, licences ;
//   6. écrit un rapport de correspondance (assets/import-report.json) et
//      n'écrase le catalogue que si aucune erreur bloquante n'est détectée.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { basename, extname, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { readZip } from './lib/zip.mjs'
import { readWav } from './lib/wav.mjs'
import { analyzeSamples, suggestRoles } from './lib/analyze.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

/* ------------------------------------------------------------------ args -- */
const args = process.argv.slice(2)
const arg = (name, def = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def
}
const flag = (name) => args.includes(`--${name}`)

const zipPath = arg('zip')
const csvPath = arg('inventory') ?? arg('inventaire')
const rolesPath = arg('roles')
const dryRun = flag('dry-run')
const keepOriginals = !flag('no-originals')

if (!zipPath || !csvPath) {
  console.error('Usage: node scripts/import-assets.mjs --zip <fichier.zip> --inventory <Inventaire.csv> [--roles <roles.csv>] [--dry-run] [--no-originals]')
  process.exit(2)
}

/* ------------------------------------------------------------------- csv -- */
function parseCsv(text) {
  // détecte le séparateur sur la première ligne
  const firstLine = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : 200)
  const delim = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ','
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

const ALIASES = {
  code: ['code', 'id', 'identifiant', 'ref', 'reference', 'référence', 'code son', 'numero'],
  file: ['fichier', 'file', 'filename', 'nom fichier', 'nom_fichier', 'nom du fichier', 'wav', 'audio'],
  name: ['nom', 'name', 'titre', 'title', 'libelle', 'libellé', 'designation', 'désignation'],
  section: ['section', 'sequence', 'séquence', 'salle', 'station', 'zone', 'parcours'],
  credits: ['credits', 'crédits', 'credit', 'crédit', 'source', 'provenance', 'auteur', 'enregistre par', 'enregistré par'],
  license: ['licence', 'license', 'droits', 'rights', 'ayant droit'],
  notes: ['notes', 'note', 'remarque', 'remarques', 'commentaire', 'comment', 'description'],
  anecdote: ['anecdote', 'texte', 'histoire', 'texte court', 'cartel'],
  roles: ['roles', 'rôles', 'role', 'rôle', 'usage', 'fonction', 'proposition'],
  nature: ['nature', 'type', 'categorie', 'catégorie'],
}

const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const normKey = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim()

function mapHeader(header) {
  const fields = Object.entries(ALIASES)
  const map = {}
  const used = new Set()
  // 1) exact header names first (avoids "Nom du fichier" stealing "Code")
  header.forEach((raw, i) => {
    const k = normKey(raw)
    for (const [field, aliases] of fields) {
      if (map[field]) continue
      if (aliases.some((a) => normKey(a) === k)) { map[field] = raw; used.add(i); return }
    }
  })
  // 2) then substring matches, but only for aliases of 4+ characters
  header.forEach((raw, i) => {
    if (used.has(i)) return
    const k = normKey(raw)
    for (const [field, aliases] of fields) {
      if (map[field]) continue
      if (aliases.some((a) => normKey(a).length >= 4 && k.includes(normKey(a)))) { map[field] = raw; used.add(i); return }
    }
  })
  const unmatched = header.filter((_, i) => !used.has(i))
  return { map, unmatched }
}

const CULTURE_SECTIONS = [
  { id: 'origines', order: 1, name: "Origines de l'île", short: 'Origines' },
  { id: 'ages', order: 2, name: 'Sucre à travers les âges', short: 'Âges' },
  { id: 'cheminee', order: 3, name: "À l'ombre de la cheminée", short: 'Cheminée' },
  { id: 'histoire', order: 4, name: 'Une histoire façonnée par le sucre', short: 'Histoire' },
  { id: 'canne', order: 5, name: 'La canne', short: 'Canne' },
  { id: 'canne-au-sucre', order: 6, name: 'De la canne au sucre', short: 'Transformation' },
  { id: 'energie', order: 7, name: "L'énergie de la canne", short: 'Énergie' },
  { id: 'jus-au-sucre', order: 8, name: 'Du jus au sucre', short: 'Jus' },
]

const ROLE_ALIASES = {
  bass: ['bass', 'basse', 'grave', 'low'],
  melody: ['melody', 'melodie', 'mélodie', 'chant', 'lead', 'theme', 'thème'],
  rhythm: ['rhythm', 'rythme', 'rythmique', 'percussion', 'rythmique ', 'beat', 'groove'],
  earcandy: ['earcandy', 'ear candy', 'ear-candy', 'ornement', 'eclat', 'éclat', 'accent'],
  texture: ['texture', 'ambiance', 'ambient', 'nappe', 'drone', 'fond'],
}

const toRoleId = (v) => {
  const n = normKey(v)
  for (const [id, list] of Object.entries(ROLE_ALIASES)) {
    if (list.some((a) => normKey(a) === n || n.includes(normKey(a)))) return id
  }
  return null
}

const matchSection = (v) => {
  const n = normKey(v)
  if (!n) return null
  // l'inventaire réel utilise un numéro de séquence 1..8
  if (/^\d+$/.test(n)) {
    const idx = parseInt(n, 10) - 1
    if (idx >= 0 && idx < 8) return CULTURE_SECTIONS[idx].id
  }
  for (const s of CULTURE_SECTIONS) {
    if (normKey(s.name) === n || normKey(s.short) === n) return s.id
  }
  // tolérant : inclusion dans un sens ou l'autre + mots-clés
  const keywords = {
    origines: ['origine', 'ile', 'île'],
    ages: ['age', 'histoire du sucre', 'travers'],
    cheminee: ['cheminee', 'cheminée', 'fumee'],
    histoire: ['histoire faconnee', 'esclave', 'societe', 'société'],
    canne: ['canne', 'champ', 'plantation'],
    'canne-au-sucre': ['transformation', 'moulin', 'broyage', 'canne au sucre'],
    energie: ['energie', 'énergie', 'bagasse', 'chaudiere', 'chaudière', 'vapeur'],
    'jus-au-sucre': ['jus', 'cristallisation', 'cuisson', 'sucre roux'],
  }
  for (const [id, words] of Object.entries(keywords)) if (words.some((w) => n.includes(normKey(w)))) return id
  for (const s of CULTURE_SECTIONS) if (n.includes(normKey(s.short)) || normKey(s.name).includes(n)) return s.id
  return null
}

/* ------------------------------------------------------------------- run -- */
const report = {
  generatedAt: new Date().toISOString(),
  zip: basename(zipPath),
  inventory: basename(csvPath),
  counts: { rows: 0, matched: 0, missingFiles: 0, duplicates: 0, unmappedColumns: 0 },
  missingFiles: [],
  duplicateCodes: [],
  unmatchedSections: [],
  unmatchedColumns: [],
  codes: [],
  warnings: [],
  errors: [],
}

const zip = readZip(readFileSync(zipPath))
const wavEntries = zip.names.filter((n) => /\.wav$/i.test(n) && !n.startsWith('__MACOSX'))
const wavByBase = new Map(wavEntries.map((n) => [normKey(basename(n, extname(n))), n]))

const rows = parseCsv(readFileSync(csvPath, 'utf8'))
if (!rows.length) { console.error('Inventaire vide'); process.exit(1) }
const { map, unmatched } = mapHeader(rows[0])
report.unmatchedColumns = unmatched
report.counts.unmappedColumns = unmatched.length
if (!map.code) { console.error('Colonne "code" introuvable dans l\'inventaire. En-têtes vus :', rows[0].join(' | ')); process.exit(1) }
if (!map.file) { console.error('Colonne "fichier" introuvable dans l\'inventaire. En-têtes vus :', rows[0].join(' | ')); process.exit(1) }

const rolesOverrides = new Map()
if (rolesPath && existsSync(rolesPath)) {
  const rr = parseCsv(readFileSync(rolesPath, 'utf8'))
  const h = rr[0].map(normKey)
  const ci = h.findIndex((x) => x.includes('code'))
  const ri = h.findIndex((x) => x.includes('role') || x.includes('rôle'))
  for (const r of rr.slice(1)) {
    if (ci >= 0 && ri >= 0 && r[ci]) rolesOverrides.set(normKey(r[ci]), r[ri])
  }
}

const outAudio = join(ROOT, 'public', 'audio')
const outOriginals = join(ROOT, 'assets', 'originals')
const outCatalog = join(ROOT, 'src', 'data', 'catalog.json')
if (!dryRun) { mkdirSync(outAudio, { recursive: true }); if (keepOriginals) mkdirSync(outOriginals, { recursive: true }) }

const tmp = join(tmpdir(), `sugar-import-${Date.now()}`)
mkdirSync(tmp, { recursive: true })

const idx = (row, key) => (map[key] ? row[rows[0].indexOf(map[key])] ?? '' : '')
const sounds = []
const seen = new Set()
let extraSections = 0
const extraSectionMap = new Map()

for (const row of rows.slice(1)) {
  report.counts.rows++
  const code = idx(row, 'code').trim()
  const fileField = idx(row, 'file').trim()
  if (!code && !fileField) continue
  if (seen.has(normKey(code))) { report.duplicateCodes.push(code); report.counts.duplicates++; continue }
  seen.add(normKey(code))

  const wanted = normKey(basename(fileField, extname(fileField)))
  const entry = wavByBase.get(wanted) ?? wavByBase.get(normKey(code)) ?? null
  if (!entry) {
    report.missingFiles.push({ code, file: fileField })
    report.counts.missingFiles++
    continue
  }

  const safeCode = code.replace(/[^A-Za-z0-9._-]+/g, '_') || `son-${report.counts.rows}`
  const tmpWav = join(tmp, `${safeCode}.wav`)
  writeFileSync(tmpWav, zip.read(entry))

  // analyse sur un PCM mono 32 kHz (format de référence du brief)
  const tmpPcm = join(tmp, `${safeCode}.pcm.wav`)
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmpWav, '-ac', '1', '-ar', '32000', '-c:a', 'pcm_s16le', tmpPcm])
  const { samples, sampleRate } = readWav(readFileSync(tmpPcm))
  const analysis = analyzeSamples(samples, sampleRate)

  if (!dryRun) {
    if (keepOriginals) writeFileSync(join(outOriginals, `${safeCode}.wav`), readFileSync(tmpWav))
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmpWav, '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '112k', join(outAudio, `${safeCode}.m4a`)])
  }

  const sectionRaw = idx(row, 'section')
  let section = matchSection(sectionRaw)
  if (!section) {
    if (sectionRaw.trim()) {
      const key = normKey(sectionRaw)
      if (!extraSectionMap.has(key)) {
        extraSections++
        extraSectionMap.set(key, `hors-parcours-${extraSections}`)
        CULTURE_SECTIONS.push({ id: extraSectionMap.get(key), order: 90 + extraSections, name: sectionRaw.trim(), short: sectionRaw.trim().slice(0, 18) })
      }
      section = extraSectionMap.get(key)
      report.unmatchedSections.push(sectionRaw)
    } else {
      section = 'histoire'
      report.warnings.push(`${code}: aucune section indiquée, classé dans « ${CULTURE_SECTIONS[3].name} »`)
    }
  }

  const { picked } = suggestRoles(analysis)
  const rolesFromCsv = (rolesOverrides.get(normKey(code)) ?? idx(row, 'roles') ?? '')
    .split(/[;,/|]/)
    .map(toRoleId)
    .filter(Boolean)
  const roles = rolesFromCsv.length ? [...new Set(rolesFromCsv)] : picked

  const insensitive = /fouet|cha[iî]ne|fers?_|esclav|ayo/.test(normKey(`${idx(row, 'name')} ${idx(row, 'nature')} ${fileField}`))
  const validateFlag = /valider|maquette/i.test(normKey(idx(row, 'nature')))
  const anecdoteText = idx(row, 'anecdote').trim()
  sounds.push({
    id: safeCode.toLowerCase(),
    code,
    name: idx(row, 'name').trim() || basename(fileField, extname(fileField)),
    file: `audio/${safeCode}.m4a`,
    section,
    roles,
    suggestedRoles: picked,
    credits: idx(row, 'credits').trim() || 'Crédits à compléter depuis l’inventaire',
    license: idx(row, 'license').trim() || 'Licence à confirmer',
    status: 'imported',
    anecdote: anecdoteText
      ? { text: anecdoteText, status: 'placeholder' }
      : { text: 'Texte en attente de validation par l’équipe du musée.', status: 'placeholder' },
    notes: idx(row, 'notes').trim(),
    nature: idx(row, 'nature').trim(),
    sensitive: insensitive,
    needsValidation: validateFlag,
    inDemoSet: false,
    analysis,
  })
  report.counts.matched++
  report.codes.push({ code, file: entry, section, roles, f0: analysis.f0Hz, onsetRate: analysis.onsetRate, centroid: analysis.centroidHz })
}

const unusedWavs = wavEntries.filter((n) => !report.codes.some((c) => c.file === n))
if (unusedWavs.length) report.warnings.push(`${unusedWavs.length} WAV du zip ne sont référencés par aucune ligne de l'inventaire : ${unusedWavs.slice(0, 8).join(', ')}${unusedWavs.length > 8 ? '…' : ''}`)

rmSync(tmp, { recursive: true, force: true })

const blocking = report.counts.matched === 0 || report.counts.missingFiles > report.counts.matched
if (blocking) report.errors.push('Trop de fichiers manquants pour construire un catalogue fiable.')
if (sounds.length < 4) report.errors.push(`Seulement ${sounds.length} son(s) exploitable(s) : la démo demande au moins 4 sons.`)

/* ---- sélection de démonstration (8 à 12 sons, cf. brief §5) ---------------
   Si config/demo-set.json existe, il fait foi : la curation est explicite,
   auditable et éditable à la main. Sinon, sélection automatique de secours.
   Les 40 sons restent au catalogue ; seuls les retenus sont collectables. */
const MAX_DEMO = 12
const curatedPath = join(ROOT, 'config', 'demo-set.json')
let demo = []
if (existsSync(curatedPath)) {
  const curated = JSON.parse(readFileSync(curatedPath, 'utf8'))
  for (const entry of curated.codes || []) {
    const s = sounds.find((x) => x.code === entry.code)
    if (!s) { report.warnings.push(`demo-set: code inconnu ${entry.code}`); continue }
    if (s.sensitive || s.needsValidation) { report.warnings.push(`demo-set: ${entry.code} écarté (sensible ou à valider)`); continue }
    if (Array.isArray(entry.roles) && entry.roles.length) s.curatedRoles = entry.roles
    if (entry.name) s.curatedName = entry.name
    demo.push(s)
  }
  report.demoSource = 'config/demo-set.json'
} else {
  const roleOrder = ['bass', 'melody', 'rhythm', 'earcandy', 'texture']
  const usedSections = new Map()
  const candidates = sounds
    .filter((s) => !s.sensitive && !s.needsValidation)
    .sort((a, b) => b.analysis.onsetRate - a.analysis.onsetRate)
  for (const role of roleOrder) {
    const pick = candidates.find((s) => !demo.includes(s) && s.roles.includes(role) && !usedSections.has(s.section))
    if (pick) { demo.push(pick); usedSections.set(pick.section, 1) }
  }
  for (const s of candidates) {
    if (demo.length >= MAX_DEMO) break
    if (demo.includes(s)) continue
    if ((usedSections.get(s.section) ?? 0) >= 3) continue
    demo.push(s)
    usedSections.set(s.section, (usedSections.get(s.section) ?? 0) + 1)
  }
  report.demoSource = 'auto'
}
for (const s of demo) {
  s.inDemoSet = true
  if (s.curatedRoles) s.roles = s.curatedRoles
  if (s.curatedName) s.name = s.curatedName
}
report.demoSet = demo.map((s) => ({ code: s.code, name: s.name, section: s.section, roles: s.roles, f0: s.analysis.f0Hz }))
report.counts.demoSet = demo.length
report.counts.sensitive = sounds.filter((s) => s.sensitive).length
report.counts.needsValidation = sounds.filter((s) => s.needsValidation).length
report.sensitiveCodes = sounds.filter((s) => s.sensitive).map((s) => ({ code: s.code, name: s.name }))

const catalog = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'imported',
  limits: { minSelected: 4, maxSelected: 6 },
  sections: CULTURE_SECTIONS,
  demoSet: demo.map((s) => s.id),
  sounds,
}

mkdirSync(join(ROOT, 'assets'), { recursive: true })
writeFileSync(join(ROOT, 'assets', 'import-report.json'), JSON.stringify(report, null, 2))

if (dryRun) {
  console.log('DRY RUN — aucun fichier écrit.')
  console.log(JSON.stringify(report.counts, null, 2))
  if (report.missingFiles.length) console.log('Fichiers non trouvés :', report.missingFiles.map((m) => `${m.code}→${m.file}`).join(', '))
  process.exit(report.errors.length ? 1 : 0)
}

if (report.errors.length) {
  console.error('Import interrompu — le catalogue existant est conservé :')
  for (const e of report.errors) console.error('  ✗', e)
  console.error('Rapport complet : assets/import-report.json')
  process.exit(1)
}

writeFileSync(outCatalog, JSON.stringify(catalog, null, 2))
console.log(`✓ ${sounds.length} sons importés (${report.counts.missingFiles} manquants, ${report.counts.duplicates} doublons)`)
console.log(`✓ catalogue → src/data/catalog.json`)
console.log(`✓ rapport  → assets/import-report.json`)
if (report.unmatchedSections.length) console.log(`⚠ sections non reconnues : ${[...new Set(report.unmatchedSections)].join(', ')}`)
console.log('→ relancer `npm run build` puis vérifier /?selftest=1')
