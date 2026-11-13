// Minimal, dependency-free WAV reader/writer used by the build scripts.
// Supports PCM 8/16/24/32-bit and IEEE float32, any channel count (downmixed to mono).

export function readWav(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const tag = (o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a RIFF/WAVE file')

  let off = 12
  let fmt = null
  let dataOff = -1
  let dataLen = 0
  while (off + 8 <= dv.byteLength) {
    const id = tag(off)
    const size = dv.getUint32(off + 4, true)
    const body = off + 8
    if (id === 'fmt ') {
      fmt = {
        audioFormat: dv.getUint16(body, true),
        channels: dv.getUint16(body + 2, true),
        sampleRate: dv.getUint32(body + 4, true),
        bitsPerSample: dv.getUint16(body + 14, true),
      }
    } else if (id === 'data') {
      dataOff = body
      dataLen = Math.min(size, dv.byteLength - body)
    }
    off = body + size + (size % 2)
  }
  if (!fmt || dataOff < 0) throw new Error('missing fmt/data chunk')

  const bytes = fmt.bitsPerSample / 8
  const frames = Math.floor(dataLen / (bytes * fmt.channels))
  const out = new Float32Array(frames)
  const read = (p) => {
    switch (fmt.bitsPerSample) {
      case 8: return (dv.getUint8(p) - 128) / 128
      case 16: return dv.getInt16(p, true) / 32768
      case 24: {
        const b0 = dv.getUint8(p), b1 = dv.getUint8(p + 1), b2 = dv.getUint8(p + 2)
        let v = (b2 << 16) | (b1 << 8) | b0
        if (v & 0x800000) v |= ~0xffffff
        return v / 8388608
      }
      case 32:
        return fmt.audioFormat === 3 ? dv.getFloat32(p, true) : dv.getInt32(p, true) / 2147483648
      default: throw new Error('unsupported bit depth ' + fmt.bitsPerSample)
    }
  }
  for (let i = 0; i < frames; i++) {
    let sum = 0
    for (let c = 0; c < fmt.channels; c++) sum += read(dataOff + (i * fmt.channels + c) * bytes)
    out[i] = sum / fmt.channels
  }
  return { sampleRate: fmt.sampleRate, channels: fmt.channels, samples: out, bitsPerSample: fmt.bitsPerSample }
}

export function writeWav16(samples, sampleRate) {
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }
  return buf
}
