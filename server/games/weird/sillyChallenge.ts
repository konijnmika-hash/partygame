// Silly Challenge: six quick physical challenges — mash, rub, hold for exactly four seconds,
// spin circles, stay inside a wandering circle, and tap an exact number of times. Each one is
// measured on the server and ranked separately.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';

export type Kind = 'mash' | 'rub' | 'hold' | 'spin' | 'statue' | 'exact';
const INTRO_MS = 2800;
const RESULT_MS = 3200;
const DUR: Record<Kind, number> = { mash: 5000, rub: 5000, hold: 7000, spin: 6000, statue: 7000, exact: 6500 };
const LOWER_BETTER: Record<Kind, boolean> = { mash: false, rub: false, hold: true, spin: false, statue: false, exact: true };
const HOLD_TARGET = 4000;

interface Ch { kind: Kind; target: number; seed: number }

interface S {
  chs: Ch[];
  i: number;
  phase: 'intro' | 'go' | 'result';
  goAt: number;
  deadline: number;
  vals: Record<string, number>;
  downAt: Record<string, number>;
  lastIn: Record<string, number>;
  lastTap: Record<string, number>;
  ranks: Record<string, number> | null;
  scores: Record<string, number>;
  firsts: Record<string, number>;
  timer: number | null;
}

