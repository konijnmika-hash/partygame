// Reusable multiple-choice question engine (trivia, logic, weird quiz, higher/lower...).
// Answers never leave the server until the reveal; picks are server-timed.
import type { GameCtx, GameDef } from './types';
import { allDone, isObj, int } from './util';

export interface QuizQuestion<P = unknown, C = unknown> {
  prompt: P;
  choices: C[];
  answer: number;
  timeMs?: number;
  explain?: string;
}

export interface QuizOptions<P, C> {
  id: string;
  count: number;
  timeMs: number;
  make(ctx: GameCtx, index: number, used: Set<string>): QuizQuestion<P, C>;
  /** confidence wager 1..3 (wins/loses that many units) */
  wager?: boolean;
  revealMs?: number;
  botAccuracy?: [number, number, number];
  /** label for highlight, e.g. "answers" */
  noun?: string;
}

interface Pick {
  c: number;
  ms: number;
  w: number;
}

interface S {
  i: number;
  phase: 'q' | 'reveal';
  q: QuizQuestion<any, any> | null;
  shownAt: number;
  deadline: number;
  picks: Record<string, Pick>;
  gains: Record<string, number>;
  scores: Record<string, number>;
  right: Record<string, number>;
  streak: Record<string, number>;
  bestStreak: Record<string, number>;
  used: Set<string>;
  timer: number | null;
  botPlan: Record<string, number>;
}

export function quizGame<P, C>(o: QuizOptions<P, C>): GameDef<S> {
  const revealMs = o.revealMs ?? 2600;
  const unit = 100;
  const maxPer = o.wager ? unit * 3 : unit * 2 + 30;

  function next(s: S, ctx: GameCtx) {
    s.i++;
    if (s.i >= o.count) return ctx.end();
    s.q = o.make(ctx, s.i, s.used);
    s.picks = {};
    s.gains = {};
    s.botPlan = {};
    s.phase = 'q';
    s.shownAt = ctx.now();
    s.deadline = s.shownAt + ctx.ms(s.q.timeMs ?? o.timeMs);
    s.timer = ctx.after(s.deadline - s.shownAt, () => reveal(s, ctx));
  }

  function reveal(s: S, ctx: GameCtx) {
    const q = s.q!;
    const windowMs = s.deadline - s.shownAt;
    for (const id of ctx.ids) {
      const p = s.picks[id];
      if (!p) {
        s.streak[id] = 0;
        continue;
      }
      const ok = p.c === q.answer;
      let g = 0;
      if (o.wager) {
        g = ok ? unit * p.w : -Math.round(unit * 0.6 * p.w);
      } else if (ok) {
        g = unit + Math.round(unit * Math.max(0, 1 - p.ms / windowMs));
        if (s.streak[id] >= 2) g += Math.min(30, 10 * s.streak[id]);
      }
      if (ok) {
        s.right[id]++;
        s.streak[id]++;
        s.bestStreak[id] = Math.max(s.bestStreak[id], s.streak[id]);
      } else s.streak[id] = 0;
      s.gains[id] = g;
      s.scores[id] += g;
    }
    s.phase = 'reveal';
    ctx.dirty();
    s.timer = ctx.after(revealMs, () => next(s, ctx));
  }

  return {
    id: o.id,
    botDelay: [300, 700],
    setup(ctx) {
      const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
      return { i: -1, phase: 'q', q: null, shownAt: 0, deadline: 0, picks: {}, gains: {}, scores: z(), right: z(), streak: z(), bestStreak: z(), used: new Set(), timer: null, botPlan: {} };
    },
    start(s, ctx) {
      next(s, ctx);
    },
    action(s, ctx, pid, a) {
      if (!isObj(a) || a.t !== 'pick' || s.phase !== 'q' || !s.q || s.picks[pid]) return;
      const c = int(a.c, 0, s.q.choices.length - 1);
      if (c == null) return;
      const w = o.wager ? int(a.w, 1, 3) ?? 1 : 1;
      ctx.markActed(pid);
      s.picks[pid] = { c, ms: Math.max(0, ctx.now() - s.shownAt - ctx.rtt(pid) / 2), w };
      if (allDone(ctx, (id) => !!s.picks[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(350, () => reveal(s, ctx));
      }
    },
    pub(s) {
      const q = s.q;
      return {
        i: s.i,
        n: o.count,
        phase: s.phase,
        q: q ? { prompt: q.prompt, choices: q.choices } : null,
        shownAt: s.shownAt,
        deadline: s.deadline,
        answered: Object.keys(s.picks),
        reveal: s.phase === 'reveal' && q ? { answer: q.answer, picks: Object.fromEntries(Object.entries(s.picks).map(([id, p]) => [id, p.c])), gains: s.gains, explain: q.explain ?? null } : null,
        scores: s.scores,
        streak: s.streak,
        wager: !!o.wager,
      };
    },
    priv(s, _ctx, pid) {
      const p = s.picks[pid];
      return { mine: p ? { c: p.c, w: p.w } : null };
    },
    bot(s, ctx, pid) {
      if (s.phase !== 'q' || !s.q || s.picks[pid]) return null;
      const wait = (s.botPlan[pid] ??= 1500 + Math.random() * ((s.deadline - s.shownAt) * 0.6));
      if (ctx.now() - s.shownAt < wait) return null;
      const acc = o.botAccuracy ? ctx.diff(...o.botAccuracy) : ctx.diff(0.45, 0.6, 0.75);
      const c = Math.random() < acc ? s.q.answer : ctx.rng.int(0, s.q.choices.length - 1);
      return { action: { t: 'pick', c, w: o.wager ? ctx.rng.int(1, 3) : 1 } };
    },
    results(s, ctx) {
      const perfs: Record<string, any> = {};
      for (const id of ctx.ids) {
        const bonuses = [];
        if (s.right[id] === o.count) bonuses.push({ label: 'Perfect score!', pts: 50 });
        else if (s.bestStreak[id] >= 5) bonuses.push({ label: `${s.bestStreak[id]}-answer streak`, pts: 30 });
        perfs[id] = {
          score: s.scores[id],
          perf: Math.max(0, s.scores[id]) / (o.count * maxPer * 0.85),
          participated: ctx.acted(id),
          bonuses,
          highlight: `${s.right[id]}/${o.count} correct${s.bestStreak[id] >= 3 ? ` · best streak ${s.bestStreak[id]}` : ''}`,
        };
      }
      return { perfs };
    },
  };
}

/** Shuffle a correct answer in with wrong ones; returns choices + answer index. */
export function shuffleChoices<T>(ctx: GameCtx, correct: T, wrong: T[]): { choices: T[]; answer: number } {
  const all = ctx.rng.shuffle([correct, ...wrong]);
  return { choices: all, answer: all.indexOf(correct) };
}
