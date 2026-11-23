// Wobbly Tower: players take turns dropping a swinging block onto ONE shared tower. The tower
// is checked for static balance after every drop: if the blocks above any level lean past its
// edge, it topples — and the player who dropped the last block loses big.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';

export const WT = { BLOCK_H: 44, BASE_W: 240, BLOCK_W: 150, PERFECT: 7 } as const;
const TURN_MS = 7000;
const DROP_MS = 800;
const TOPPLE_MS = 2600;
const MISS_PTS = -15;
const TOPPLE_PTS = -70;
const SURVIVE_PTS = 12;

export interface Block {
  x: number;
  w: number;
  c: number;
  by: string | null;
}

type ResultKind = 'place' | 'perfect' | 'miss' | 'topple';

interface S {
  order: string[];
  turn: number;
  total: number;
  phase: 'aim' | 'drop' | 'topple' | 'over';
  deadline: number;
  hook: { t0: number; period: number; amp: number };
  tower: Block[];
  drop: { x: number; w: number; c: number; pid: string; at: number; kind: ResultKind; level: number } | null;
  last: { kind: ResultKind; x: number; pid: string; pts: number; at: number; level: number } | null;
  fall: { dir: number; level: number } | null;
  towers: number;
  best: number;
  scores: Record<string, number>;
  stats: Record<string, { placed: number; perfect: number; topples: number; misses: number }>;
  timer: number | null;
  colorSeq: number;
}

export function hookX(h: S['hook'], t: number): number {
  return h.amp * Math.sin((2 * Math.PI * (t - h.t0)) / h.period);
}

/** Largest lean ratio in the tower (0 = perfectly centred, >=1 = topples). Also returns the failing level. */
export function towerLean(tower: Block[]): { lean: number; level: number; dir: number } {
  let worst = 0;
  let level = -1;
  let dir = 0;
  let sum = 0;
  let n = 0;
  for (let i = tower.length - 1; i >= 1; i--) {
    sum += tower[i].x;
    n++;
    const com = sum / n;
    const below = tower[i - 1];
    const r = Math.abs(com - below.x) / (below.w / 2);
    if (r > worst) {
      worst = r;
      level = i - 1;
      dir = com > below.x ? 1 : -1;
    }
  }
  return { lean: worst, level, dir };
}

function freshTower(): Block[] {
  return [{ x: 0, w: WT.BASE_W, c: 0, by: null }];
}

