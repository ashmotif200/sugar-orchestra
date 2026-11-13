/**
 * Sugar Orchestra — Super Admin persistence layer.
 *
 * Zero external dependencies: Node 22's built-in `node:sqlite` (SQLite 3.51,
 * WAL, foreign keys ON). Chosen over better-sqlite3 because the project must not
 * grow a native-module build step for a prototype, and over a JSON file store
 * because versioning + audit + rollback want real transactions.
 *
 * Data layout on disk (outside the source tree, gitignored):
 *   data/admin/sugar.db          the database
 *   data/admin/files/<sound>/v<N>-<sha8>.<ext>   every uploaded audio version
 *   data/admin/publications/pub-<n>/             published snapshots
 *
 * The visitor app keeps reading its bundled src/data/catalog.json. Publication
 * here produces an explicit snapshot; applying it to the bundle is a separate,
 * deliberate command (see docs/admin/README.md). That is what keeps a draft edit
 * from ever reaching a visitor by accident.
 */
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DATA_DIR = process.env.SO_DATA_DIR
  ? resolve(process.env.SO_DATA_DIR)
  : join(ROOT, 'data', 'admin')
export const FILES_DIR = join(DATA_DIR, 'files')
export const PUB_DIR = join(DATA_DIR, 'publications')
const DB_PATH = join(DATA_DIR, 'sugar.db')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC);

CREATE TABLE IF NOT EXISTS sounds (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  step_id INTEGER,
  duration_s REAL,
  status TEXT NOT NULL DEFAULT 'active',
  availability TEXT NOT NULL DEFAULT 'available',
  sensitive INTEGER NOT NULL DEFAULT 0,
  license TEXT,
  credits TEXT,
  nature TEXT,
  source TEXT,
  file TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  analysis_json TEXT,
  analysis_version TEXT
);

CREATE TABLE IF NOT EXISTS sound_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sound_id TEXT NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  file_path TEXT,
  sha256 TEXT,
  bytes INTEGER,
  duration_s REAL,
  sample_rate INTEGER,
  channels INTEGER,
  analyzed_at TEXT,
  created_by TEXT,
  note TEXT,
  analysis_json TEXT,
  UNIQUE(sound_id, version)
);

CREATE TABLE IF NOT EXISTS restrictions (
  sound_id TEXT PRIMARY KEY REFERENCES sounds(id) ON DELETE CASCADE,
  sensitive INTEGER NOT NULL DEFAULT 0,
  availability TEXT NOT NULL DEFAULT 'available',
  provenance TEXT,
  validation_status TEXT NOT NULL DEFAULT 'existing',
  note TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  sound_id TEXT NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT,
  short_desc TEXT,
  story TEXT,
  pedagogy TEXT,
  credits_note TEXT,
  sources TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  author_id TEXT,
  updated_at TEXT NOT NULL,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  UNIQUE(sound_id, locale)
);

