// Deterministic PRNG: the same collection + universe always yields the same
// piece (essential for a rehearsed demo), while different collections diverge.
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type Rng = () => number

export const pick = <T,>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length) % arr.length]
export const range = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo)
export const chance = (rng: Rng, p: number) => rng() < p
export const jitter = (rng: Rng, amount: number) => (rng() * 2 - 1) * amount
