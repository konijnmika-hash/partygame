import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, str } from '../../engine/util';
import { BOT_ANSWERS, WHO_PROMPTS } from '../../content/social';

const PROMPTS = 2;
const WRITE_MS = 40_000;
const GUESS_MS = 12_000;
const MAX_REVEALS = 6;

interface S {
  pi: number;
  prompts: string[];
  phase: 'write' | 'guess' | 'reveal';
  answers: Record<string, string>;
  queue: string[]; // authors to reveal
  qi: number;
  guesses: Record<string, string>;
  deadline: number;
  scores: Record<string, number>;
  right: Record<string, number>;
  sneaky: Record<string, number>;
  timer: number | null;
}

export const whoSaidIt = defineGame<S>({
  id: 'who-said-it',
  botDelay: [1500, 4500],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { pi: -1, prompts: ctx.rng.sample(WHO_PROMPTS, PROMPTS), phase: 'write', answers: {}, queue: [], qi: 0, guesses: {}, deadline: 0, scores: z(), right: z(), sneaky: z(), timer: null };
  },
  start(s, ctx) {
    nextPrompt(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (a.t === 'answer' && s.phase === 'write' && !s.answers[pid]) {
      const v = str(a.v, 90, 2);
      if (!v) return;
      ctx.markActed(pid);
      s.answers[pid] = v;
      if (allDone(ctx, (id) => !!s.answers[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => beginGuessing(s, ctx));
      }
    } else if (a.t === 'guess' && s.phase === 'guess' && !s.guesses[pid]) {
      const author = s.queue[s.qi];
      if (pid === author || typeof a.target !== 'string' || !ctx.isPlayer(a.target)) return;
      ctx.markActed(pid);
      s.guesses[pid] = a.target;
      if (allDone(ctx, (id) => id === author || !!s.guesses[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
    }
  },
  pub(s) {
    const author = s.queue[s.qi];
    return {
      pi: s.pi,
      pn: PROMPTS,
      prompt: s.prompts[s.pi],
      phase: s.phase,
      deadline: s.deadline,
      written: Object.keys(s.answers),
      qi: s.qi,
      qn: s.queue.length,
      answer: s.phase !== 'write' && author ? s.answers[author] : null,
      guessed: Object.keys(s.guesses),
      reveal: s.phase === 'reveal' ? { author, guesses: s.guesses } : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { mine: s.answers[pid] ?? null, isAuthor: s.phase !== 'write' && s.queue[s.qi] === pid, myGuess: s.guesses[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'write' && !s.answers[pid]) return { action: { t: 'answer', v: ctx.rng.pick(BOT_ANSWERS) } };
    if (s.phase === 'guess' && s.queue[s.qi] !== pid && !s.guesses[pid]) return { action: { t: 'guess', target: ctx.rng.pick(ctx.ids.filter((id) => id !== pid)) } };
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const total = Math.max(1, s.queue.length * PROMPTS);
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.right[id] / (total * 0.6)) * 0.7 + Math.min(1, s.sneaky[id] / Math.max(1, ctx.ids.length)) * 0.3, participated: ctx.acted(id), highlight: `${s.right[id]} correct guesses · fooled ${s.sneaky[id]}` };
    return { perfs };
  },
});

function nextPrompt(s: S, ctx: GameCtx) {
  s.pi++;
  if (s.pi >= PROMPTS) return ctx.end();
  s.phase = 'write';
  s.answers = {};
  s.deadline = ctx.now() + ctx.ms(WRITE_MS);
  s.timer = ctx.after(ctx.ms(WRITE_MS), () => beginGuessing(s, ctx));
  ctx.dirty();
}

function beginGuessing(s: S, ctx: GameCtx) {
  s.queue = ctx.rng.shuffle(Object.keys(s.answers)).slice(0, MAX_REVEALS);
  s.qi = -1;
  if (s.queue.length < 2) return nextPrompt(s, ctx);
  nextAnswer(s, ctx);
}

function nextAnswer(s: S, ctx: GameCtx) {
  s.qi++;
  if (s.qi >= s.queue.length) return nextPrompt(s, ctx);
  s.phase = 'guess';
  s.guesses = {};
  s.deadline = ctx.now() + ctx.ms(GUESS_MS);
  s.timer = ctx.after(ctx.ms(GUESS_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const author = s.queue[s.qi];
  for (const [g, target] of Object.entries(s.guesses)) {
    if (target === author) {
      s.scores[g] += 80;
      s.right[g]++;
    } else {
      s.scores[author] += 35;
      s.sneaky[author]++;
    }
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(3500, () => nextAnswer(s, ctx));
}
