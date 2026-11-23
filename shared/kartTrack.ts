// Tiny Kart Race track: a smooth closed loop generated from a seed (polar curve with a few
// harmonics), plus boost pads and oil slicks. Shared by the server physics and the client renderer.
import { createRng } from './rng';

export const KT = { W: 2400, H: 1600, HALF: 80, N: 180, LAPS: 3, R: 22 } as const;

export interface KartTrack {
  pts: { x: number; y: number }[];
  /** cumulative length at each point */
  len: number[];
  total: number;
  boosts: { i: number; x: number; y: number; a: number }[];
  oils: { x: number; y: number; r: number }[];
}

export function makeTrack(seed: number): KartTrack {
  const rng = createRng(seed);
  const cx = KT.W / 2;
  const cy = KT.H / 2;
  const rx = 920;
  const ry = 560;
  const harm = [2, 3, 4].map((k) => ({ k, a: (0.05 + rng.next() * 0.07) * (k === 2 ? 1.3 : 1), p: rng.next() * Math.PI * 2 }));
  const pts: { x: number; y: number }[] = [];
  const dir = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < KT.N; i++) {
    const th = dir * (i / KT.N) * Math.PI * 2 + Math.PI / 2;
    let f = 1;
    for (const h of harm) f += h.a * Math.cos(h.k * th + h.p);
    pts.push({ x: Math.round(cx + Math.cos(th) * rx * f), y: Math.round(cy + Math.sin(th) * ry * f) });
  }
  const len: number[] = [0];
  for (let i = 1; i <= KT.N; i++) {
    const a = pts[i - 1];
    const b = pts[i % KT.N];
    len.push(len[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = len[KT.N];
  const boosts: KartTrack['boosts'] = [];
  const used = new Set<number>();
  for (let k = 0; k < 5; k++) {
    const i = 20 + Math.floor(((k + rng.next() * 0.6) / 5) * (KT.N - 30));
    if (used.has(i)) continue;
    used.add(i);
    const p = pts[i];
    const q = pts[(i + 1) % KT.N];
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    const off = (rng.next() - 0.5) * KT.HALF;
    boosts.push({ i, x: Math.round(p.x - Math.sin(a) * off), y: Math.round(p.y + Math.cos(a) * off), a: Math.round(a * 100) / 100 });
  }
  const oils: KartTrack['oils'] = [];
  for (let k = 0; k < 4; k++) {
    const i = 15 + Math.floor(((k + 0.5 + rng.next() * 0.4) / 4) * (KT.N - 25));
    if (used.has(i)) continue;
    const p = pts[i];
    const q = pts[(i + 1) % KT.N];
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    const off = (rng.next() - 0.5) * KT.HALF * 1.2;
    oils.push({ x: Math.round(p.x - Math.sin(a) * off), y: Math.round(p.y + Math.cos(a) * off), r: 34 });
  }
  return { pts, len, total, boosts, oils };
}

/** Nearest centreline segment to (x, y), searching around a hint index. */
export function nearestOnTrack(t: KartTrack, x: number, y: number, hint = -1): { i: number; d: number; along: number } {
  let best = { i: 0, d: Infinity, along: 0 };
  const scan = (i: number) => {
    const a = t.pts[i];
    const b = t.pts[(i + 1) % KT.N];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const l2 = ex * ex + ey * ey || 1;
    const k = Math.max(0, Math.min(1, ((x - a.x) * ex + (y - a.y) * ey) / l2));
    const d = Math.hypot(x - (a.x + ex * k), y - (a.y + ey * k));
    if (d < best.d) best = { i, d, along: t.len[i] + Math.sqrt(l2) * k };
  };
  if (hint >= 0) for (let o = -10; o <= 10; o++) scan((hint + o + KT.N) % KT.N);
  if (hint < 0 || best.d > KT.HALF * 2.5) for (let i = 0; i < KT.N; i++) scan(i);
  return best;
}
