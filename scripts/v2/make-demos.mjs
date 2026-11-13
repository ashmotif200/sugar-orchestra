#!/usr/bin/env node
/**
 * Génère les démonstrations audio V2.
 *
 * Le planificateur est du TypeScript : ce script le compile une fois dans
 * `.v2build/` puis l'importe depuis Node. Les imports relatifs sont réécrits avec
 * leur extension `.js` parce que Node ESM l'exige et que `tsc` ne l'émet pas —
 * c'est le seul bricolage de ce script, et il est vérifié par le fait qu'il
 * fonctionne ou échoue franchement.
 *
 *   1. compile src/engine-v2 -> .v2build
 *   2. construit un ScorePlan par profil (déterministe, seed fournie)
 *   3. POST /api/v2/render : le SERVEUR rend, mélange et vérifie
 *   4. copie le WAV et ses métadonnées dans le dossier de livraison
 *
 *   node scripts/v2/make-demos.mjs [--out DIR] [--api URL] [--seed N]
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const BUILD = join(ROOT, '.v2build')
// tsc conserve l'arborescence depuis la racine commune (src/) : la sortie est
// donc .v2build/engine-v2/*.js et non .v2build/*.js
const OUT_DIR = join(BUILD, 'engine-v2')
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const API = arg('api', 'http://127.0.0.1:5182')
const OUT = arg('out', '/workspace/download/sugar-audio/v2-demos')
const BASE_SEED = Number(arg('seed', '20261113'))

/* Sélections représentatives de la sélection muséographique (17 sons).
   Elles contiennent volontairement 04_02, historiquement sensible, pour que la
   démonstration prouve la politique v2 et pas seulement le moteur. */
const SELECTIONS = {
  'electro-sega': ['01_01', '01_03', '04_02', '04_09', '06_04', '07_02', '08_02'],
  'sega-trad': ['01_03', '02_04', '04_02', '04_03', '06_04', '07_01', '08_02'],
  segazz: ['01_01', '02_01', '04_07', '04_09', '05_01', '07_02', '08_03'],
  'ambient-creole': ['01_02', '04_07', '05_01', '07_01', '08_03'],
}

function compile() {
  rmSync(BUILD, { recursive: true, force: true })
  const files = ['types', 'profiles', 'capabilities', 'plan'].map((f) => join(ROOT, 'src/engine-v2', `${f}.ts`))
  execFileSync(process.execPath, [join(ROOT, 'node_modules/typescript/bin/tsc'),
    ...files, '--outDir', BUILD, '--target', 'es2022', '--module', 'esnext',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--strict'], { stdio: 'inherit' })

  // Node ESM exige l'extension sur les imports relatifs
  for (const f of readdirSync(OUT_DIR).filter((x) => x.endsWith('.js'))) {
    const p = join(OUT_DIR, f)
    let src = readFileSync(p, 'utf8')
    src = src.replace(/from '\.\/([a-zA-Z-]+)'/g, "from './$1.js'")
    writeFileSync(p, src)
  }
}

async function render(plan) {
  const res = await fetch(`${API}/api/v2/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-so-admin': '1' },
    body: JSON.stringify({ plan }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${body.error}${body.detail ? ' — ' + JSON.stringify(body.detail) : ''}`)
  return body
}

async function main() {
  const health = await fetch(`${API}/api/v2/health`).then((r) => r.json()).catch(() => null)
  if (!health?.ok) {
    console.error(`serveur audio indisponible sur ${API} — lancez « npm run admin:serve »`)
    process.exit(2)
  }

  compile()
  const { buildPlan, summarisePlan, PROFILES, setCapabilityMatrix } = await import(join(OUT_DIR, 'plan.js'))
    .then(async (planMod) => {
      const caps = await import(join(OUT_DIR, 'capabilities.js'))
      const profs = await import(join(OUT_DIR, 'profiles.js'))
      return { buildPlan: planMod.buildPlan, summarisePlan: planMod.summarisePlan, PROFILES: profs.PROFILES, setCapabilityMatrix: caps.setCapabilityMatrix }
    })
  setCapabilityMatrix(JSON.parse(readFileSync(join(ROOT, 'src/data/capability-matrix.json'), 'utf8')))

  const catalog = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))
  const byId = new Map(catalog.sounds.map((s) => [s.id, s]))
  mkdirSync(OUT, { recursive: true })

  const report = []
  let seed = BASE_SEED
  for (const profile of PROFILES) {
    const ids = SELECTIONS[profile.id] ?? []
    const selection = ids.map((id) => byId.get(id)).filter(Boolean)
    if (!selection.length) { console.log(`— ${profile.id}: aucun son, ignoré`); continue }

    const plan = buildPlan({ profile, seed, selection })
    const summary = summarisePlan(plan)
    process.stdout.write(`\n[${profile.id}] seed ${seed} · ${summary.bars} mesures · ${summary.durationS} s · ${summary.notes} événements\n`)

    const meta = await render(plan)
    const wavOut = join(OUT, `v2-${profile.id}-seed${seed}.wav`)
    copyFileSync(join(ROOT, 'data/admin/renders', meta.file), wavOut)
    writeFileSync(join(OUT, `v2-${profile.id}-seed${seed}.plan.json`), JSON.stringify(plan, null, 2))
    writeFileSync(join(OUT, `v2-${profile.id}-seed${seed}.meta.json`), JSON.stringify(meta, null, 2))

    const v = meta.verification
    console.log(`   rendu ${(meta.bytes / 1048576).toFixed(2)} Mo · ${v.durationS?.toFixed(2)} s @ ${v.sampleRate} Hz ${v.channels}ch`)
    console.log(`   peak ${v.peakDb} dBFS · true peak ${v.truePeakDb} dBTP · LUFS ${v.lufs} · vérif ${v.ok ? 'OK' : 'À REVOIR'}`)
    console.log(`   décode ${meta.timing.decodeMs} ms · mix ${meta.timing.mixMs} ms · vérif ${meta.timing.verifyMs} ms · total ${meta.timing.totalMs} ms`)
    if (summary.limits.length) console.log(`   limites : ${summary.limits.join(', ')}`)
    if (!v.ok) v.notes.forEach((n) => console.log(`   ! ${n}`))

    report.push({
      profileId: profile.id, profileVersion: profile.version, seed,
      plan: summary, render: { id: meta.id, file: wavOut, bytes: meta.bytes, verification: v, timing: meta.timing },
      wav: wavOut,
    })
    seed += 1
  }

  writeFileSync(join(OUT, 'demos.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    api: API,
    engine: 'v2.0.0',
    note: 'WAV rendus par le serveur ; vérifications mesurées par ffmpeg sur le fichier produit.',
    demos: report,
  }, null, 2))

  console.log(`\n${report.length}/${PROFILES.length} profils rendus → ${OUT}`)
  return report.length === PROFILES.length ? 0 : 1
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error('échec:', e.message)
  process.exit(1)
})
