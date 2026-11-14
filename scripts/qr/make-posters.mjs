#!/usr/bin/env node
/**
 * Génère les huit QR de la démonstration.
 *
 *   - un SVG vectoriel par poste (impression) ;
 *   - un PNG par poste (secours, messagerie) ;
 *   - une planche A4 imprimable regroupant les huit ;
 *   - un tableau de correspondance CSV ;
 *   - puis DÉCODE chaque PNG produit pour prouver qu'il est lisible.
 *
 * L'URL n'est jamais écrite dans le code : elle vient de config/qr.json.
 * Le QR encode un identifiant de poste (`#/poste/3`), jamais un nom de fichier.
 *
 *   node scripts/qr/make-posters.mjs [--base https://exemple/]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const cfg = JSON.parse(readFileSync(resolve(ROOT, 'config/qr.json'), 'utf8'))
const postes = JSON.parse(readFileSync(resolve(ROOT, 'config/postes.json'), 'utf8')).postes
const catalog = JSON.parse(readFileSync(resolve(ROOT, 'src/data/catalog.json'), 'utf8'))

const argBase = process.argv.indexOf('--base')
const base = (argBase > -1 ? process.argv[argBase + 1] : cfg.baseUrl).replace(/\/+$/, '/')
const url = (id) => base + cfg.path.replace('{id}', String(id))
const OUT = resolve(ROOT, 'docs/qr')
mkdirSync(OUT, { recursive: true })

const rows = []
const cards = []

for (const p of postes) {
  const target = url(p.id)
  const sound = catalog.sounds.find((s) => s.code === p.sampleCode)
  const name = `poste-${p.id}`
  await QRCode.toFile(resolve(OUT, `${name}.svg`), target, { type: 'svg', margin: 4, width: 512, errorCorrectionLevel: 'M' })
  await QRCode.toFile(resolve(OUT, `${name}.png`), target, { type: 'png', margin: 4, width: 900, errorCorrectionLevel: 'M' })
  rows.push({ poste: p.id, qr: p.qr, sample: p.sampleCode, titre: p.title, son: sound?.title ?? '', url: target, fichier: `${name}.svg` })
  cards.push(`    <figure class="poster">
      <img src="${name}.svg" alt="QR du poste ${p.id}, ${p.title}">
      <figcaption><b>Poste ${p.id} &middot; ${p.title}</b><span>${sound?.title ?? p.sampleCode}</span></figcaption>
    </figure>`)
  console.log(`poste ${p.id} -> ${target}`)
}

const csv = ['poste;qr;sample;titre_poste;son;url;fichier', ...rows.map((r) => `${r.poste};${r.qr};${r.sample};${r.titre};${r.son};${r.url};${r.fichier}`)].join('\n') + '\n'
writeFileSync(resolve(OUT, 'correspondance-postes.csv'), csv)

const sheet = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Sugar Orchestra - 8 QR de demonstration</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: "DM Sans", system-ui, sans-serif; margin: 0; color: #1E2B22; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  p.lead { font-size: 9pt; color: #555; margin: 0 0 6mm; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .poster { margin: 0; text-align: center; border: 1px solid #ddd; border-radius: 4mm; padding: 4mm; break-inside: avoid; }
  .poster img { width: 62mm; height: 62mm; }
  figcaption { display: grid; gap: 1mm; margin-top: 2mm; }
  figcaption b { font-size: 11pt; }
  figcaption span { font-size: 8.5pt; color: #555; }
  footer { margin-top: 6mm; font-size: 8pt; color: #777; }
</style></head><body>
  <h1>Sugar Orchestra &mdash; postes de démonstration</h1>
  <p class="lead">Huit postes, huit sons. Scanner avec l'appareil photo du téléphone ou depuis l'application (bouton « Scanner un QR code »).</p>
  <div class="grid">
${cards.join('\n')}
  </div>
  <footer>Base des liens : ${base} &mdash; généré par scripts/qr/make-posters.mjs</footer>
</body></html>
`
writeFileSync(resolve(OUT, 'planche-postes.html'), sheet)

let ok = 0
for (const r of rows) {
  const png = PNG.sync.read(readFileSync(resolve(OUT, r.fichier.replace('.svg', '.png'))))
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
  const good = decoded?.data === r.url
  if (good) ok++
  console.log(`  ${good ? 'OK ' : 'KO '} ${r.fichier.replace('.svg', '.png')} -> ${decoded?.data ?? 'illisible'}`)
}
console.log(`\n${ok}/${rows.length} QR decodes et conformes - planche : docs/qr/planche-postes.html`)
if (ok !== rows.length) process.exit(1)
