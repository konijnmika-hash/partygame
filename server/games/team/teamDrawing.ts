// Team Drawing: each team draws the same prompt together on its own shared canvas (strokes are
// only shown to teammates while drawing). Then everyone rates the other teams' drawings.
import { defineGame, type GameCtx } from '../../engine/types';
import { CanvasStore, botScribble, relay } from '../../engine/drawing';
import { isObj } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';
import { DRAW_WORDS_EASY, DRAW_WORDS_MEDIUM } from '../../content/drawing';

const ROUNDS = 2;
const DRAW_MS = 55_000;
const RATE_MS = 18_000;
const RESULT_MS = 5000;

interface S {
  r: number;
  phase: 'draw' | 'rate' | 'result';
  deadline: number;
  prompts: string[];
  teams: string[][];
  canvas: CanvasStore;
  ratings: Record<string, Record<number, number>>;
  teamScores: number[];
  lastAvg: number[];
  strokes: Record<string, number>;
  botSeq: number;
  timer: number | null;
}

export const teamDrawing = defineGame<S>({
  id: 'team-drawing',
  botDelay: [900, 2000],
  setup(ctx) {
    const teams = teamList(ctx);
    return {
      r: -1,
      phase: 'draw',
      deadline: 0,
      prompts: ctx.rng.sample(ctx.difficulty === 'easy' ? DRAW_WORDS_EASY : [...DRAW_WORDS_EASY, ...DRAW_WORDS_MEDIUM], ROUNDS),
      teams,
      canvas: new CanvasStore(),
      ratings: {},
      teamScores: teams.map(() => 0),
      lastAvg: teams.map(() => 0),
      strokes: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      botSeq: 1,
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    const t = teamOf(ctx, pid);
    if (s.phase === 'draw' && (a.t === 'draw' || a.t === 'undo' || a.t === 'clear') && a.cv === cvOf(s, t)) {
      const r = s.canvas.apply(pid, a);
      if (!r) return;
      ctx.markActed(pid);
      if (r.type === 'draw') s.strokes[pid]++;
      relay(ctx, r, s.teams[t].filter((id) => id !== pid));
      return;
    }
    if (s.phase === 'rate' && a.t === 'rate') {
      const team = a.team;
      const stars = a.stars;
      if (typeof team !== 'number' || team === t || team < 0 || team >= s.teams.length) return;
      if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) return;
      ctx.markActed(pid);
      (s.ratings[pid] ??= {})[team] = stars;
      const need = s.teams.length - 1;
      if (ctx.ids.filter((id) => ctx.isConnected(id)).every((id) => Object.keys(s.ratings[id] ?? {}).length >= need)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(400, () => tallyRatings(s, ctx));
      }
      ctx.dirty();
    }
  },
  pub(s) {
    return {
      r: s.r,
      n: ROUNDS,
      phase: s.phase,
      deadline: s.deadline,
      prompt: s.prompts[s.r],
      teams: s.teams,
      rated: Object.keys(s.ratings),
      teamScores: s.teamScores,
      lastAvg: s.phase === 'result' ? s.lastAvg : null,
    };
  },
  priv(s, ctx, pid) {
    return { myRatings: s.ratings[pid] ?? {}, cv: cvOf(s, teamOf(ctx, pid)) };
  },
  rejoin(s, ctx, pid) {
    if (s.phase === 'draw') s.canvas.sync(ctx, cvOf(s, teamOf(ctx, pid)), pid);
  },
  bot(s, ctx, pid) {
    const t = teamOf(ctx, pid);
    if (s.phase === 'draw') {
      if (s.strokes[pid] > 6 + s.r * 2 || Math.random() < 0.3) return null;
      return { action: { ...botScribble(cvOf(s, t), s.botSeq++, Math.random) } };
    }
    if (s.phase === 'rate') {
      const mine = s.ratings[pid] ?? {};
      const todo = s.teams.map((_, k) => k).filter((k) => k !== t && mine[k] == null);
      if (!todo.length) return null;
      return { action: { t: 'rate', team: todo[0], stars: 2 + Math.floor(Math.random() * 4) } };
    }
    return null;
  },
  results(s, ctx) {
    return teamResults(ctx, s.teamScores, {
      great: ROUNDS * 100,
      individual: s.strokes,
      highlight: (id, t) => `Team rating ${(s.teamScores[t] / 20 / ROUNDS).toFixed(1)} ★ · you drew ${s.strokes[id]} stroke${s.strokes[id] === 1 ? '' : 's'}`,
    });
  },
});

function cvOf(s: S, t: number): string {
  return `td:${s.r}:${t}`;
}

function next(s: S, ctx: GameCtx) {
  s.r++;
  if (s.r >= ROUNDS) return ctx.end();
  s.phase = 'draw';
  s.ratings = {};
  s.deadline = ctx.now() + ctx.ms(DRAW_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(DRAW_MS), () => toRating(s, ctx));
  ctx.dirty();
}

function toRating(s: S, ctx: GameCtx) {
  // reveal every team's drawing to everyone
  const gallery: Record<number, unknown> = {};
  s.teams.forEach((_, t) => (gallery[t] = s.canvas.snapshot(cvOf(s, t))));
  ctx.asset(`td:gallery:${s.r}`, gallery);
  s.phase = 'rate';
  s.deadline = ctx.now() + ctx.ms(RATE_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(RATE_MS), () => tallyRatings(s, ctx));
  ctx.dirty();
}

function tallyRatings(s: S, ctx: GameCtx) {
  if (s.phase !== 'rate') return;
  s.lastAvg = s.teams.map((_, t) => {
    const got = Object.entries(s.ratings).filter(([id]) => teamOf(ctx, id) !== t).map(([, r]) => r[t]).filter((v): v is number => typeof v === 'number');
    return got.length ? got.reduce((a, b) => a + b, 0) / got.length : 2.5;
  });
  s.lastAvg.forEach((v, t) => (s.teamScores[t] += Math.round(v * 20)));
  s.phase = 'result';
  s.deadline = ctx.now() + RESULT_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(RESULT_MS, () => next(s, ctx));
}
