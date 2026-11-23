import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int, str } from '../../engine/util';
import { BOT_LIES, BOT_TRUTHS } from '../../content/social';

const WRITE_MS = 75_000;
const VOTE_MS = 16_000;
const REVEAL_MS = 4500;
const MAX_AUTHORS = 8;

interface Entry {
  s: string[]; // display order
  lie: number; // index into s
}
interface S {
  phase: 'write' | 'vote' | 'reveal';
  entries: Record<string, Entry>;
  order: string[];
  idx: number;
  votes: Record<string, number>;
  deadline: number;
  scores: Record<string, number>;
  fooled: Record<string, number>;
  spotted: Record<string, number>;
  timer: number | null;
}

export const twoTruths = defineGame<S>({
  id: 'two-truths',
  botDelay: [1500, 4000],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { phase: 'write', entries: {}, order: [], idx: -1, votes: {}, deadline: 0, scores: z(), fooled: z(), spotted: z(), timer: null };
  },
  start(s, ctx) {
    s.deadline = ctx.now() + ctx.ms(WRITE_MS);
    s.timer = ctx.after(ctx.ms(WRITE_MS), () => beginVoting(s, ctx));
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    if (a.t === 'submit' && s.phase === 'write' && !s.entries[pid]) {
      if (!Array.isArray(a.s) || a.s.length !== 3) return;
      const lines = a.s.map((x: unknown) => str(x, 90, 2));
      const lie = int(a.lie, 0, 2);
      if (lines.some((l) => !l) || lie == null) return;
      ctx.markActed(pid);
      // shuffle display order so the lie's position gives nothing away
      const order = ctx.rng.shuffle([0, 1, 2]);
      s.entries[pid] = { s: order.map((k) => lines[k]!), lie: order.indexOf(lie) };
      if (allDone(ctx, (id) => !!s.entries[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(400, () => beginVoting(s, ctx));
      }
      return;
    }
    if (a.t === 'vote' && s.phase === 'vote') {
      const author = s.order[s.idx];
      if (pid === author || s.votes[pid] != null) return;
      const c = int(a.c, 0, 2);
      if (c == null) return;
      ctx.markActed(pid);
      s.votes[pid] = c;
      if (allDone(ctx, (id) => id === author || s.votes[id] != null)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => reveal(s, ctx));
      }
    }
  },
  pub(s, ctx) {
    const author = s.order[s.idx];
    const e = author ? s.entries[author] : null;
    return {
      phase: s.phase,
      deadline: s.deadline,
      submitted: Object.keys(s.entries),
      author: author ?? null,
      idx: s.idx,
      total: s.order.length,
      statements: e?.s ?? null,
      voted: Object.keys(s.votes),
      reveal: s.phase === 'reveal' && e ? { lie: e.lie, votes: s.votes } : null,
      scores: s.scores,
      players: ctx.ids.length,
    };
  },
  priv(s, _ctx, pid) {
    return { submitted: !!s.entries[pid], myVote: s.votes[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase === 'write' && !s.entries[pid]) {
      const t = ctx.rng.sample(BOT_TRUTHS, 2);
      return { action: { t: 'submit', s: [t[0], ctx.rng.pick(BOT_LIES), t[1]], lie: 1 } };
    }
    if (s.phase === 'vote' && s.order[s.idx] !== pid && s.votes[pid] == null) return { action: { t: 'vote', c: ctx.rng.int(0, 2) } };
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const rounds = Math.max(1, s.order.length - 1);
    for (const id of ctx.ids) {
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.spotted[id] / rounds) * 0.6 + Math.min(1, s.fooled[id] / Math.max(1, ctx.ids.length - 1)) * 0.4,
        participated: ctx.acted(id),
        highlight: `Spotted ${s.spotted[id]} lies · fooled ${s.fooled[id]}`,
      };
    }
    const liar = ctx.ids.reduce((b, id) => (s.fooled[id] > s.fooled[b] ? id : b), ctx.ids[0]);
    return { perfs, summary: s.fooled[liar] > 0 ? [`🤥 Master liar: ${ctx.name(liar)} fooled ${s.fooled[liar]} people`] : [] };
  },
});

function beginVoting(s: S, ctx: GameCtx) {
  s.order = ctx.rng.shuffle(Object.keys(s.entries)).slice(0, MAX_AUTHORS);
  s.idx = -1;
  if (!s.order.length) return ctx.end();
  nextAuthor(s, ctx);
}

function nextAuthor(s: S, ctx: GameCtx) {
  s.idx++;
  if (s.idx >= s.order.length) return ctx.end();
  s.phase = 'vote';
  s.votes = {};
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const author = s.order[s.idx];
  const e = s.entries[author];
  for (const [voter, c] of Object.entries(s.votes)) {
    if (c === e.lie) {
      s.scores[voter] += 100;
      s.spotted[voter]++;
    } else {
      s.scores[author] += 70;
      s.fooled[author]++;
    }
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(REVEAL_MS, () => nextAuthor(s, ctx));
}
