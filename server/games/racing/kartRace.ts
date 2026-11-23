// Tiny Kart Race: three laps on a generated loop. Karts accelerate on their own; steer with the
// joystick (absolute direction) or arrows. Boost pads, oil slicks, grass slows you down.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { KT, makeTrack, nearestOnTrack, type KartTrack } from '@shared/kartTrack';
import { collide, makeBody, r1, type Body } from '../../engine/arena';

const CAP_MS = 150_000;
const AFTER_FIRST_MS = 25_000;
const VMAX = 430;
const BOOST_V = 640;
const TURN = 3.4;

interface K {
  b: Body;
  h: number;
  sp: number;
  boostUntil: number;
  spinUntil: number;
  idx: number;
  lap: number;
  half: boolean;
  dist: number;
  finished: number;
  place: number;
  boosts: number;
  spins: number;
  bestLap: number;
  lapStart: number;
  offset: number;
}

interface S {
  seed: number;
  track: KartTrack;
  t0: number;
  endsAt: number;
  karts: Record<string, K>;
  inputs: Record<string, InputFrame>;
  places: number;
  fx: { k: 'boost' | 'spin' | 'bump'; x: number; y: number; at: number }[];
}

export const kartRace = defineGame<S>({
  id: 'kart-race',
  realtime: true,
  botDelay: [90, 150],
  setup(ctx) {
    const seed = ctx.rng.int(1, 2_000_000_000);
    const track = makeTrack(seed);
    const karts: Record<string, K> = {};
    // starting grid just behind the line
    const p0 = track.pts[0];
    const p1 = track.pts[1];
    const a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.ids.forEach((id, i) => {
      const row = Math.floor(i / 3);
      const col = (i % 3) - 1;
      const back = 60 + row * 62;
      const x = p0.x - Math.cos(a) * back - Math.sin(a) * col * 46;
      const y = p0.y - Math.sin(a) * back + Math.cos(a) * col * 46;
      karts[id] = { b: makeBody(id, x, y, KT.R), h: a, sp: 0, boostUntil: 0, spinUntil: 0, idx: KT.N - 1, lap: 0, half: true, dist: 0, finished: 0, place: 0, boosts: 0, spins: 0, bestLap: 0, lapStart: 0, offset: (ctx.rng.next() - 0.5) * 50 };
    });
    return { seed, track, t0: 0, endsAt: 0, karts, inputs: {}, places: 0, fx: [] };
  },
  start(s, ctx) {
    s.t0 = ctx.now() + 3000;
    s.endsAt = s.t0 + ctx.ms(CAP_MS);
    for (const k of Object.values(s.karts)) k.lapStart = s.t0;
    ctx.asset('kart:track', { seed: s.seed });
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now < s.t0) return;
    if (now >= s.endsAt) return ctx.end();
    const t = s.track;
    const racing = ctx.ids.filter((id) => !s.karts[id].finished);
    for (const id of racing) {
      const k = s.karts[id];
      const f = s.inputs[id];
      const near = nearestOnTrack(t, k.b.x, k.b.y, k.idx);
      const onGrass = near.d > KT.HALF;
      const spinning = k.spinUntil > now;
      if (spinning) k.h += 9 * dt;
      else if (f && Math.hypot(f.x, f.y) > 0.3) {
        // absolute steering: turn toward the stick direction
        const want = Math.atan2(f.y, f.x);
        let d = want - k.h;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const rate = TURN * dt * (0.55 + 0.45 * Math.min(1, k.sp / VMAX));
        k.h += Math.max(-rate, Math.min(rate, d));
      }
      const boosting = k.boostUntil > now;
      const vmax = (boosting ? BOOST_V : VMAX) * (onGrass ? 0.45 : 1) * (spinning ? 0.4 : 1);
      k.sp += Math.max(-900 * dt, Math.min(520 * dt, vmax - k.sp));
      const grip = onGrass ? 4 : 7;
      const dvx = Math.cos(k.h) * k.sp;
      const dvy = Math.sin(k.h) * k.sp;
      k.b.vx += (dvx - k.b.vx) * Math.min(1, grip * dt);
      k.b.vy += (dvy - k.b.vy) * Math.min(1, grip * dt);
      // pads and slicks
      for (const bo of t.boosts) {
        if (Math.hypot(k.b.x - bo.x, k.b.y - bo.y) < 46 && k.boostUntil < now + 600) {
          if (k.boostUntil < now) {
            k.boosts++;
            s.fx.push({ k: 'boost', x: bo.x, y: bo.y, at: now });
          }
          k.boostUntil = now + 1300;
        }
      }
      for (const o of t.oils) {
        if (!spinning && Math.hypot(k.b.x - o.x, k.b.y - o.y) < o.r + 10 && k.spinUntil < now - 1500) {
          k.spinUntil = now + 900;
          k.spins++;
          s.fx.push({ k: 'spin', x: r1(k.b.x), y: r1(k.b.y), at: now });
          ctx.event('spin', { id });
        }
      }
      k.idx = near.i;
    }
    collide(racing.map((id) => s.karts[id].b), 0.6, (a, b, impact) => {
      if (impact > 180 && s.fx.length < 30) s.fx.push({ k: 'bump', x: r1((a.x + b.x) / 2), y: r1((a.y + b.y) / 2), at: now });
    });
    for (const id of racing) {
      const k = s.karts[id];
      k.b.x = Math.max(KT.R, Math.min(KT.W - KT.R, k.b.x + k.b.vx * dt));
      k.b.y = Math.max(KT.R, Math.min(KT.H - KT.R, k.b.y + k.b.vy * dt));
      const near = nearestOnTrack(t, k.b.x, k.b.y, k.idx);
      const prev = k.idx;
      k.idx = near.i;
      if (k.idx > KT.N * 0.4 && k.idx < KT.N * 0.6) k.half = true;
      // crossing the line forwards completes a lap (only after visiting the far side)
      if (prev > KT.N - 15 && k.idx < 15 && k.half) {
        k.lap++;
        k.half = false;
        const lapMs = now - k.lapStart;
        k.lapStart = now;
        if (k.lap > 1 && (!k.bestLap || lapMs < k.bestLap)) k.bestLap = lapMs;
        if (k.lap > KT.LAPS) {
          k.finished = now - s.t0;
          k.place = ++s.places;
          ctx.event('finish', { id, place: k.place, ms: k.finished });
          if (k.place === 1) s.endsAt = Math.min(s.endsAt, now + ctx.ms(AFTER_FIRST_MS));
        } else if (k.lap > 1) ctx.event('lap', { id, lap: k.lap });
      }
      const lapsDone = Math.max(0, k.lap - 1);
      k.dist = lapsDone * t.total + (k.lap >= 1 ? near.along : near.along - t.total);
    }
    s.fx = s.fx.filter((f) => now - f.at < 700);
    if (ctx.ids.every((id) => s.karts[id].finished || !ctx.isConnected(id))) ctx.end();
  },
  pub(s, ctx) {
    const order = [...ctx.ids].sort((a, b) => rankKey(s.karts[b]) - rankKey(s.karts[a]));
    return {
      t0: s.t0,
      endsAt: s.endsAt,
      p: ctx.ids.map((id) => {
        const k = s.karts[id];
        return { id, x: r1(k.b.x), y: r1(k.b.y), a: Math.round(k.h * 100) / 100, lap: Math.max(1, Math.min(KT.LAPS, k.lap)), f: k.finished, pl: k.place, bo: k.boostUntil > ctx.now() ? 1 : 0, sp: k.spinUntil > ctx.now() ? 1 : 0, pos: order.indexOf(id) + 1 };
      }),
      fx: s.fx,
    };
  },
  bot(s, ctx, pid) {
    const k = s.karts[pid];
    if (k.finished || ctx.now() < s.t0) return { input: { x: 0, y: 0, b: 0 } };
    const t = s.track;
    const skill = ctx.diff(0.5, 0.72, 0.9);
    const look = Math.round(5 + (k.sp / VMAX) * 5);
    const p = t.pts[(k.idx + look) % KT.N];
    const q = t.pts[(k.idx + look + 1) % KT.N];
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    const off = k.offset * (1.2 - skill);
    const tx = p.x - Math.sin(a) * off;
    const ty = p.y + Math.cos(a) * off;
    const dx = tx - k.b.x;
    const dy = ty - k.b.y;
    const d = Math.hypot(dx, dy) || 1;
    const wob = (1 - skill) * 0.5;
    return { input: { x: dx / d + (Math.random() - 0.5) * wob, y: dy / d + (Math.random() - 0.5) * wob, b: 0 } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const total = s.track.total * KT.LAPS;
    for (const id of ctx.ids) {
      const k = s.karts[id];
      if (k.finished) {
        perfs[id] = {
          score: 10_000_000 - k.finished,
          perf: Math.min(1, 0.6 + 0.4 * Math.min(1, (total / 380) * 1000 / k.finished)),
          participated: ctx.acted(id),
          highlight: `Finished #${k.place} in ${(k.finished / 1000).toFixed(2)} s · best lap ${(k.bestLap / 1000).toFixed(2)} s`,
          bonuses: k.spins === 0 ? [{ label: 'Clean driver', pts: 25 }] : [],
        };
      } else {
        const prog = Math.max(0, Math.min(1, k.dist / total));
        perfs[id] = { score: Math.round(prog * 1_000_000), perf: prog * 0.55, participated: ctx.acted(id), highlight: `Lap ${Math.max(1, Math.min(KT.LAPS, k.lap))}/${KT.LAPS} · ${Math.round(prog * 100)}% of the race` };
      }
    }
    const records = Object.fromEntries(ctx.ids.filter((id) => s.karts[id].bestLap).map((id) => [id, [{ key: 'lap', label: 'Fastest kart lap', value: s.karts[id].bestLap, better: 'lower' as const, format: 'ms' as const }]]));
    return { perfs, records };
  },
});

function rankKey(k: K): number {
  return k.finished ? 1e9 - k.place : k.dist;
}
