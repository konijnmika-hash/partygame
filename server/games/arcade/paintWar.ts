// Paint Wars: your Bloop paints the floor in your colour as it rolls. Paint over rivals to steal
// their turf; you move faster on your own colour. Most coverage at the buzzer wins.
import { defineGame } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, clampRect, collide, dash, integrate, makeBody, r1, seek, steer, type Body } from '../../engine/arena';

export const PW = { W: 1000, H: 700, CELL: 25, R: 24 } as const;
const COLS = PW.W / PW.CELL;
const ROWS = PW.H / PW.CELL;
const DURATION = 50_000;
const DASH_CD = 1500;

interface P { b: Body; idx: number; dashAt: number; painted: number; stolen: number; wander: { x: number; y: number; until: number } }

interface S {
  endsAt: number;
  grid: number[];
  p: Record<string, P>;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
}

export const paintWar = defineGame<S>({
  id: 'paint-war',
  realtime: true,
  pubEvery: 2,
  botDelay: [90, 150],
  setup(ctx) {
    const p: Record<string, P> = {};
    const n = ctx.ids.length;
    ctx.ids.forEach((id, i) => {
      const a = (i / n) * Math.PI * 2;
      p[id] = { b: makeBody(id, PW.W / 2 + Math.cos(a) * 320, PW.H / 2 + Math.sin(a) * 230, PW.R), idx: i + 1, dashAt: -99999, painted: 0, stolen: 0, wander: { x: 0, y: 0, until: 0 } };
    });
    return { endsAt: 0, grid: new Array(COLS * ROWS).fill(0), p, inputs: {}, btn: new Buttons() };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(DURATION);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (now >= s.endsAt) return ctx.end();
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const c = cellAt(pl.b.x, pl.b.y);
      const onOwn = c >= 0 && s.grid[c] === pl.idx;
      const f = s.inputs[id];
      steer(pl.b, f, dt, 1500, onOwn ? 340 : 270, 3.6);
      if (s.btn.pressed(id, f) && now - pl.dashAt > DASH_CD) {
        pl.dashAt = now;
        dash(pl.b, f, 520);
      }
    }
    collide(ctx.ids.map((id) => s.p[id].b), 0.9);
    for (const id of ctx.ids) {
      const pl = s.p[id];
      integrate(pl.b, dt);
      clampRect(pl.b, 0, 0, PW.W, PW.H, 0.5);
      // paint a small disc around the Bloop
      const cx = Math.floor(pl.b.x / PW.CELL);
      const cy = Math.floor(pl.b.y / PW.CELL);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx * dx + dy * dy > 1) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const k = y * COLS + x;
        const prev = s.grid[k];
        if (prev === pl.idx) continue;
        if (prev) pl.stolen++;
        s.grid[k] = pl.idx;
        pl.painted++;
      }
    }
  },
  pub(s, ctx) {
    const counts = coverage(s);
    return {
      endsAt: s.endsAt,
      cols: COLS,
      rows: ROWS,
      // one character per cell: 0 = unpainted, 1..n = player index
      grid: s.grid.map((v) => v.toString(36)).join(''),
      p: ctx.ids.map((id) => ({ id, x: r1(s.p[id].b.x), y: r1(s.p[id].b.y), i: s.p[id].idx })),
      scores: Object.fromEntries(ctx.ids.map((id) => [id, Math.round(((counts[s.p[id].idx] ?? 0) / s.grid.length) * 1000) / 10])),
    };
  },
  bot(s, ctx, pid) {
    const me = s.p[pid];
    const now = ctx.now();
    const skill = ctx.diff(0.45, 0.7, 0.9);
    // head for the nearest region that is not ours yet (re-plan now and then)
    if (now > me.wander.until) {
      let best = { x: PW.W / 2, y: PW.H / 2, sc: -Infinity };
      for (let k = 0; k < 14; k++) {
        const x = 40 + Math.random() * (PW.W - 80);
        const y = 40 + Math.random() * (PW.H - 80);
        const c = cellAt(x, y);
        const owner = s.grid[c];
        const d = Math.hypot(x - me.b.x, y - me.b.y);
        const sc = (owner === me.idx ? -300 : owner ? 120 * skill : 200) - d * 0.6;
        if (sc > best.sc) best = { x, y, sc };
      }
      me.wander = { x: best.x, y: best.y, until: now + 900 + Math.random() * 900 };
    }
    return { input: seek(me.b, me.wander, 0.35) };
  },
  results(s, ctx) {
    const counts = coverage(s);
    const total = s.grid.length;
    const best = Math.max(1, ...ctx.ids.map((id) => counts[s.p[id].idx] ?? 0));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const c = counts[s.p[id].idx] ?? 0;
      perfs[id] = {
        score: c,
        perf: Math.min(1, c / best),
        participated: ctx.acted(id),
        highlight: `${Math.round((c / total) * 100)}% of the floor · stole ${s.p[id].stolen} tiles`,
      };
    }
    return { perfs };
  },
});

function cellAt(x: number, y: number): number {
  const cx = Math.floor(x / PW.CELL);
  const cy = Math.floor(y / PW.CELL);
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return -1;
  return cy * COLS + cx;
}

function coverage(s: S): Record<number, number> {
  const out: Record<number, number> = {};
  for (const v of s.grid) if (v) out[v] = (out[v] ?? 0) + 1;
  return out;
}