CREATE TABLE IF NOT EXISTS content_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  author_id TEXT,
  at TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS steps (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  display_no INTEGER NOT NULL,
  name_fr TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  story TEXT,
  illustration TEXT,
  qr TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS step_sounds (
  step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  sound_id TEXT NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (step_id, sound_id)
);

CREATE TABLE IF NOT EXISTS universes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  params_json TEXT,
  engine_implemented INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  note TEXT,
  dir TEXT NOT NULL,
  manifest_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

-- Visit profiles and compositions: MODEL PREPARED, NO ENDPOINT YET.
-- The brief asks for the three visitor modes to be modelled now and implemented
-- later. Nothing writes here today; the tables exist so the shape is fixed and
-- compositions can record which sound version produced them.
CREATE TABLE IF NOT EXISTS visitor_profiles (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'anonymous',   -- anonymous | local | account
  locale TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  account_email TEXT,                        -- NULL unless mode = 'account'
  consent_json TEXT                          -- what the visitor agreed to, verbatim
);

CREATE TABLE IF NOT EXISTS visit_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES visitor_profiles(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  universe_id TEXT,
  steps_discovered_json TEXT,
  sounds_selected_json TEXT,
  config_version TEXT
);

CREATE TABLE IF NOT EXISTS compositions (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES visitor_profiles(id) ON DELETE SET NULL,
  visit_session_id TEXT REFERENCES visit_sessions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  universe_id TEXT,
  seed INTEGER,
  duration_s REAL,
  -- [{ soundId, version, sha256 }] : provenance of the exact audio used, so a
  -- later sample replacement never rewrites history
  sound_versions_json TEXT,
  catalog_version TEXT,
  engine_version TEXT
);
`

let _db = null

export function db() {
  if (_db) return _db
  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(FILES_DIR, { recursive: true })
  mkdirSync(PUB_DIR, { recursive: true })
  _db = new DatabaseSync(DB_PATH)
  _db.exec('PRAGMA journal_mode = WAL')
  _db.exec('PRAGMA foreign_keys = ON')
  _db.exec(SCHEMA)
  return _db
}

export const nowIso = () => new Date().toISOString()
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

export function audit(actor, action, entity, entityId, detail) {
  db().prepare(
    'INSERT INTO audit_log (at, actor_id, actor_email, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?,?)',
  ).run(nowIso(), actor?.id ?? null, actor?.email ?? null, action, entity ?? null,
    entityId ?? null, detail == null ? null : JSON.stringify(detail))
}

/** Copy the bundled catalogue + steps into the working database on first run. */
export function seedFromBundle() {
  const d = db()
  const count = d.prepare('SELECT COUNT(*) AS n FROM sounds').get().n
  if (count > 0) return { seeded: false, sounds: count }

  const catalogPath = join(ROOT, 'src', 'data', 'catalog.json')
  const stepsPath = [join(ROOT, 'config', 'steps.v2.json'), join(ROOT, 'config', 'steps.json')]
    .find((p) => existsSync(p))
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  const t = nowIso()

  const insSound = d.prepare(`INSERT INTO sounds
    (id, code, name, step_id, duration_s, status, availability, sensitive, license, credits,
     nature, source, file, version, created_at, updated_at, analysis_json, analysis_version)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insRestriction = d.prepare(`INSERT INTO restrictions
    (sound_id, sensitive, availability, provenance, validation_status, note, updated_at)
    VALUES (?,?,?,?,?,?,?)`)
  const insVersion = d.prepare(`INSERT OR IGNORE INTO sound_versions
    (sound_id, version, file_path, sha256, bytes, duration_s, sample_rate, channels, analyzed_at, created_by, note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
  const mastersDir = join(ROOT, 'assets', 'originals')

  for (const s of catalog.sounds) {
    const sensitive = s.sensitive ? 1 : 0
    const availability = s.availability ?? 'available'
    insSound.run(
      s.id, s.code ?? s.id, s.title ?? s.name ?? s.id, s.stepId ?? null,
      s.analysis?.durationS ?? null, 'active', availability, sensitive,
      s.license ?? null, s.credits ?? null, s.nature ?? null,
      s.nature === 'Enregistrement monté' ? 'recording' : 'catalogue',
      s.file ?? s.audio ?? null, 1, t, t,
      s.analysis ? JSON.stringify(s.analysis) : null, 'catalogue-v1',
    )
    insRestriction.run(
      s.id, sensitive, availability, 'catalogue.json (import Inventaire)',
      sensitive ? 'existing-restriction' : 'existing',
      sensitive ? 'Restriction éditoriale existante — ne peut pas être levée par l’admin' : null, t,
    )
    // Register the museum master as version 1, in place. Restoring v1 therefore
    // restores the actual original file, not a web copy, and an operator can see
    // the original's hash without copying 49 MB into the admin store.
    const master = join(mastersDir, `${s.code ?? s.id}.wav`)
    if (existsSync(master)) {
      const buf = readFileSync(master)
      insVersion.run(s.id, 1, master, sha256(buf), buf.length,
        s.analysis?.durationS ?? null, s.analysis?.sampleRate ?? null, 1, t, null,
        'master original (assets/originals)')
    } else {
      insVersion.run(s.id, 1, null, null, null, s.analysis?.durationS ?? null,
        s.analysis?.sampleRate ?? null, 1, t, null, 'original non présent sur cet hôte')
    }
  }

  if (stepsPath) {
    const cfg = JSON.parse(readFileSync(stepsPath, 'utf8'))
    const insStep = d.prepare(`INSERT INTO steps
      (id, code, display_no, name_fr, name_en, description, story, illustration, qr, status, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    const insStepSound = d.prepare(
      'INSERT OR REPLACE INTO step_sounds (step_id, sound_id, position) VALUES (?,?,?)')
    for (const st of cfg.steps ?? []) {
      const code = st.short ?? `step-${st.id}`
      insStep.run(st.id, code, st.id, st.title, null, st.summary ?? null, null,
        null, `#/etape/${st.id}`, 'draft', t)
      const list = st.sounds
        ? st.sounds.map((x) => x.code ?? x)
        : catalog.sounds.filter((s) => (s.stepId ?? -1) === st.id).map((s) => s.id)
      list.forEach((sid, i) => {
        const exists = d.prepare('SELECT 1 AS x FROM sounds WHERE id=?').get(sid)
        if (exists) insStepSound.run(st.id, sid, i + 1)
      })
    }
  }

  const universes = [
    ['electro-sega', 'Electro Sega', 'Énergétique', 'published', 1, { bpm: 112, bars: 16 }, 1],
    ['sega-trad', 'Sega traditionnel', 'Dansant', 'published', 1, { bpm: 126, bars: 24 }, 1],
    ['ambient-creole', 'Ambient créole', 'Rêveur', 'draft', 1, { bpm: 72, bars: 12 }, 0],
    ['segazz', 'Segazz', 'Détendu', 'draft', 1, { bpm: 88, bars: 16 }, 0],
  ]
  const insU = d.prepare(`INSERT INTO universes
    (id, name, description, status, version, params_json, engine_implemented, updated_at)
    VALUES (?,?,?,?,?,?,?,?)`)
  for (const [id, name, desc, status, ver, params, impl] of universes) {
    insU.run(id, name, desc, status, ver, JSON.stringify(params), impl, t)
  }

  d.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)')
    .run('seeded_at', t, t)
  audit(null, 'seed', 'database', null, { sounds: catalog.sounds.length })
  return { seeded: true, sounds: catalog.sounds.length }
}

/** Atomic file write, used for publications. */
export function writeJsonAtomic(path, obj) {
  const tmp = `${path}.tmp-${randomUUID().slice(0, 8)}`
  writeFileSync(tmp, JSON.stringify(obj, null, 2))
  copyFileSync(tmp, path)
  try { writeFileSync(tmp, '') } catch { /* noop */ }
  return path
}
