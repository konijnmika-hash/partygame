// Cryptographic randomness that works in Node and in browsers (the room host can run in a tab).
const c: Crypto = globalThis.crypto;

/** Uniform integer in [min, max) — or [0, min) when called with one argument. */
export function randomInt(min: number, max?: number): number {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  const range = max - min;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / range) * range;
  do c.getRandomValues(buf);
  while (buf[0] >= limit);
  return min + (buf[0] % range);
}

export function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  c.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function randomUUID(): string {
  return c.randomUUID();
}
