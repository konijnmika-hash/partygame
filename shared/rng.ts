// Seeded, deterministic random number generation (mulberry32) used by server game logic
// and deterministic shared simulations.

export interface Rng {
  readonly seed: number;
  next(): number; // [0,1)
  int(min: number, max: number): number; // inclusive
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  sample<T>(arr: readonly T[], n: number): T[];
  fork(salt: number | string): Rng;
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sample: (arr, n) => rng.shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length))),
    fork: (salt) => createRng((seed ^ (typeof salt === 'number' ? Math.imul(salt + 1, 2654435761) : hashString(salt))) >>> 0),
  };
  return rng;
}