export const sillyChallenge = defineGame<S>({
  id: 'silly-challenge',
  botDelay: [90, 160],
  setup(ctx) {
    const kinds = ctx.rng.shuffle<Kind>(['mash', 'rub', 'hold', 'spin', 'statue', 'exact']);
    return {
      chs: kinds.map((kind) => ({ kind, target: kind === 'exact' ? ctx.rng.int(12, 24) : kind === 'hold' ? HOLD_TARGET : 0, seed: ctx.rng.int(1, 1e6) })),
      i: -1,
      phase: 'intro',
      goAt: 0,
      deadline: 0,
      vals: {},
      downAt: {},
      lastIn: {},
      lastTap: {},
      ranks: null,
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      firsts: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || s.phase !== 'go') return;
    const ch = s.chs[s.i];
    const now = ctx.now();
    const elapsed = Math.max(0, now - s.goAt) / 1000;
    switch (ch.kind) {
      case 'mash':
      case 'exact':
        if (a.t !== 'tap' || now - (s.lastTap[pid] ?? 0) < 45) return;
        s.lastTap[pid] = now;
        s.vals[pid] = (s.vals[pid] ?? 0) + 1;
        break;
      case 'rub': {
        if (a.t !== 'rub' || typeof a.n !== 'number' || a.n <= 0 || a.n > 10) return;
        // nobody rubs faster than ~12 strokes a second
        s.vals[pid] = Math.min(Math.floor(elapsed * 12) + 1, (s.vals[pid] ?? 0) + Math.floor(a.n));
        break;
      }
      case 'spin': {
        if (a.t !== 'spin' || typeof a.r !== 'number' || !Number.isFinite(a.r)) return;
        const capped = Math.min(a.r, elapsed * 4 + 0.5);
        s.vals[pid] = Math.max(s.vals[pid] ?? 0, Math.round(capped * 100) / 100);
        break;
      }
      case 'hold':
        if (a.t === 'down' && s.downAt[pid] == null && s.vals[pid] == null) s.downAt[pid] = now - Math.min(150, ctx.rtt(pid) / 2);
        else if (a.t === 'up' && s.downAt[pid] != null && s.vals[pid] == null) {
          const dur = now - Math.min(150, ctx.rtt(pid) / 2) - s.downAt[pid];
          s.vals[pid] = Math.abs(dur - HOLD_TARGET);
        } else return;
        break;
      case 'statue': {
        // heartbeats while the finger is inside; gaps longer than 400 ms don't count
        if (a.t !== 'in') return;
        const last = s.lastIn[pid];
        if (a.v === true) {
          if (last != null && now - last <= 400) s.vals[pid] = (s.vals[pid] ?? 0) + (now - last);
          s.lastIn[pid] = now;
        } else {
          if (last != null && now - last <= 400) s.vals[pid] = (s.vals[pid] ?? 0) + (now - last);
          delete s.lastIn[pid];
        }
        break;
      }
    }
    ctx.markActed(pid);
    ctx.dirty();
  },
  pub(s) {
    const ch = s.chs[s.i];
    return {
      i: s.i,
      n: s.chs.length,
      phase: s.phase,
      goAt: s.goAt,
      deadline: s.deadline,
      kind: ch?.kind,
      target: ch?.target ?? 0,
      seed: ch?.seed ?? 0,
      dur: ch ? DUR[ch.kind] : 0,
      lowerBetter: ch ? LOWER_BETTER[ch.kind] : false,
      // live counters are only shown for the open-ended challenges
      live: ch && (ch.kind === 'mash' || ch.kind === 'rub' || ch.kind === 'spin') ? s.vals : null,
      vals: s.phase === 'result' ? s.vals : null,
      ranks: s.phase === 'result' ? s.ranks : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { mine: s.vals[pid] ?? null, holding: s.downAt[pid] != null && s.vals[pid] == null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'go') return null;
    const ch = s.chs[s.i];
    const skill = ctx.diff(0.45, 0.7, 0.9);
    const t = ctx.now() - s.goAt;
    switch (ch.kind) {
      case 'mash':
        return Math.random() < 0.5 + skill * 0.45 ? { action: { t: 'tap' } } : null;
      case 'exact': {
        const want = ch.target + (Math.random() < 1 - skill ? (Math.random() < 0.5 ? -1 : 1) : 0);
        return (s.vals[pid] ?? 0) < want && Math.random() < 0.6 ? { action: { t: 'tap' } } : null;
      }
      case 'rub':
        return Math.random() < 0.5 + skill * 0.4 ? { action: { t: 'rub', n: 1 } } : null;
      case 'spin':
        return { action: { t: 'spin', r: (s.vals[pid] ?? 0) + 0.15 + skill * 0.3 * Math.random() } };
      case 'hold': {
        if (s.downAt[pid] == null && s.vals[pid] == null && t > 400) return { action: { t: 'down' } };
        const held = s.downAt[pid] != null ? ctx.now() - s.downAt[pid] : 0;
        const aim = HOLD_TARGET + (Math.random() - 0.5) * (1 - skill) * 1600;
        return s.downAt[pid] != null && s.vals[pid] == null && held >= aim ? { action: { t: 'up' } } : null;
      }
      case 'statue':
        return { action: { t: 'in', v: Math.random() < 0.55 + skill * 0.4 } };
    }
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const max = s.chs.length * 100;
    for (const id of ctx.ids) {
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / max),
        participated: ctx.acted(id),
        highlight: `${s.firsts[id]} challenge win${s.firsts[id] === 1 ? '' : 's'} · ${s.scores[id]} challenge points`,
      };
    }
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= s.chs.length) return ctx.end();
  s.phase = 'intro';
  s.vals = {};
  s.downAt = {};
  s.lastIn = {};
  s.lastTap = {};
  s.ranks = null;
  s.goAt = ctx.now() + INTRO_MS;
  s.deadline = s.goAt;
  ctx.cancel(s.timer);
  ctx.dirty();
  s.timer = ctx.after(INTRO_MS, () => {
    s.phase = 'go';
    const ch = s.chs[s.i];
    s.deadline = ctx.now() + DUR[ch.kind];
    ctx.dirty();
    s.timer = ctx.after(DUR[ch.kind], () => score(s, ctx));
  });
}

function score(s: S, ctx: GameCtx) {
  const ch = s.chs[s.i];
  const lower = LOWER_BETTER[ch.kind];
  // still holding when time ran out: that's a long way from four seconds
  if (ch.kind === 'hold') for (const [id, at] of Object.entries(s.downAt)) if (s.vals[id] == null) s.vals[id] = Math.abs(ctx.now() - at - HOLD_TARGET);
  if (ch.kind === 'exact') for (const id of Object.keys(s.vals)) s.vals[id] = Math.abs(s.vals[id] - ch.target);
  const entries = Object.entries(s.vals).sort((a, b) => (lower ? a[1] - b[1] : b[1] - a[1]));
  s.ranks = {};
  let rank = 0;
  entries.forEach(([id, v], k) => {
    if (k === 0 || v !== entries[k - 1][1]) rank = k + 1;
    s.ranks![id] = rank;
    const pts = Math.max(20, 100 - (rank - 1) * Math.round(80 / Math.max(1, entries.length - 1)));
    s.scores[id] += pts;
    if (rank === 1) s.firsts[id]++;
  });
  s.phase = 'result';
  s.deadline = ctx.now() + RESULT_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(RESULT_MS, () => next(s, ctx));
}
