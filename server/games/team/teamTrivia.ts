// Team Trivia: anyone can buzz in; the buzzer answers for their team. A wrong answer lets the
// other teams buzz in to steal. Most team points after ten questions wins.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';
import { TRIVIA } from '../../content/trivia';

const QUESTIONS = 10;
const BUZZ_MS = 12_000;
const ANSWER_MS = 8_000;
const STEAL_MS = 6_000;
const REVEAL_MS = 3_200;

interface Q { q: string; options: string[]; answer: number; topic: string }

interface S {
  qs: Q[];
  i: number;
  phase: 'buzz' | 'answer' | 'steal' | 'stealAnswer' | 'reveal';
  deadline: number;
  shownAt: number;
  buzzer: string | null;
  tried: number[];
  wrong: number[];
  picked: number | null;
  result: { team: number | null; pid: string | null; right: boolean; steal: boolean } | null;
  teams: string[][];
  teamScores: number[];
  personal: Record<string, number>;
  buzzes: Record<string, number>;
  timer: number | null;
}

export const teamTrivia = defineGame<S>({
  id: 'team-trivia',
  botDelay: [400, 900],
  setup(ctx) {
    const picks = ctx.rng.sample(TRIVIA, QUESTIONS);
    const qs = picks.map((t) => {
      const opts = ctx.rng.shuffle([t[1], t[2], t[3], t[4]]);
      return { q: t[0], options: opts, answer: opts.indexOf(t[1]), topic: t[5] };
    });
    const teams = teamList(ctx);
    return {
      qs,
      i: -1,
      phase: 'buzz',
      deadline: 0,
      shownAt: 0,
      buzzer: null,
      tried: [],
      wrong: [],
      picked: null,
      result: null,
      teams,
      teamScores: teams.map(() => 0),
      personal: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      buzzes: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    const team = teamOf(ctx, pid);
    if (a.t === 'buzz' && (s.phase === 'buzz' || s.phase === 'steal') && !s.tried.includes(team)) {
      ctx.markActed(pid);
      s.buzzer = pid;
      s.buzzes[pid]++;
      s.tried.push(team);
      s.phase = s.phase === 'buzz' ? 'answer' : 'stealAnswer';
      s.deadline = ctx.now() + ctx.ms(s.phase === 'answer' ? ANSWER_MS : STEAL_MS);
      ctx.cancel(s.timer);
      s.timer = ctx.after(s.deadline - ctx.now(), () => judge(s, ctx, null));
      ctx.event('buzz', { id: pid, team });
      ctx.dirty();
      return;
    }
    if (a.t === 'ans' && (s.phase === 'answer' || s.phase === 'stealAnswer') && pid === s.buzzer) {
      const c = a.c;
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > 3 || s.wrong.includes(c)) return;
      ctx.markActed(pid);
      ctx.cancel(s.timer);
      judge(s, ctx, c);
    }
  },
  pub(s) {
    const q = s.qs[s.i];
    return {
      i: s.i,
      n: s.qs.length,
      phase: s.phase,
      deadline: s.deadline,
      q: q ? { q: q.q, options: q.options, topic: q.topic } : null,
      buzzer: s.buzzer,
      tried: s.tried,
      wrong: s.wrong,
      picked: s.picked,
      answer: s.phase === 'reveal' ? q.answer : null,
      result: s.phase === 'reveal' ? s.result : null,
      teams: s.teams,
      teamScores: s.teamScores,
    };
  },
  bot(s, ctx, pid) {
    const team = teamOf(ctx, pid);
    const skill = ctx.diff(0.45, 0.65, 0.85);
    const q = s.qs[s.i];
    if ((s.phase === 'buzz' || s.phase === 'steal') && !s.tried.includes(team)) {
      const waited = ctx.now() - s.shownAt;
      if (waited > 1500 && Math.random() < 0.12 + skill * 0.1) return { action: { t: 'buzz' } };
      return null;
    }
    if ((s.phase === 'answer' || s.phase === 'stealAnswer') && pid === s.buzzer) {
      const opts = [0, 1, 2, 3].filter((c) => !s.wrong.includes(c));
      const c = Math.random() < skill + (s.wrong.length ? 0.1 : 0) ? q.answer : opts[Math.floor(Math.random() * opts.length)];
      return { action: { t: 'ans', c } };
    }
    return null;
  },
  results(s, ctx) {
    return teamResults(ctx, s.teamScores, {
      great: QUESTIONS * 70,
      individual: s.personal,
      highlight: (id, t) => `Team score ${s.teamScores[t]} · you buzzed ${s.buzzes[id]}× and earned ${s.personal[id]}`,
    });
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= s.qs.length) return ctx.end();
  s.phase = 'buzz';
  s.buzzer = null;
  s.tried = [];
  s.wrong = [];
  s.picked = null;
  s.result = null;
  s.shownAt = ctx.now();
  s.deadline = s.shownAt + ctx.ms(BUZZ_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(BUZZ_MS), () => reveal(s, ctx, { team: null, pid: null, right: false, steal: false }));
  ctx.dirty();
}

function judge(s: S, ctx: GameCtx, c: number | null) {
  const q = s.qs[s.i];
  const pid = s.buzzer!;
  const team = teamOf(ctx, pid);
  const steal = s.phase === 'stealAnswer';
  s.picked = c;
  if (c === q.answer) {
    const speed = steal ? 0 : Math.round(40 * Math.max(0, 1 - (ctx.now() - s.shownAt) / (BUZZ_MS + ANSWER_MS)));
    const pts = steal ? 50 : 60 + speed;
    s.teamScores[team] += pts;
    s.personal[pid] += pts;
    return reveal(s, ctx, { team, pid, right: true, steal });
  }
  if (c != null) s.wrong.push(c);
  s.personal[pid] -= 10;
  // let the other teams steal if any are left
  const left = s.teams.map((_, t) => t).filter((t) => !s.tried.includes(t) && s.teams[t].some((id) => ctx.isConnected(id)));
  if (left.length && s.wrong.length < 3) {
    s.phase = 'steal';
    s.buzzer = null;
    s.deadline = ctx.now() + ctx.ms(STEAL_MS);
    ctx.cancel(s.timer);
    s.timer = ctx.after(ctx.ms(STEAL_MS), () => reveal(s, ctx, { team, pid, right: false, steal: false }));
    ctx.event('wrong', { id: pid });
    ctx.dirty();
    return;
  }
  reveal(s, ctx, { team, pid, right: false, steal });
}

function reveal(s: S, ctx: GameCtx, result: S['result']) {
  ctx.cancel(s.timer);
  s.phase = 'reveal';
  s.result = result;
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
}
