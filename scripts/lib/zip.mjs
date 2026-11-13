// Minimal ZIP reader (stored + deflate), no external dependencies.
import { inflateRawSync } from 'node:zlib'

export function readZip(buf) {
  // locate End Of Central Directory
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a zip: EOCD not found')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  const entries = []
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('corrupt central directory at ' + off)
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const size = buf.readUInt32LE(off + 24)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    entries.push({ name, method, compSize, size, localOff })
    off += 46 + nameLen + extraLen + commentLen
  }
  return {
    names: entries.map((e) => e.name),
    entries,
    read(name) {
      const e = entries.find((x) => x.name === name)
      if (!e) throw new Error('missing entry ' + name)
      const lh = e.localOff
      if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error('corrupt local header for ' + name)
      const nl = buf.readUInt16LE(lh + 26)
      const el = buf.readUInt16LE(lh + 28)
      const start = lh + 30 + nl + el
      const raw = buf.subarray(start, start + e.compSize)
      if (e.method === 0) return Buffer.from(raw)
      if (e.method === 8) return inflateRawSync(raw)
      throw new Error(`unsupported compression method ${e.method} for ${name}`)
    },
  }
}