export const wobblyTower = defineGame<S>({
  id: 'wobbly-tower',
  botDelay: [110, 200],
  setup(ctx) {
    const n = ctx.ids.length;
    const per = n <= 2 ? 7 : n <= 4 ? 5 : n <= 6 ? 4 : 3;
    return {
      order: ctx.rng.shuffle(ctx.ids),
      turn: -1,
      total: per * n,
      phase: 'aim',
      deadline: 0,
      hook: { t0: 0, period: 2400, amp: 170 },
      tower: freshTower(),
      drop: null,
      last: null,
      fall: null,
      towers: 1,
      best: 0,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      stats: Object.fromEntries(ctx.ids.map((id) => [id, { placed: 0, perfect: 0, topples: 0, misses: 0 }])),
      timer: null,
      colorSeq: 0,
    };
  },
  start(s, ctx) {
    nextTurn(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'drop' || s.phase !== 'aim') return;
    if (pid !== current(s)) return;
    const now = ctx.now();
    const window = Math.min(450, ctx.rtt(pid) + 120);
    let at = typeof a.at === 'number' && Number.isFinite(a.at) ? a.at : now - ctx.rtt(pid) / 2;
    at = Math.max(now - window, Math.min(now, at));
    ctx.markActed(pid);
    doDrop(s, ctx, pid, at);
  },
  pub(s, ctx) {
    const lean = towerLean(s.tower);
    return {
      phase: s.phase,
      turn: s.turn,
      total: s.total,
      current: s.phase === 'aim' ? current(s) : s.drop?.pid ?? null,
      deadline: s.deadline,
      hook: s.hook,
      nextW: WT.BLOCK_W,
      nextC: s.colorSeq % 8,
      tower: s.tower,
      lean: Math.min(1.5, Math.round(lean.lean * 100) / 100),
      leanDir: lean.dir,
      drop: s.drop,
      last: s.last,
      fall: s.fall,
      best: s.best,
      scores: s.scores,
      order: s.order,
    };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'aim' || current(s) !== pid) return null;
    const now = ctx.now();
    if (now < s.hook.t0 + 600) return null;
    const top = s.tower[s.tower.length - 1];
    // aim to pull the tower's centre of mass back over the base
    const lean = towerLean(s.tower);
    const target = top.x - lean.dir * Math.min(40, lean.lean * 30);
    const skill = ctx.diff(0.5, 0.72, 0.9);
    // search the last 300 ms for the moment the hook was closest to the target
    let best = now;
    let bd = Infinity;
    for (let t = now - 300; t <= now; t += 10) {
      const d = Math.abs(hookX(s.hook, t) - target);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    const tol = 6 + (1 - skill) * 40;
    if (bd > tol && now < s.deadline - 900) return null;
    const jitter = (Math.random() - 0.5) * (1 - skill) * 160;
    return { action: { t: 'drop', at: best + jitter } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const per = s.total / Math.max(1, ctx.ids.length);
    for (const id of ctx.ids) {
      const st = s.stats[id];
      perfs[id] = {
        score: s.scores[id],
        perf: Math.max(0, Math.min(1, (s.scores[id] + 20) / (per * 32))),
        participated: ctx.acted(id),
        highlight: `${st.placed} placed · ${st.perfect} perfect · ${st.topples ? `💥 toppled ${st.topples}×` : 'never toppled it'}`,
        bonuses: st.topples === 0 && st.placed >= 2 ? [{ label: 'Steady hands', pts: 30 }] : [],
      };
    }
    return {
      perfs,
      summary: [`🏗️ Tallest tower: ${s.best} block${s.best === 1 ? '' : 's'}`, s.towers > 1 ? `💥 The tower fell ${s.towers - 1} time${s.towers === 2 ? '' : 's'}` : '🙌 The tower never fell!'],
      records: Object.fromEntries(ctx.ids.map((id) => [id, [{ key: 'perfect', label: 'Perfect drops in one game', value: s.stats[id].perfect, better: 'higher' as const, format: 'int' as const }]])),
    };
  },
});

function current(s: S): string {
  return s.order[s.turn % s.order.length];
}

function nextTurn(s: S, ctx: GameCtx, skipped = 0) {
  ctx.cancel(s.timer);
  s.turn++;
  s.drop = null;
  s.fall = null;
  if (s.turn >= s.total) {
    s.phase = 'over';
    ctx.dirty();
    s.timer = ctx.after(1800, () => ctx.end());
    return;
  }
  const pid = current(s);
  if (!ctx.isConnected(pid) && skipped < s.order.length) return nextTurn(s, ctx, skipped + 1);
  const height = s.tower.length - 1;
  s.phase = 'aim';
  s.hook = {
    t0: ctx.now() + 300 - ctx.rng.int(0, 2000),
    period: Math.round(ctx.diff(2700, 2300, 1900) * Math.max(0.55, 1 - 0.035 * height)),
    amp: 165 + Math.min(70, height * 5),
  };
  s.deadline = ctx.now() + ctx.ms(TURN_MS);
  s.timer = ctx.after(ctx.ms(TURN_MS), () => doDrop(s, ctx, pid, ctx.now()));
  ctx.dirty();
}

function doDrop(s: S, ctx: GameCtx, pid: string, at: number) {
  if (s.phase !== 'aim') return;
  ctx.cancel(s.timer);
  const x = Math.round(hookX(s.hook, at) * 10) / 10;
  const top = s.tower[s.tower.length - 1];
  const w = WT.BLOCK_W;
  const dx = x - top.x;
  const overlap = (w + top.w) / 2 - Math.abs(dx);
  let kind: ResultKind;
  let px = x;
  if (overlap < w * 0.25) kind = 'miss';
  else if (Math.abs(dx) <= WT.PERFECT) {
    kind = 'perfect';
    px = top.x;
  } else kind = 'place';
  let level = s.tower.length;
  if (kind !== 'miss') {
    const test = [...s.tower, { x: px, w, c: 0, by: pid }];
    const lean = towerLean(test);
    if (lean.lean > 1) {
      kind = 'topple';
      level = lean.level;
    }
  }
  s.drop = { x: px, w, c: s.colorSeq % 8, pid, at: ctx.now(), kind, level };
  s.phase = 'drop';
  ctx.dirty();
  s.timer = ctx.after(DROP_MS, () => resolve(s, ctx));
}

function resolve(s: S, ctx: GameCtx) {
  const d = s.drop;
  if (!d) return nextTurn(s, ctx);
  const st = s.stats[d.pid];
  let pts = 0;
  if (d.kind === 'miss') {
    pts = MISS_PTS;
    st.misses++;
  } else if (d.kind === 'topple') {
    pts = TOPPLE_PTS;
    st.topples++;
    s.tower.push({ x: d.x, w: d.w, c: d.c, by: d.pid });
    for (const id of ctx.ids) if (id !== d.pid) s.scores[id] += SURVIVE_PTS;
  } else {
    const level = s.tower.length;
    pts = 10 + level * 2 + (d.kind === 'perfect' ? 15 : 0);
    st.placed++;
    if (d.kind === 'perfect') st.perfect++;
    s.tower.push({ x: d.x, w: d.w, c: d.c, by: d.pid });
    s.best = Math.max(s.best, s.tower.length - 1);
    s.colorSeq++;
  }
  s.scores[d.pid] += pts;
  s.last = { kind: d.kind, x: d.x, pid: d.pid, pts, at: ctx.now(), level: d.level };
  if (d.kind === 'topple') {
    const lean = towerLean(s.tower);
    s.fall = { dir: lean.dir || 1, level: Math.max(0, lean.level) };
    s.phase = 'topple';
    s.drop = null;
    ctx.event('topple', { pid: d.pid });
    ctx.dirty();
    s.timer = ctx.after(TOPPLE_MS, () => {
      s.tower = freshTower();
      s.towers++;
      s.colorSeq++;
      nextTurn(s, ctx);
    });
    return;
  }
  nextTurn(s, ctx);
}
