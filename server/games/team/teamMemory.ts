// Team Memory: a pattern flashes, but every teammate only sees their share of it. Rebuild the
// whole pattern together on the team board. Patterns grow each level.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';

const LEVELS = 4;
const SHOW_MS = 3000;
const BUILD_MS = 15_000;
const REVEAL_MS = 3200;

interface S {
  level: number;
  phase: 'show' | 'build' | 'reveal';
  deadline: number;
  size: number;
  pattern: number[];
  teams: string[][];
  /** per team: which cells each member saw */
  shares: Record<string, number[]>;
  boards: number[][];
  done: boolean[];
  teamScores: number[];
  lastScores: number[];
  toggles: Record<string, number>;
  correctToggles: Record<string, number>;
  timer: number | null;
}

export const teamMemory = defineGame<S>({
  id: 'team-memory',
  botDelay: [350, 800],
  setup(ctx) {
    const teams = teamList(ctx);
    return {
      level: -1,
      phase: 'show',
      deadline: 0,
      size: 5,
      pattern: [],
      teams,
      shares: {},
      boards: teams.map(() => []),
      done: teams.map(() => false),
      teamScores: teams.map(() => 0),
      lastScores: teams.map(() => 0),
      toggles: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      correctToggles: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || s.phase !== 'build') return;
    const t = teamOf(ctx, pid);
    if (s.done[t]) return;
    if (a.t === 'tog') {
      const i = a.i;
      if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= s.size * s.size) return;
      ctx.markActed(pid);
      const b = s.boards[t];
      const k = b.indexOf(i);
      if (k >= 0) b.splice(k, 1);
      else b.push(i);
      s.toggles[pid]++;
      if (k < 0 && s.pattern.includes(i)) s.correctToggles[pid]++;
      ctx.dirty();
    } else if (a.t === 'done') {
      ctx.markActed(pid);
      s.done[t] = true;
      if (s.teams.every((m, k) => s.done[k] || !m.some((id) => ctx.isConnected(id)))) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
      ctx.dirty();
    }
  },
  pub(s) {
    return {
      level: s.level,
      levels: LEVELS,
      phase: s.phase,
      deadline: s.deadline,
      size: s.size,
      count: s.pattern.length,
      teams: s.teams,
      done: s.done,
      teamScores: s.teamScores,
      pattern: s.phase === 'reveal' ? s.pattern : null,
      boards: s.phase === 'reveal' ? s.boards : null,
      lastScores: s.phase === 'reveal' ? s.lastScores : null,
    };
  },
  priv(s, ctx, pid) {
    const t = teamOf(ctx, pid);
    return { share: s.phase === 'show' ? s.shares[pid] ?? [] : null, board: s.boards[t] ?? [] };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'build') return null;
    const t = teamOf(ctx, pid);
    if (s.done[t]) return null;
    const skill = ctx.diff(0.55, 0.75, 0.9);
    const mine = s.shares[pid] ?? [];
    const b = s.boards[t];
    const missing = mine.filter((i) => !b.includes(i));
    if (missing.length) {
      // sometimes misremember a cell next to the right one
      let i = missing[0];
      if (Math.random() > skill) i = Math.max(0, Math.min(s.size * s.size - 1, i + (Math.random() < 0.5 ? 1 : -1)));
      return { action: { t: 'tog', i } };
    }
    // when every teammate's share looks placed, call it done
    const allPlaced = s.teams[t].every((id) => (s.shares[id] ?? []).every((i) => b.includes(i)));
    if (allPlaced && Math.random() < 0.6) return { action: { t: 'done' } };
    return null;
  },
  results(s, ctx) {
    return teamResults(ctx, s.teamScores, {
      great: LEVELS * 100,
      individual: s.correctToggles,
      highlight: (id, t) => `Team ${s.teamScores[t]} pts · you placed ${s.correctToggles[id]} correct cell${s.correctToggles[id] === 1 ? '' : 's'}`,
    });
  },
});

function next(s: S, ctx: GameCtx) {
  s.level++;
  if (s.level >= LEVELS) return ctx.end();
  s.size = s.level >= 2 ? 6 : 5;
  const count = [6, 8, 10, 13][s.level];
  s.pattern = ctx.rng.sample([...Array(s.size * s.size).keys()], count);
  s.shares = {};
  // deal the pattern cells out to each team's members
  for (const members of s.teams) {
    const order = ctx.rng.shuffle(members);
    s.pattern.forEach((cell, k) => {
      const id = order[k % order.length];
      (s.shares[id] ??= []).push(cell);
    });
  }
  s.boards = s.teams.map(() => []);
  s.done = s.teams.map(() => false);
  s.phase = 'show';
  s.deadline = ctx.now() + SHOW_MS;
  ctx.cancel(s.timer);
  ctx.dirty();
  s.timer = ctx.after(SHOW_MS, () => {
    s.phase = 'build';
    s.deadline = ctx.now() + ctx.ms(BUILD_MS);
    ctx.dirty();
    s.timer = ctx.after(ctx.ms(BUILD_MS), () => reveal(s, ctx));
  });
}

function reveal(s: S, ctx: GameCtx) {
  if (s.phase === 'reveal') return;
  s.lastScores = s.boards.map((b) => {
    const hit = b.filter((i) => s.pattern.includes(i)).length;
    const miss = b.length - hit;
    return Math.max(0, Math.round(((hit - miss) / s.pattern.length) * 100));
  });
  s.lastScores.forEach((v, t) => (s.teamScores[t] += v));
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
}
