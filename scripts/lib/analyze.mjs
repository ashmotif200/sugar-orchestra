// Acoustic analysis: real measurements computed from the samples.
// Role suggestions are production HYPOTHESES, not artistic verdicts — the brief
// is explicit that only listening can confirm musical usability.

/* ---------------- FFT (iterative radix-2) ---------------- */
export function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t
      t = im[i]; im[i] = im[j]; im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr; im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

const FRAME = 1024
const HOP = 512

/* ---------------- Pitch: NSDF (McLeod) on a decimated low-passed copy ---------------- */
function lowpassDecimate(samples, sr, factor) {
  const cut = Math.min(1, (1200 * 2 * Math.PI) / sr) // ~1.2 kHz corner
  let y1 = 0, y2 = 0
  const out = new Float32Array(Math.floor(samples.length / factor))
  for (let i = 0, j = 0; i < samples.length; i += factor, j++) {
    const s = samples[i]
    y1 += cut * (s - y1)
    y2 += cut * (y1 - y2)
    out[j] = y2
  }
  return { data: out, sr: sr / factor }
}

function nsdfPitch(data, start, len, sr) {
  const maxLag = Math.min(Math.floor(len / 2), Math.floor(sr / 35))
  const minLag = Math.max(4, Math.floor(sr / 1000))
  if (start + len + maxLag >= data.length) return [0, 0]
  const nsdf = new Float64Array(maxLag + 1)
  let globalMax = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0, e1 = 0, e2 = 0
    for (let i = 0; i < len; i++) {
      const a = data[start + i], b = data[start + i + lag]
      ac += a * b; e1 += a * a; e2 += b * b
    }
    const denom = e1 + e2
    const v = denom > 1e-12 ? (2 * ac) / denom : 0
    nsdf[lag] = v
    if (v > globalMax) globalMax = v
  }
  if (globalMax < 0.25) return [0, 0]
  // standard McLeod: wait for the first negative region, then take the first
  // peak that reaches 0.9 * globalMax — avoids octave-down errors.
  let lag = minLag
  while (lag <= maxLag && nsdf[lag] > 0) lag++
  while (lag <= maxLag && nsdf[lag] <= 0) lag++
  let bestLag = 0
  for (; lag <= maxLag; lag++) {
    const isMax = nsdf[lag] > nsdf[lag - 1] && (lag + 1 > maxLag || nsdf[lag] >= nsdf[lag + 1])
    if (isMax && nsdf[lag] >= 0.9 * globalMax) { bestLag = lag; break }
  }
  if (!bestLag) return [0, 0]
  // parabolic interpolation for a finer f0
  const a = nsdf[bestLag - 1], b = nsdf[bestLag], c = nsdf[Math.min(maxLag, bestLag + 1)]
  const denom = a - 2 * b + c
  const shift = Math.abs(denom) > 1e-12 ? (0.5 * (a - c)) / denom : 0
  return [sr / (bestLag + shift), Math.max(0, Math.min(1, b))]
}

