// Emoji Story: everyone gets a secret story title and tells it with up to six emoji. Then the
// stories are shown one by one and everyone guesses which title each one tells.
import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, intArray, isObj } from '../../engine/util';
import { EMOJI_PALETTE, EMOJI_TITLES } from '../../content/weird';

const COMPOSE_MS = 45_000;
const GUESS_MS = 15_000;
const REVEAL_MS = 3500;
const MAX_STORIES = 8;
const MAX_EMOJI = 6;

interface S {
  phase: 'compose' | 'guess' | 'reveal';
  deadline: number;
  titles: Record<string, number>;
  stories: Record<string, number[]>;
  order: string[];
  k: number;
  options: number[];
  answer: number;
  picks: Record<string, number>;
  scores: Record<string, number>;
  guessedRight: Record<string, number>;
  understood: Record<string, number>;
  timer: number | null;
}

export const emojiStory = defineGame<S>({
  id: 'emoji-story',
  botDelay: [1500, 4000],
  setup(ctx) {
    const picks = ctx.rng.sample([...EMOJI_TITLES.keys()], ctx.ids.length);
    const titles: Record<string, number> = {};
    ctx.ids.forEach((id, i) => (titles[id] = picks[i % picks.length]));
    return {
      phase: 'compose',
      deadline: 0,
      titles,
      stories: {},
      order: [],
      k: -1,
      options: [],
      answer: 0,
      picks: {},
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      guessedRight: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      understood: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    s.deadline = ctx.now() + ctx.ms(COMPOSE_MS);
    s.timer = ctx.after(ctx.ms(COMPOSE_MS), () => startGuessing(s, ctx));
    ctx.dirty();
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (a.t === 'story' && s.phase === 'compose' && !s.stories[pid]) {
      const list = intArray(a.e, MAX_EMOJI, 0, EMOJI_PALETTE.length - 1);
      if (!list || !list.length) return;
      ctx.markActed(pid);
      s.stories[pid] = list;
      if (allDone(ctx, (id) => !!s.stories[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(500, () => startGuessing(s, ctx));
      }
      ctx.dirty();
    } else if (a.t === 'pick' && s.phase === 'guess' && s.picks[pid] == null) {
      const teller = s.order[s.k];
      if (pid === teller) return;
      const c = a.c;
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c >= s.options.length) return;
      ctx.markActed(pid);
      s.picks[pid] = c;
      if (allDone(ctx, (id) => id === teller || s.picks[id] != null)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(400, () => reveal(s, ctx));
      }
      ctx.dirty();
    }
  },
  pub(s) {
    const teller = s.order[s.k] ?? null;
    return {
      phase: s.phase,
      deadline: s.deadline,
      palette: EMOJI_PALETTE,
      max: MAX_EMOJI,
      submitted: Object.keys(s.stories),
      k: s.k,
      n: s.order.length,
      teller,
      story: teller ? s.stories[teller].map((i) => EMOJI_PALETTE[i]) : null,
      options: s.options.map((t) => EMOJI_TITLES[t].title),
      answered: Object.keys(s.picks),
      answer: s.phase === 'reveal' ? s.answer : null,
      picks: s.phase === 'reveal' ? s.picks : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { title: EMOJI_TITLES[s.titles[pid]]?.title ?? '', mine: s.stories[pid] ?? null, myPick: s.picks[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'compose' && !s.stories[pid]) {
      // tell the story with the canonical emoji (a bit shuffled for lower skill)
      const want = EMOJI_TITLES[s.titles[pid]].emoji.map((e) => EMOJI_PALETTE.indexOf(e)).filter((i) => i >= 0);
      const list = ctx.difficulty === 'easy' ? ctx.rng.shuffle(want) : want;
      if (!list.length) list.push(ctx.rng.int(0, EMOJI_PALETTE.length - 1));
      return { action: { t: 'story', e: list.slice(0, MAX_EMOJI) } };
    }
    if (s.phase === 'guess' && s.picks[pid] == null && s.order[s.k] !== pid) {
      const skill = ctx.diff(0.5, 0.7, 0.85);
      // a bot "reads" the emoji: options whose canonical emoji overlap the story score higher
      const story = new Set(s.stories[s.order[s.k]].map((i) => EMOJI_PALETTE[i]));
      let best = 0;
      let bs = -Infinity;
      s.options.forEach((t, c) => {
        const overlap = EMOJI_TITLES[t].emoji.filter((e) => story.has(e)).length;
        const sc = overlap * skill * 3 + Math.random() * 2;
        if (sc > bs) {
          bs = sc;
          best = c;
        }
      });
      return { action: { t: 'pick', c: best } };
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
        highlight: `Guessed ${s.guessedRight[id]} stor${s.guessedRight[id] === 1 ? 'y' : 'ies'} · ${s.order.includes(id) ? `${s.understood[id]} understood yours` : 'your story was not drawn'}`,
      };
    }
    return { perfs };
  },
});

function startGuessing(s: S, ctx: GameCtx) {
  if (s.phase !== 'compose') return;
  const tellers = ctx.rng.shuffle(Object.keys(s.stories));
  s.order = tellers.slice(0, MAX_STORIES);
  if (!s.order.length) return ctx.end();
  nextStory(s, ctx);
}

function nextStory(s: S, ctx: GameCtx) {
  s.k++;
  if (s.k >= s.order.length) return ctx.end();
  const teller = s.order[s.k];
  const truth = s.titles[teller];
  // decoys: other players' titles first (they are plausible), then the bank
  const decoys = ctx.rng.shuffle(Object.values(s.titles).filter((t) => t !== truth));
  const bank = ctx.rng.shuffle([...EMOJI_TITLES.keys()].filter((t) => t !== truth && !decoys.includes(t)));
  const opts = ctx.rng.shuffle([truth, ...[...new Set([...decoys, ...bank])].slice(0, 4)]);
  s.options = opts;
  s.answer = opts.indexOf(truth);
  s.picks = {};
  s.phase = 'guess';
  s.deadline = ctx.now() + ctx.ms(GUESS_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(GUESS_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  if (s.phase !== 'guess') return;
  const teller = s.order[s.k];
  for (const [id, c] of Object.entries(s.picks)) {
    if (c === s.answer) {
      s.scores[id] += 100;
      s.guessedRight[id]++;
      s.scores[teller] += 60;
      s.understood[teller]++;
    }
  }
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => nextStory(s, ctx));
}
