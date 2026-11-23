import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int, str } from '../../engine/util';
import { matchAnswer, normalizeAnswer } from '@shared/validation';
import { BOT_FIBS, FIB_FACTS } from '../../content/social';

const QUESTIONS = 4;
const WRITE_MS = 40_000;
const PICK_MS = 22_000;

interface Option {
  text: string;
  authors: string[]; // empty for the truth
}
interface S {
  i: number;
  facts: typeof FIB_FACTS;
  phase: 'write' | 'pick' | 'reveal';
  fakes: Record<string, string>;
  options: Option[];
  truth: number;
  picks: Record<string, number>;
  deadline: number;
  scores: Record<string, number>;
  found: Record<string, number>;
  fooled: Record<string, number>;
  timer: number | null;
}

export const fakeAnswer = defineGame<S>({
  id: 'fake-answer',
  botDelay: [2000, 5000],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { i: -1, facts: ctx.rng.sample(FIB_FACTS, QUESTIONS), phase: 'write', fakes: {}, options: [], truth: 0, picks: {}, deadline: 0, scores: z(), found: z(), fooled: z(), timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (a.t === 'fake' && s.phase === 'write' && !s.fakes[pid]) {
      const v = str(a.v, 32);
      if (!v) return;
      if (matchAnswer(v, s.facts[s.i].a) === 'exact') return ctx.event('nope', { why: "That's the real answer! Write a convincing LIE 😏" }, pid);
      ctx.markActed(pid);
      s.fakes[pid] = v.toLowerCase();
      if (allDone(ctx, (id) => !!s.fakes[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => picking(s, ctx));
      }
    } else if (a.t === 'pick' && s.phase === 'pick' && s.picks[pid] == null) {
      const c = int(a.c, 0, s.options.length - 1);
      if (c == null || s.options[c].authors.includes(pid)) return;
      ctx.markActed(pid);
      s.picks[pid] = c;
      if (allDone(ctx, (id) => s.picks[id] != null)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
    }
  },
  pub(s) {
    const f = s.facts[s.i];
    return {
      i: s.i,
      n: QUESTIONS,
      question: f?.q,
      phase: s.phase,
      deadline: s.deadline,
      written: Object.keys(s.fakes),
      options: s.phase === 'write' ? null : s.options.map((o) => o.text),
      picked: Object.keys(s.picks),
      reveal: s.phase === 'reveal' ? { truth: s.truth, authors: s.options.map((o) => o.authors), picks: s.picks } : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    const mine = s.options.findIndex((o) => o.authors.includes(pid));
    return { myFake: s.fakes[pid] ?? null, myOption: mine >= 0 ? mine : null, myPick: s.picks[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'write' && !s.fakes[pid]) return { action: { t: 'fake', v: ctx.rng.pick(BOT_FIBS) } };
    if (s.phase === 'pick' && s.picks[pid] == null) {
      const choices = s.options.map((o, i) => (o.authors.includes(pid) ? -1 : i)).filter((i) => i >= 0);
      return { action: { t: 'pick', c: ctx.rng.chance(ctx.diff(0.3, 0.4, 0.55)) ? s.truth : ctx.rng.pick(choices) } };
    }
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: Math.min(1, s.found[id] / QUESTIONS) * 0.6 + Math.min(1, s.fooled[id] / (QUESTIONS * 1.5)) * 0.4, participated: ctx.acted(id), highlight: `Found the truth ${s.found[id]}× · fooled ${s.fooled[id]}` };
    const liar = ctx.ids.reduce((b, id) => (s.fooled[id] > s.fooled[b] ? id : b), ctx.ids[0]);
    return { perfs, summary: s.fooled[liar] ? [`🦄 Most convincing fibber: ${ctx.name(liar)}`] : [] };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= QUESTIONS) return ctx.end();
  s.phase = 'write';
  s.fakes = {};
  s.picks = {};
  s.options = [];
  s.deadline = ctx.now() + ctx.ms(WRITE_MS);
  s.timer = ctx.after(ctx.ms(WRITE_MS), () => picking(s, ctx));
  ctx.dirty();
}

function picking(s: S, ctx: GameCtx) {
  const opts: Option[] = [{ text: s.facts[s.i].a[0], authors: [] }];
  // identical lies merge (both authors get credit)
  for (const [pid, v] of Object.entries(s.fakes)) {
    const same = opts.find((o) => o.authors.length && normalizeAnswer(o.text) === normalizeAnswer(v));
    if (same) same.authors.push(pid);
    else opts.push({ text: v, authors: [pid] });
  }
  // pad with house lies so there's always something to choose
  const house = ['spaghetti', 'a trumpet', 'seventeen', 'bubble wrap', 'socks'];
  while (opts.length < 4) opts.push({ text: house[opts.length], authors: [] });
  const shuffled = ctx.rng.shuffle(opts);
  s.options = shuffled;
  s.truth = shuffled.findIndex((o) => o.text === s.facts[s.i].a[0] && o.authors.length === 0);
  s.phase = 'pick';
  s.deadline = ctx.now() + ctx.ms(PICK_MS);
  s.timer = ctx.after(ctx.ms(PICK_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  for (const [pid, c] of Object.entries(s.picks)) {
    if (c === s.truth) {
      s.scores[pid] += 100;
      s.found[pid]++;
    } else {
      for (const author of s.options[c].authors) {
        s.scores[author] += 70;
        s.fooled[author]++;
      }
    }
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(6000, () => next(s, ctx));
}