/* ---------------- Main analysis ---------------- */
export function analyzeSamples(samples, sampleRate, opts = {}) {
  const sr = sampleRate
  const n = samples.length
  const durationS = n / sr
  const frames = Math.max(1, Math.floor((n - FRAME) / HOP) + 1)

  const win = new Float32Array(FRAME)
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1))

  const rms = new Float32Array(frames)
  const centroid = new Float32Array(frames)
  const flatness = new Float32Array(frames)
  const zcr = new Float32Array(frames)
  const re = new Float32Array(FRAME)
  const im = new Float32Array(FRAME)

  for (let f = 0; f < frames; f++) {
    const start = f * HOP
    let sum = 0
    for (let i = 0; i < FRAME; i++) {
      const s = samples[start + i] || 0
      sum += s * s
      re[i] = s * win[i]
      im[i] = 0
    }
    rms[f] = Math.sqrt(sum / FRAME)
    let zc = 0
    for (let i = 1; i < FRAME; i++) if (((samples[start + i] || 0) < 0) !== ((samples[start + i - 1] || 0) < 0)) zc++
    zcr[f] = zc / FRAME

    fft(re, im)
    let magSum = 0, wSum = 0, logSum = 0
    for (let k = 1; k < FRAME / 2; k++) {
      const m = Math.hypot(re[k], im[k])
      magSum += m
      wSum += m * ((k * sr) / FRAME)
      logSum += Math.log(m + 1e-12)
    }
    const bins = FRAME / 2 - 1
    centroid[f] = magSum > 1e-9 ? wSum / magSum : 0
    flatness[f] = magSum > 1e-9 ? Math.exp(logSum / bins) / (magSum / bins) : 0
  }

  let maxRms = 0
  for (let i = 0; i < frames; i++) maxRms = Math.max(maxRms, rms[i])
  const gate = Math.max(maxRms * 0.08, 1e-4)
  const active = []
  for (let i = 0; i < frames; i++) if (rms[i] > gate) active.push(i)

  /* pitch on a decimated copy, on a bounded sample of active frames */
  const dec = lowpassDecimate(samples, sr, 4)
  const PFRAME = 512
  const step = Math.max(1, Math.ceil(active.length / 160))
  const f0s = []
  const confs = []
  for (let k = 0; k < active.length; k += step) {
    const start = Math.round((active[k] * HOP) / 4)
    if (start + PFRAME * 2 >= dec.data.length) continue
    const [f0, conf] = nsdfPitch(dec.data, start, PFRAME, dec.sr)
    if (f0 > 0 && conf > 0.5) { f0s.push(f0); confs.push(conf) }
  }
  const tonalScore = active.length ? Math.min(1, (f0s.length * step) / active.length) : 0
  const f0Median = f0s.length ? median(f0s) : 0
  const pitchConfidence = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0

  /* onsets: high-resolution pass (384/96), robust flux threshold + local-rise test.
     The local-rise test compares the frame against the mean of the preceding
     ~36 ms, which rejects the sample-variance fluctuations of noise beds while
     keeping real transients. */
  const OF = 384, OH = 96
  const oframes = Math.max(1, Math.floor((n - OF) / OH) + 1)
  const orms = new Float64Array(oframes)
  for (let f = 0; f < oframes; f++) {
    let s = 0
    for (let i = 0; i < OF; i++) { const v = samples[f * OH + i] || 0; s += v * v }
    orms[f] = Math.sqrt(s / OF)
  }
  let omax = 0
  for (const v of orms) omax = Math.max(omax, v)
  const oflux = new Float64Array(oframes)
  for (let i = 2; i < oframes; i++) oflux[i] = Math.max(0, orms[i] - orms[i - 1])
  const omed = median(Array.from(oflux))
  const omad = median(Array.from(oflux).map((v) => Math.abs(v - omed)))
  const othr = Math.max(omed + 3 * omad, 0.06 * omax)
  const onsets = []
  for (let i = 2; i < oframes - 1; i++) {
    let acc = 0, c = 0
    for (let j = Math.max(0, i - 12); j <= i - 2; j++) { acc += orms[j]; c++ }
    const back = c ? acc / c : 1e-9
    const rise = back > 1e-6 ? orms[i] / back : 9
    if (oflux[i] > othr && oflux[i] >= oflux[i - 1] && oflux[i] >= oflux[i + 1] && rise > 1.8 && orms[i] > 0.12 * omax) {
      const t = (i * OH) / sr
      if (!onsets.length || t - onsets[onsets.length - 1] > 0.07) onsets.push(t)
    }
  }

  const totalRms = Math.sqrt(samples.reduce((a, s) => a + s * s, 0) / n) || 1e-9
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(samples[i]))

  // énergie locale après chaque attaque : sert à choisir le passage le plus
  // représentatif quand on doit citer le son à l'état brut
  const onsetEnergy = onsets.map((t) => {
    const i0 = Math.floor(t * sr)
    let sum = 0, n = 0
    for (let i = i0; i < Math.min(samples.length, i0 + Math.floor(0.3 * sr)); i += 2) { sum += samples[i] * samples[i]; n++ }
    return round(Math.sqrt(sum / Math.max(1, n)), 4)
  })

  const sustainRatio = frames ? active.length / frames : 0
  const onsetRate = durationS > 0 ? onsets.length / durationS : 0

  let sharp = 0
  for (const t of onsets) {
    const i = Math.round((t * sr) / HOP)
    const a = rms[Math.min(frames - 1, i + 1)]
    const b = rms[Math.min(frames - 1, i + 6)]
    if (a > 0 && b / a < 0.55) sharp++
  }

  return {
    durationS: round(durationS, 2),
    sampleRate: sr,
    rmsDb: round(20 * Math.log10(totalRms), 1),
    peakDb: round(20 * Math.log10(peak || 1e-9), 1),
    centroidHz: Math.round(meanOf(centroid, active)),
    flatness: round(meanOf(flatness, active), 3),
    zcr: round(meanOf(zcr, active), 4),
    f0Hz: f0Median ? Math.round(f0Median * 10) / 10 : null,
    pitchConfidence: round(pitchConfidence, 2),
    tonalScore: round(tonalScore, 2),
    onsetRate: round(onsetRate, 2),
    onsets: onsets.map((t) => round(t, 2)),
    onsetEnergy,
    sustainRatio: round(sustainRatio, 2),
    attackSharpness: onsets.length ? round(sharp / onsets.length, 2) : 0,
  }
}

