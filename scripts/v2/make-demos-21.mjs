#!/usr/bin/env node
/**
 * Démonstrations V2.1 — 4 univers + comparaisons sans basse.
 *
 * Compile les modules V2.1 pour Node, construit les plans, les fait rendre par le
 * serveur (module C, qui synthétise la basse), puis copie WAV + plan + métadonnées
 * dans le dossier de livraison.
 *
 *   node scripts/v2/make-demos-21.mjs [--out DIR] [--api URL]
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const BUILD = join(ROOT, '.v21build')
// tsc élague la racine commune : la sortie est .v21build/engine-v2/... (pas src/)
const ENGINE_DIR = join(BUILD, 'engine-v2')
const OUT_DIR = join(ENGINE_DIR, 'v21')
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d }
const API = arg('api', 'http://127.0.0.1:5182')
const OUT = arg('out', '/workspace/download/sugar-audio/v21-demos')

const SELECTIONS = {
  'electro-sega': ['01_01', '01_03', '04_02', '04_09', '06_04', '07_02', '08_02'],
  'sega-trad': ['01_03', '02_04', '04_02', '04_03', '06_04', '07_01', '08_02'],
  segazz: ['01_01', '02_01', '04_07', '04_09', '05_01', '07_02', '08_03'],
  'ambient-creole': ['01_02', '04_07', '05_01', '07_01', '08_03'],
}
const BASE_SEED = 20261121

function compile() {
  rmSync(BUILD, { recursive: true, force: true })
  const files = [
    'src/engine-v2/types.ts', 'src/engine-v2/profiles.ts', 'src/engine-v2/capabilities.ts',
    'src/engine-v2/v21/patterns.ts', 'src/engine-v2/v21/harmony.ts', 'src/engine-v2/v21/plan.ts',
  ].map((f) => join(ROOT, f))
  execFileSync(process.execPath, [join(ROOT, 'node_modules/typescript/bin/tsc'),
    ...files, '--outDir', BUILD, '--target', 'es2022', '--module', 'esnext',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--strict'], { stdio: 'inherit' })
  const dir = OUT_DIR
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const p = join(dir, f)
    let src = readFileSync(p, 'utf8').replace(/from '\.\/([a-zA-Z0-9-]+)'/g, "from './$1.js'")
    src = src.replace(/from '\.\.\/([a-zA-Z0-9-]+)'/g, "from '../$1.js'")
    writeFileSync(p, src)
  }
  for (const f of readdirSync(ENGINE_DIR).filter((x) => x.endsWith('.js'))) {
    const p = join(ENGINE_DIR, f)
    writeFileSync(p, readFileSync(p, 'utf8').replace(/from '\.\/([a-zA-Z0-9-]+)'/g, "from './$1.js'"))
  }
}

async function main() {
  const health = await fetch(`${API}/api/v2/health`).then((r) => r.json()).catch(() => null)
  if (!health?.ok) { console.error(`serveur audio indisponible sur ${API}`); process.exit(2) }

  compile()
  const { buildPlan21, summarise21, styleFor } = await import(join(OUT_DIR, 'plan.js')).then(async (m) => {
    const h = await import(join(OUT_DIR, 'harmony.js'))
    return { buildPlan21: m.buildPlan21, summarise21: m.summarise21, styleFor: null, _h: h }
  })
  const { PROFILES } = await import(join(ENGINE_DIR, 'profiles.js'))
  const { setCapabilityMatrix } = await import(join(ENGINE_DIR, 'capabilities.js'))
  setCapabilityMatrix(JSON.parse(readFileSync(join(ROOT, 'src/data/capability-matrix.json'), 'utf8')))

  const styles = {
    'electro-sega': JSON.parse(readFileSync(join(ROOT, 'src/data/style-electro-sega.json'), 'utf8')),
    'sega-trad': JSON.parse(readFileSync(join(ROOT, 'src/data/style-sega-trad.json'), 'utf8')),
    segazz: JSON.parse(readFileSync(join(ROOT, 'src/data/style-segazz.json'), 'utf8')),
  }
  const catalog = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))
  const byId = new Map(catalog.sounds.map((s) => [s.id, s]))
  mkdirSync(OUT, { recursive: true })

  const runs = [
    { profileId: 'electro-sega', mode: 'hybrid_synth', label: 'energetique-percussive' },
    { profileId: 'electro-sega', mode: 'museum_only', label: 'energetique-sans-basse' },
    { profileId: 'sega-trad', mode: 'hybrid_synth', label: 'dansant-roulement' },
    { profileId: 'segazz', mode: 'hybrid_synth', label: 'detendu-warm' },
    { profileId: 'segazz', mode: 'museum_only', label: 'detendu-sans-basse' },
    { profileId: 'ambient-creole', mode: 'hybrid_synth', label: 'reveur-sub' },
  ]

  const report = []
  let seed = BASE_SEED
  for (const run of runs) {
    const profile = PROFILES.find((p) => p.id === run.profileId)
    const selection = (SELECTIONS[run.profileId] ?? []).map((id) => byId.get(id)).filter(Boolean)
    const plan = buildPlan21({
      profile, seed, selection, mode: run.mode,
      styleModel: styles[run.profileId] ?? null,
      capabilityMatrixSource: 'capability-matrix.json (17 sons)',
      targetSeconds: run.profileId === 'sega-trad' ? 40 : 36,
    })
    const s = summarise21(plan)
    process.stdout.write(`\n[${run.label}] ${s.bars} mesures · ${s.durationS} s · ${s.notes} événements · basse ${s.bassNotes} (${s.bassTimbre ?? '—'})\n`)

    const res = await fetch(`${API}/api/v2/render`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-so-admin': '1' },
      body: JSON.stringify({ plan }),
    })
    const meta = await res.json()
    if (!res.ok) { console.error(`   échec ${res.status}: ${meta.error}`); continue }

    const base = `v21-${run.label}-seed${seed}`
    const wav = join(OUT, `${base}.wav`)
    copyFileSync(join(ROOT, 'data/admin/renders', meta.file), wav)
    writeFileSync(join(OUT, `${base}.plan.json`), JSON.stringify(plan, null, 2))
    writeFileSync(join(OUT, `${base}.meta.json`), JSON.stringify(meta, null, 2))

    const v = meta.verification
    console.log(`   ${v.durationS?.toFixed(2)} s · peak ${v.peakDb} · true peak ${v.truePeakDb} dBTP · LUFS ${v.lufs} · ${v.ok ? 'OK' : 'À REVOIR'}`)
    console.log(`   mix ${meta.timing.mixMs} ms · total ${meta.timing.totalMs} ms · basse ${meta.bass?.notes ?? 0} notes`)
    if (s.limits.length) console.log(`   limites : ${s.limits.join(', ')}`)

    report.push({ label: run.label, profileId: run.profileId, mode: run.mode, seed, plan: s, wav, meta: { id: meta.id, verification: v, timing: meta.timing, bass: meta.bass } })
    seed += 1
  }

  writeFileSync(join(OUT, 'demos-21.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), engine: 'v2.1.0', api: API,
    note: 'WAV rendus par le serveur ; mesures ffmpeg sur le fichier produit ; aucune validation perceptive humaine.',
    demos: report,
  }, null, 2))
  console.log(`\n${report.length}/${runs.length} rendus → ${OUT}`)
  return report.length === runs.length ? 0 : 1
}

main().then((c) => process.exit(c)).catch((e) => { console.error('échec:', e.message); process.exit(1) })
