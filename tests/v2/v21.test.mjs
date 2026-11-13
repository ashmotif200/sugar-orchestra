#!/usr/bin/env node
/**
 * Tests ciblés V2.1.1 — modes, basse, durées, déterminisme, rendu.
 *
 *   node tests/v2/v21.test.mjs [--api http://127.0.0.1:5182]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const BUILD = join(ROOT, '.v21build')
const ENGINE = join(BUILD, 'engine-v2')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d }
const API = arg('api', 'http://127.0.0.1:5182')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + String(detail).slice(0, 120) : ''}`)
}

function compile() {
  const files = [
    'src/engine-v2/types.ts', 'src/engine-v2/profiles.ts', 'src/engine-v2/capabilities.ts',
    'src/engine-v2/v21/patterns.ts', 'src/engine-v2/v21/harmony.ts', 'src/engine-v2/v21/plan.ts',
  ].map((f) => join(ROOT, f))
  execFileSync(process.execPath, [join(ROOT, 'node_modules/typescript/bin/tsc'),
    ...files, '--outDir', BUILD, '--target', 'es2022', '--module', 'esnext',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--strict'], { stdio: 'inherit' })
  const fix = (dir) => {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const p = join(dir, f)
      writeFileSync(p, readFileSync(p, 'utf8')
        .replace(/from '\.\/([a-zA-Z0-9-]+)'/g, "from './$1.js'")
        .replace(/from '\.\.\/([a-zA-Z0-9-]+)'/g, "from '../$1.js'"))
    }
  }
  fix(join(ENGINE, 'v21')); fix(ENGINE)
}

async function post(plan) {
  const res = await fetch(`${API}/api/v2/render`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-so-admin': '1' },
    body: JSON.stringify({ plan }),
  })
  return { status: res.status, body: await res.json() }
}

async function main() {
  compile()
  const { buildPlan21, summarise21, barsForDuration } = await import(join(ENGINE, 'v21/plan.js'))
  const { PROFILES } = await import(join(ENGINE, 'profiles.js'))
  const { setCapabilityMatrix } = await import(join(ENGINE, 'capabilities.js'))
  setCapabilityMatrix(JSON.parse(readFileSync(join(ROOT, 'src/data/capability-matrix.json'), 'utf8')))

  const styles = { 'electro-sega': JSON.parse(readFileSync(join(ROOT, 'src/data/style-electro-sega.json'), 'utf8')) }
  const catalog = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))
  const byId = new Map(catalog.sounds.map((s) => [s.id, s]))
  const ids = ['01_01', '01_03', '04_02', '04_09', '06_04']
  const selection = ids.map((i) => byId.get(i)).filter(Boolean)
  const profile = PROFILES.find((p) => p.id === 'electro-sega')
  const build = (mode, seed = 4242) => buildPlan21({
    profile, seed, selection, mode, styleModel: styles['electro-sega'],
    targetSeconds: 36, capabilityMatrixSource: 'test',
  })

  const hybrid = build('hybrid_synth')
  const museum = build('museum_only')
  const derived = build('museum_derived')

  /* ------------------------------------------------------------- modes */
  check('hybrid_has_bass', hybrid.bassNotes.length > 0 && !!hybrid.bassSynth, `${hybrid.bassNotes.length} notes`)
  check('museum_only_has_no_synth', museum.bassNotes.length === 0 && museum.bassSynth === null)
  check('museum_derived_has_no_synth', derived.bassNotes.length === 0)
  check('bass_synth_only_in_hybrid', museum.notes.length > 0 && museum.bassNotes.length === 0)

  /* -------------------------------------------------------- déterminisme */
  const again = build('hybrid_synth')
  check('deterministic_same_seed', JSON.stringify(again) === JSON.stringify(hybrid))
  const other = build('hybrid_synth', 4243)
  check('differs_with_seed', JSON.stringify(other) !== JSON.stringify(hybrid))

  /* -------------------------------------------------------------- durée */
  const bars = barsForDuration(profile, 36)
  const dur = bars * profile.time.barSeconds
  check('duration_within_30_60s', dur >= 30 && dur <= 60, `${bars} mesures = ${dur.toFixed(2)} s`)
  check('dance_target_respected', (() => {
    const p = PROFILES.find((x) => x.id === 'sega-trad')
    const d = barsForDuration(p, 40) * p.time.barSeconds
    return d >= 30 && d <= 60
  })(), 'Dansant tient dans 30–60 s')

  /* ------------------------------------------------------------ structure */
  const kinds = hybrid.sections.map((s) => s.kind)
  check('has_intro_and_outro', kinds[0] === 'intro' && kinds[kinds.length - 1] === 'outro', kinds.join(' '))
  check('has_transition_section', kinds.includes('build') && kinds.includes('break'), kinds.join(' '))
  check('sections_cover_all_bars',
    hybrid.sections.reduce((n, s) => n + s.bars, 0) === hybrid.bars)

  /* -------------------------------------------------------------- basse */
  const badMidi = hybrid.bassNotes.filter((b) => b.midi < 24 || b.midi > 60)
  check('bass_midi_in_range', badMidi.length === 0, `${hybrid.bassNotes.length} notes`)
  const badVel = hybrid.bassNotes.filter((b) => b.velocity < 0 || b.velocity > 1)
  check('bass_velocity_valid', badVel.length === 0)
  const hz = hybrid.bassNotes.slice(0, 3).map((b) => 440 * Math.pow(2, (b.midi - 69) / 12))
  check('bass_frequencies_audible', hz.every((f) => f >= 30 && f <= 330), hz.map((f) => f.toFixed(1)).join(' / ') + ' Hz')
  check('bass_not_on_every_hit', hybrid.bassNotes.length < hybrid.notes.length * 0.6,
    `${hybrid.bassNotes.length} notes de basse pour ${hybrid.notes.length} événements`)

  /* --------------------------------------------------------- couverture */
  const recognised = new Set(hybrid.notes.filter((n) => n.recognisable).map((n) => n.sourceId))
  check('every_sound_recognisable', ids.every((i) => recognised.has(i)), `${recognised.size}/${ids.length}`)

  /* ------------------------------------------------------------- rendu */
  const r1 = await post(hybrid)
  check('render_hybrid_ok', r1.status === 201, `HTTP ${r1.status}`)
  if (r1.status === 201) {
    check('true_peak_under_ceiling', r1.body.verification.truePeakDb <= -1, `${r1.body.verification.truePeakDb} dBTP`)
    check('no_nan', r1.body.verification.hasNaN === false)
    check('bass_rendered', (r1.body.bass?.frames ?? 0) > 0, `${r1.body.bass?.notes} notes, ${r1.body.bass?.frames} trames`)
    const r2 = await post(hybrid)
    const a = Buffer.from(await (await fetch(`${API}/api/v2/render/${r1.body.id}`)).arrayBuffer())
    const b = Buffer.from(await (await fetch(`${API}/api/v2/render/${r2.body.id}`)).arrayBuffer())
    check('render_byte_identical', Buffer.compare(a, b) === 0, `${a.length} octets`)
  }

  const badBass = { ...hybrid, mode: 'museum_only' }
  const r3 = await post(badBass)
  check('server_rejects_bass_outside_hybrid', r3.status === 400, `HTTP ${r3.status}`)

  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} contrôles V2.1 OK`)
  return passed === results.length ? 0 : 1
}

main().then((c) => process.exit(c)).catch((e) => { console.error('échec:', e.message); process.exit(1) })