/* ---------------- Role hypotheses ---------------- */
export function suggestRoles(a) {
  const clamp = (v) => Math.max(0, Math.min(1, v))
  const tonal = a.tonalScore * (a.pitchConfidence || 0)
  const lowPitch = a.f0Hz ? clamp(1 - Math.abs(Math.log2(a.f0Hz / 90)) / 1.6) : 0
  const midPitch = a.f0Hz ? clamp(1 - Math.abs(Math.log2(a.f0Hz / 400)) / 2.2) : 0
  const percussive = clamp(a.onsetRate / 2.5) * 0.7 + (a.attackSharpness || 0) * 0.3
  const bright = clamp(a.centroidHz / 3500)
  const sustained = a.sustainRatio > 0.85 ? 1 : clamp((a.sustainRatio - 0.5) / 0.35)

  const scores = {
    bass: clamp(tonal * 0.6 + lowPitch * 0.4) * (a.f0Hz && a.f0Hz < 280 ? 1 : 0.25),
    melody: clamp(tonal * 0.65 + midPitch * 0.35) * (a.f0Hz && a.f0Hz > 140 ? 1 : 0.25),
    rhythm: clamp(percussive * 0.8 + (1 - tonal) * 0.2),
    earcandy: clamp(bright * 0.45 + clamp(a.onsetRate / 3) * 0.25 + (1 - a.sustainRatio) * 0.3),
    texture: clamp(sustained * 0.6 + (1 - clamp(a.onsetRate / 2)) * 0.25 + (1 - tonal) * 0.15),
  }
  const ranked = Object.entries(scores)
    .map(([role, score]) => ({ role, score: round(score, 2) }))
    .sort((x, y) => y.score - x.score)
  const picked = ranked.filter((r) => r.score >= 0.45).slice(0, 3)
  if (!picked.length) picked.push(ranked[0])
  return { picked: picked.map((p) => p.role), scores }
}

/* ---------------- helpers ---------------- */
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d
const meanOf = (arr, idx) => (idx.length ? idx.reduce((a, i) => a + arr[i], 0) / idx.length : 0)
const median = (arr) => {
  if (!arr.length) return 0
  const v = [...arr].sort((a, b) => a - b)
  return v[Math.floor(v.length / 2)]
}
export { round, median }
