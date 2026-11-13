#!/usr/bin/env node
/**
 * V2.1.1 — mesure de l'équilibre par couche.
 *
 * Pour chaque univers, on rend TROIS fois le même plan :
 *   1. samples du musée seuls (bassNotes retirées)
 *   2. basse seule (notes retirées)
 *   3. mix complet
 * puis on mesure LUFS / true peak / peak avec ffmpeg sur chaque fichier produit.
 *
 * Les LUFS de couches ne s'additionnent pas linéairement : on ne calcule donc pas
 * « samples + basse = mix », on mesure le mix et on compare les écarts.
 *
 *   node scripts/v2/analyze-layers.mjs [--out docs/v2.1/audio-balance.json]
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const BUILD = join(ROOT, '.v21build')
const ENGINE = join(BUILD, 'engine-v2')
const OUT_FILE = join(ROOT, 'docs/v2.1/audio-balance.json')

const SELECTIONS = {
  'electro-sega': ['01_01', '01_03', '04_02', '04_09', '06_04', '07_02', '08_02'],
  'sega-trad': ['01_03', '02_04', '04_02', '04_03', '06_04', '07_01', '08_02'],
  segazz: ['01_01', '02_01', '04_07', '04_09', '05_01', '07_02', '08_03'],
  'ambient-creole': ['01_02', '04_07', '05_01', '07_01', '08_03'],
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
    for (const f of readdir(dir)) {
      if (!f.endsWith('.js')) continue
      const p = join(dir, f)
      writeFileSync(p, readFileSync(p, 'utf8')
        .replace(/from '\.\/([a-zA-Z0-9-]+)'/g, "from './$1.js'")
        .replace(/from '\.\.\/([a-zA-Z0-9-]+)'/g, "from '../$1.js'"))
    }
  }
  fix(join(ENGINE, 'v21'))
  fix(ENGINE)
}
const readdir = (d) => execFileSync('ls', [d], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)

async function render(plan, attempt = 1) {
  const res = await fetch('http://127.0.0.1:5182/api/v2/render', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-so-admin': '1' },
    body: JSON.stringify({ plan }),
  })
  const body = await res.json()
  // la limite publique est de 10 rendus/minute : un outil de mesure local doit
  // attendre plutôt que d'échouer au milieu d'une série
  if (res.status === 429 && attempt <= 3) {
    await new Promise((r) => setTimeout(r, 61000))
    return render(plan, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${body.error}`)
  return body
}

async function main() {
  compile()
  const { buildPlan21, summarise21 } = await import(join(ENGINE, 'v21/plan.js'))
  const { PROFILES } = await import(join(ENGINE, 'profiles.js'))
  const { setCapabilityMatrix } = await import(join(ENGINE, 'capabilities.js'))
  setCapabilityMatrix(JSON.parse(readFileSync(join(ROOT, 'src/data/capability-matrix.json'), 'utf8')))

  const styles = {
    'electro-sega': JSON.parse(readFileSync(join(ROOT, 'src/data/style-electro-sega.json'), 'utf8')),
    'sega-trad': JSON.parse(readFileSync(join(ROOT, 'src/data/style-sega-trad.json'), 'utf8')),
    segazz: JSON.parse(readFileSync(join(ROOT, 'src/data/style-segazz.json'), 'utf8')),
  }
  const catalog = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'))
  const byId = new Map(catalog.sounds.map((s) => [s.id, s]))

  const out = { generatedAt: new Date().toISOString(), engine: 'v2.1.0', method:
    'trois rendus par univers (samples / basse / mix), mesures ffmpeg sur les fichiers produits',
    note: 'les LUFS de couches ne s’additionnent pas : les écarts sont mesurés, pas calculés', universes: [] }

  let seed = 20261121
  for (const profile of PROFILES) {
    const selection = (SELECTIONS[profile.id] ?? []).map((id) => byId.get(id)).filter(Boolean)
    const plan = buildPlan21({
      profile, seed, selection, mode: 'hybrid_synth',
      styleModel: styles[profile.id] ?? null,
      capabilityMatrixSource: 'capability-matrix.json',
      targetSeconds: profile.id === 'sega-trad' ? 40 : 36,
    })
    const s = summarise21(plan)
    const full = await render(plan)
    const samplesOnly = await render({ ...plan, bassNotes: [], bassSynth: null })
    const bassOnly = plan.bassNotes.length
      ? await render({ ...plan, notes: [] })
      : null

    const entry = {
      universeId: profile.id, reference: profile.reference ?? null, seed,
      bars: s.bars, durationS: s.durationS,
      layers: {
        samples: { lufs: samplesOnly.verification.lufs, truePeak: samplesOnly.verification.truePeakDb, peak: samplesOnly.verification.peakDb },
        bass: bassOnly ? { lufs: bassOnly.verification.lufs, truePeak: bassOnly.verification.truePeakDb, peak: bassOnly.verification.peakDb, notes: s.bassNotes, timbre: s.bassTimbre } : null,
        mix: { lufs: full.verification.lufs, truePeak: full.verification.truePeakDb, peak: full.verification.peakDb, events: s.notes },
      },
      deltaLufsMixVsSamples: (full.verification.lufs != null && samplesOnly.verification.lufs != null)
        ? Number((full.verification.lufs - samplesOnly.verification.lufs).toFixed(2)) : null,
      bassGainDb: plan.bassSynth?.gainDb ?? null,
    }
    out.universes.push(entry)
    console.log(`${profile.id.padEnd(14)} samples ${entry.layers.samples.lufs} LUFS · basse ` +
      `${entry.layers.bass?.lufs ?? '—'} · mix ${entry.layers.mix.lufs} LUFS ` +
      `(Δ ${entry.deltaLufsMixVsSamples} dB)`)
    seed++
  }

  mkdirSync(join(ROOT, 'docs/v2.1'), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2))
  console.log(`\n→ ${OUT_FILE}`)
}

main().catch((e) => { console.error('échec:', e.message); process.exit(1) })
