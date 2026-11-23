// Meme Caption Contest: a ridiculous scene appears; everyone writes a caption; then everyone
// votes for their favourite (not their own). Three scenes.
import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, str } from '../../engine/util';
import { cleanText } from '@shared/validation';
import { BOT_CAPTIONS, MEME_SCENES } from '../../content/weird';

const SCENES = 3;
const WRITE_MS = 45_000;
const VOTE_MS = 20_000;
const RESULT_MS = 6000;

interface S {
  k: number;
  phase: 'write' | 'vote' | 'result';
  deadline: number;
  scenes: { emoji: string[]; desc: string }[];
  captions: Record<string, string>;
  order: string[];
  votes: Record<string, string>;
  scores: Record<string, number>;
  wins: Record<string, number>;
  timer: number | null;
}

export const memeCaption = defineGame<S>({
  id: 'meme-caption',
  botDelay: [2500, 7000],
  setup(ctx) {
    return {
      k: -1,
      phase: 'write',
      deadline: 0,
      scenes: ctx.rng.sample(MEME_SCENES, SCENES),
      captions: {},
      order: [],
      votes: {},
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      wins: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (a.t === 'caption' && s.phase === 'write' && !s.captions[pid]) {
      const c = str(a.c, 90);
      if (!c) return;
      ctx.markActed(pid);
      s.captions[pid] = cleanText(c);
      if (allDone(ctx, (id) => !!s.captions[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(500, () => toVote(s, ctx));
      }
      ctx.dirty();
    } else if (a.t === 'vote' && s.phase === 'vote' && !s.votes[pid]) {
      if (typeof a.target !== 'string' || !s.captions[a.target] || a.target === pid) return;
      ctx.markActed(pid);
      s.votes[pid] = a.target;
      if (allDone(ctx, (id) => !!s.votes[id] || Object.keys(s.captions).every((c) => c === id))) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(400, () => tally(s, ctx));
      }
      ctx.dirty();
    }
  },
  pub(s) {
    const scene = s.scenes[s.k];
    const showCaptions = s.phase !== 'write';
    return {
      k: s.k,
      n: SCENES,
      phase: s.phase,
      deadline: s.deadline,
      scene,
      written: Object.keys(s.captions),
      // anonymous while voting; authors revealed with the results
      entries: showCaptions ? s.order.map((id) => ({ id: s.phase === 'result' ? id : null, key: id, c: s.captions[id] })) : [],
      voted: Object.keys(s.votes),
      tally: s.phase === 'result' ? tallyOf(s) : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { mine: s.captions[pid] ?? null, myVote: s.votes[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'write' && !s.captions[pid]) return { action: { t: 'caption', c: ctx.rng.pick(BOT_CAPTIONS) } };
    if (s.phase === 'vote' && !s.votes[pid]) {
      const opts = s.order.filter((id) => id !== pid);
      if (opts.length) return { action: { t: 'vote', target: opts[Math.floor(Math.random() * opts.length)] } };
    }
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const best = Math.max(1, ...Object.values(s.scores));
    for (const id of ctx.ids) {
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / best),
        participated: ctx.acted(id),
        highlight: `${s.scores[id] / 100 >= 1 ? `${Math.round(s.scores[id] / 100)} vote${Math.round(s.scores[id] / 100) === 1 ? '' : 's'}` : 'No votes'} · ${s.wins[id]} scene win${s.wins[id] === 1 ? '' : 's'}`,
      };
    }
    return { perfs };
  },
});

function tallyOf(s: S): Record<string, number> {
  const t: Record<string, number> = {};
  for (const v of Object.values(s.votes)) t[v] = (t[v] ?? 0) + 1;
  return t;
}

function next(s: S, ctx: GameCtx) {
  s.k++;
  if (s.k >= SCENES) return ctx.end();
  s.phase = 'write';
  s.captions = {};
  s.votes = {};
  s.order = [];
  s.deadline = ctx.now() + ctx.ms(WRITE_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(WRITE_MS), () => toVote(s, ctx));
  ctx.dirty();
}

function toVote(s: S, ctx: GameCtx) {
  if (s.phase !== 'write') return;
  s.order = ctx.rng.shuffle(Object.keys(s.captions));
  if (s.order.length < 2) return tally(s, ctx);
  s.phase = 'vote';
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => tally(s, ctx));
  ctx.dirty();
}

function tally(s: S, ctx: GameCtx) {
  if (s.phase === 'result') return;
  const t = tallyOf(s);
  const max = Math.max(0, ...Object.values(t));
  for (const [id, n] of Object.entries(t)) {
    s.scores[id] += n * 100;
    if (n === max && max > 0) s.wins[id]++;
  }
  for (const id of Object.keys(s.captions)) s.scores[id] += 20;
  s.phase = 'result';
  s.deadline = ctx.now() + RESULT_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(RESULT_MS, () => next(s, ctx));
}
