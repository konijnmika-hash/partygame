// Cooperative Puzzle: every team gets the same scrambled picture. Tap two pieces to swap them;
// pieces in the right place lock. Teammates work on the same board. First team to finish wins.
import { defineGame } from '../../engine/types';
import { isObj } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';

const TIME_MS = 110_000;
const SWAP_GAP = 120;

interface S {
  seed: number;
  n: number;
  boards: number[][];
  teams: string[][];
  finished: (number | null)[];
  finishMs: (number | null)[];
  places: number;
  startedAt: number;
  endsAt: number;
  swaps: Record<string, number>;
  good: Record<string, number>;
  lastSwap: Record<string, number>;
}

function correct(b: number[]): number {
  let n = 0;
  for (let i = 0; i < b.length; i++) if (b[i] === i) n++;
  return n;
}

export const coopPuzzle = defineGame<S>({
  id: 'coop-puzzle',
  botDelay: [1800, 3200],
  setup(ctx) {
    const n = ctx.diff(4, 5, 6);
    // one scramble shared by every team (no piece starts in place)
    let perm = ctx.rng.shuffle([...Array(n * n).keys()]);
    for (let tries = 0; tries < 20 && correct(perm) > 0; tries++) perm = ctx.rng.shuffle(perm);
    const teams = teamList(ctx);
    return {
      seed: ctx.rng.int(1, 1_000_000),
      n,
      boards: teams.map(() => [...perm]),
      teams,
      finished: teams.map(() => null),
      finishMs: teams.map(() => null),
      places: 0,
      startedAt: 0,
      endsAt: 0,
      swaps: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      good: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      lastSwap: {},
    };
  },
  start(s, ctx) {
    s.startedAt = ctx.now();
    s.endsAt = s.startedAt + ctx.ms(TIME_MS);
    ctx.after(ctx.ms(TIME_MS), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'swap') return;
    const t = teamOf(ctx, pid);
    if (s.finished[t] != null) return;
    const b = s.boards[t];
    const i = a.a;
    const j = a.b;
    if (![i, j].every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < b.length) || i === j) return;
    if (b[i] === i || b[j] === j) return; // locked pieces stay put
    const now = ctx.now();
    if (now - (s.lastSwap[pid] ?? 0) < SWAP_GAP) return;
    s.lastSwap[pid] = now;
    ctx.markActed(pid);
    const before = correct(b);
    [b[i], b[j]] = [b[j], b[i]];
    s.swaps[pid]++;
    const gained = correct(b) - before;
    if (gained > 0) s.good[pid] += gained;
    if (correct(b) === b.length) {
      s.finished[t] = ++s.places;
      s.finishMs[t] = now - s.startedAt;
      ctx.event('solved', { team: t, place: s.places });
      if (s.finished.every((f, k) => f != null || !s.teams[k].some((id) => ctx.isConnected(id)))) ctx.after(1200, () => ctx.end());
    }
    ctx.dirty();
  },
  pub(s) {
    return { seed: s.seed, n: s.n, boards: s.boards, teams: s.teams, finished: s.finished, endsAt: s.endsAt };
  },
  bot(s, ctx, pid) {
    const t = teamOf(ctx, pid);
    const b = s.boards[t];
    if (s.finished[t] != null) return null;
    const skill = ctx.diff(0.45, 0.65, 0.85);
    const wrong = b.map((p, i) => (p !== i ? i : -1)).filter((i) => i >= 0);
    if (!wrong.length) return null;
    const i = wrong[Math.floor(Math.random() * wrong.length)];
    // smart move: bring the piece that belongs at i into place; otherwise a random swap
    if (Math.random() < skill) return { action: { t: 'swap', a: i, b: b.indexOf(i) } };
    const j = wrong[Math.floor(Math.random() * wrong.length)];
    return j !== i ? { action: { t: 'swap', a: i, b: j } } : null;
  },
  results(s, ctx) {
    const total = s.n * s.n;
    const scores = s.teams.map((_, t) => {
      const done = correct(s.boards[t]) / total;
      if (s.finished[t] == null) return Math.round(done * 60);
      const speed = Math.max(0, 1 - (s.finishMs[t] ?? TIME_MS) / TIME_MS);
      return 100 + Math.round(speed * 60) + (s.finished[t] === 1 ? 30 : 0);
    });
    return teamResults(ctx, scores, {
      great: 190,
      individual: s.good,
      highlight: (id, t) => `${s.finished[t] ? `Solved #${s.finished[t]} in ${((s.finishMs[t] ?? 0) / 1000).toFixed(1)} s` : `${correct(s.boards[t])}/${total} pieces`} · you placed ${s.good[id]}`,
    });
  },
});

