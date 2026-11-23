// Guess the Sound: a public-domain tune plays note by note on a weird instrument. Tap the title
// as soon as you recognise it — one guess per tune, earlier is better.
import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj } from '../../engine/util';
import { TUNES } from '@shared/tunes';

const ROUNDS = 6;
const LISTEN_MS = 16_000;
const REVEAL_MS = 3500;
export const INSTRUMENTS = ['kazoo', 'robot', 'bubbles', 'music box', 'wobble bass', 'chiptune'] as const;

interface S {
  r: number;
  phase: 'listen' | 'reveal';
  startAt: number;
  deadline: number;
  tunes: number[];
  options: number[][];
  answers: number[];
  instruments: string[];
  picks: Record<string, { c: number; ms: number }>;
  scores: Record<string, number>;
  right: Record<string, number>;
  fastest: Record<string, number>;
  timer: number | null;
}

export const guessSound = defineGame<S>({
  id: 'guess-sound',
  botDelay: [700, 1500],
  setup(ctx) {
    const tunes = ctx.rng.sample([...TUNES.keys()], ROUNDS);
    const options: number[][] = [];
    const answers: number[] = [];
    for (const t of tunes) {
      const others = ctx.rng.sample([...TUNES.keys()].filter((k) => k !== t), 5);
      const opts = ctx.rng.shuffle([t, ...others]);
      options.push(opts);
      answers.push(opts.indexOf(t));
    }
    return {
      r: -1,
      phase: 'listen',
      startAt: 0,
      deadline: 0,
      tunes,
      options,
      answers,
      instruments: tunes.map(() => ctx.rng.pick(INSTRUMENTS)),
      picks: {},
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      right: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      fastest: {},
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'pick' || s.phase !== 'listen' || s.picks[pid]) return;
    const c = a.c;
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > 5) return;
    const now = ctx.now();
    if (now < s.startAt) return;
    ctx.markActed(pid);
    const ms = now - s.startAt;
    s.picks[pid] = { c, ms };
    if (c === s.answers[s.r]) {
      const pts = 50 + Math.round(100 * Math.max(0, 1 - ms / LISTEN_MS));
      s.scores[pid] += pts;
      s.right[pid]++;
      s.fastest[pid] = Math.min(s.fastest[pid] ?? Infinity, ms);
    }
    if (allDone(ctx, (id) => !!s.picks[id])) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(600, () => reveal(s, ctx));
    }
    ctx.dirty();
  },
  pub(s) {
    return {
      r: s.r,
      n: ROUNDS,
      phase: s.phase,
      startAt: s.startAt,
      deadline: s.deadline,
      // the melody itself is needed to play it; titles are only matched on the reveal
      tune: s.r >= 0 ? TUNES[s.tunes[s.r]].notes : null,
      bpm: s.r >= 0 ? TUNES[s.tunes[s.r]].bpm : 120,
      instrument: s.instruments[s.r],
      options: s.r >= 0 ? s.options[s.r].map((k) => TUNES[k].title) : [],
      answered: Object.keys(s.picks),
      answer: s.phase === 'reveal' ? s.answers[s.r] : null,
      picks: s.phase === 'reveal' ? s.picks : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { mine: s.picks[pid]?.c ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'listen' || s.picks[pid]) return null;
    const t = ctx.now() - s.startAt;
    const skill = ctx.diff(0.4, 0.6, 0.8);
    if (t < 2500 + (1 - skill) * 6000 || Math.random() < 0.6) return null;
    const c = Math.random() < skill ? s.answers[s.r] : Math.floor(Math.random() * 6);
    return { action: { t: 'pick', c } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / (ROUNDS * 120)),
        participated: ctx.acted(id),
        highlight: `${s.right[id]}/${ROUNDS} tunes named${s.fastest[id] != null ? ` · fastest in ${(s.fastest[id] / 1000).toFixed(1)} s` : ''}`,
      };
    }
    return {
      perfs,
      records: Object.fromEntries(ctx.ids.filter((id) => s.fastest[id] != null).map((id) => [id, [{ key: 'fastest', label: 'Fastest tune guess', value: s.fastest[id], better: 'lower' as const, format: 'ms' as const }]])),
    };
  },
});

function next(s: S, ctx: GameCtx) {
  s.r++;
  if (s.r >= ROUNDS) return ctx.end();
  s.phase = 'listen';
  s.picks = {};
  s.startAt = ctx.now() + 1200;
  s.deadline = s.startAt + ctx.ms(LISTEN_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(s.deadline - ctx.now(), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  if (s.phase !== 'listen') return;
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
}
