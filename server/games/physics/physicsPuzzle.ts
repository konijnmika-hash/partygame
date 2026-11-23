// Physics Puzzle Race: place your ramps so the ball rolls into the cup. Everybody solves the same
// generated puzzle; the server re-runs every attempt with the shared deterministic simulation.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';
import { generateLevel, simulate, validRamp, type PuzzleLevel, type Ramp } from '@shared/physicsPuzzle';

const PUZZLES = 3;
const TRY_COOLDOWN = 900;
const REVEAL_MS = 5000;
const PLACE_PTS = [100, 85, 72, 62, 55];

interface PState {
  tries: number;
  solvedAt: number | null;
  place: number;
  last: { ok: boolean; reason: string; at: number; ramps: Ramp[] } | null;
  lastTryAt: number;
}

interface S {
  i: number;
  phase: 'solve' | 'reveal';
  deadline: number;
  startedAt: number;
  levels: { level: PuzzleLevel; solution: Ramp[] }[];
  ps: Record<string, PState>[];
  scores: Record<string, number>;
  solvedCount: Record<string, number>;
  timer: number | null;
  botPlan: Record<string, { at: number; exact: boolean }[]>;
}

export const physicsPuzzle = defineGame<S>({
  id: 'physics-puzzle',
  botDelay: [400, 800],
  setup(ctx) {
    const counts = [1, 2, ctx.diff(2, 2, 3)];
    const levels = counts.map((k, i) => generateLevel(ctx.rng.fork(`pz${i}`), k));
    return {
      i: -1,
      phase: 'solve',
      deadline: 0,
      startedAt: 0,
      levels,
      ps: [],
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      solvedCount: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
      botPlan: {},
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'try' || s.phase !== 'solve') return;
    const st = s.ps[s.i][pid];
    if (!st || st.solvedAt != null) return;
    const now = ctx.now();
    if (now - st.lastTryAt < TRY_COOLDOWN) return;
    const lvl = s.levels[s.i].level;
    if (!Array.isArray(a.r) || a.r.length > lvl.ramps || !a.r.every(validRamp)) return;
    const ramps = a.r as Ramp[];
    st.lastTryAt = now;
    st.tries++;
    ctx.markActed(pid);
    const res = simulate(lvl, ramps);
    st.last = { ok: res.ok, reason: res.reason, at: now, ramps };
    if (res.ok) {
      const place = Object.values(s.ps[s.i]).filter((p) => p.solvedAt != null).length;
      st.solvedAt = now - s.startedAt;
      st.place = place + 1;
      const total = s.deadline - s.startedAt;
      const speed = Math.round(40 * Math.max(0, 1 - st.solvedAt / total));
      s.scores[pid] += (PLACE_PTS[place] ?? 50) + speed;
      s.solvedCount[pid]++;
      ctx.event('solved', { id: pid, place: st.place, ms: st.solvedAt });
      const everyone = ctx.ids.filter((id) => ctx.isConnected(id)).every((id) => s.ps[s.i][id].solvedAt != null);
      if (everyone) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(1500, () => reveal(s, ctx));
      }
    }
    ctx.dirty();
  },
  pub(s) {
    const cur = s.levels[s.i];
    const ps = s.ps[s.i] ?? {};
    return {
      i: s.i,
      n: PUZZLES,
      phase: s.phase,
      deadline: s.deadline,
      level: cur?.level ?? null,
      solved: Object.entries(ps).filter(([, p]) => p.solvedAt != null).map(([id, p]) => ({ id, ms: p.solvedAt, place: p.place })),
      tries: Object.fromEntries(Object.entries(ps).map(([id, p]) => [id, p.tries])),
      solution: s.phase === 'reveal' ? cur.solution : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    const st = s.ps[s.i]?.[pid];
    if (!st) return null;
    return { tries: st.tries, solved: st.solvedAt != null, last: st.last };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'solve') return null;
    const st = s.ps[s.i][pid];
    if (!st || st.solvedAt != null) return null;
    const plan = s.botPlan[pid];
    const now = ctx.now();
    if (!plan?.length || now < plan[0].at) return null;
    const step = plan.shift()!;
    const sol = s.levels[s.i].solution;
    const ramps: Ramp[] = step.exact
      ? sol.map((r) => [...r] as Ramp)
      : sol.map((r) => [clampI(r[0] + ctx.rng.int(-60, 60), 30, 770), clampI(r[1] + ctx.rng.int(-40, 40), 70, 580), clampI(r[2] + ctx.rng.int(-2, 2), -6, 6)] as Ramp);
    return { action: { t: 'try', r: ramps } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const solved = s.solvedCount[id];
      const tries = s.ps.reduce((a, p) => a + (p[id]?.tries ?? 0), 0);
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / (PUZZLES * 125)),
        participated: ctx.acted(id),
        highlight: `${solved}/${PUZZLES} puzzles solved · ${tries} tr${tries === 1 ? 'y' : 'ies'}`,
        bonuses: solved === PUZZLES ? [{ label: 'Solved them all', pts: 40 }] : [],
      };
    }
    return { perfs };
  },
});

function clampI(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= PUZZLES) return ctx.end();
  const now = ctx.now();
  const limit = ctx.ms(ctx.diff(55_000, 45_000, 38_000) + s.i * 5000);
  s.phase = 'solve';
  s.startedAt = now;
  s.deadline = now + limit;
  s.ps[s.i] = Object.fromEntries(ctx.ids.map((id) => [id, { tries: 0, solvedAt: null, place: 0, last: null, lastTryAt: 0 }]));
  // bots: a couple of near-misses, then the real solution at a skill-dependent time
  for (const p of ctx.players) {
    if (!p.isBot) continue;
    const solveAt = now + limit * ctx.diff(0.75, 0.55, 0.38) * (0.6 + ctx.rng.next() * 0.7);
    const plan: { at: number; exact: boolean }[] = [];
    for (let t = now + 5000 + ctx.rng.int(0, 3000); t < solveAt - 2000; t += 4000 + ctx.rng.int(0, 4000)) plan.push({ at: t, exact: false });
    if (ctx.rng.chance(ctx.diff(0.7, 0.85, 0.95))) plan.push({ at: solveAt, exact: true });
    s.botPlan[p.id] = plan;
  }
  ctx.cancel(s.timer);
  s.timer = ctx.after(limit, () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  if (s.phase === 'reveal') return;
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
  ctx.dirty();
}
