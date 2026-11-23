import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int, reactionTime, allDone } from '../../engine/util';

export const COLORS = [
  { id: 'RED', hex: '#ff4f5f' },
  { id: 'BLUE', hex: '#3da9fc' },
  { id: 'GREEN', hex: '#34cf78' },
  { id: 'YELLOW', hex: '#ffd23f' },
  { id: 'PURPLE', hex: '#9b6bff' },
  { id: 'ORANGE', hex: '#ff8a3d' },
];
const PROMPTS = 16;

interface S {
  i: number;
  phase: 'show' | 'gap';
  word: number;
  ink: number;
  options: number[];
  shownAt: number;
  deadline: number;
  picks: Record<string, { c: number; ok: boolean; pts: number }>;
  scores: Record<string, number>;
  right: Record<string, number>;
  timer: number | null;
}

export const colorReaction = defineGame<S>({
  id: 'color-reaction',
  botDelay: [120, 260],
  setup(ctx) {
    return { i: -1, phase: 'gap', word: 0, ink: 0, options: [], shownAt: 0, deadline: 0, picks: {}, scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])), right: Object.fromEntries(ctx.ids.map((id) => [id, 0])), timer: null };
  },
  start(s, ctx) {
    nextPrompt(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'pick' || s.phase !== 'show' || s.picks[pid]) return;
    const c = int(a.c, 0, COLORS.length - 1);
    if (c == null || !s.options.includes(c)) return;
    ctx.markActed(pid);
    const ok = c === s.ink;
    const ms = reactionTime(ctx, pid, s.shownAt, a.ms);
    const window = s.deadline - s.shownAt;
    const pts = ok ? 50 + Math.round(50 * Math.max(0, 1 - ms / window)) : -25;
    s.picks[pid] = { c, ok, pts };
    s.scores[pid] += pts;
    if (ok) s.right[pid]++;
    if (allDone(ctx, (id) => !!s.picks[id])) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(250, () => endPrompt(s, ctx));
    }
  },
  pub(s) {
    return { i: s.i, n: PROMPTS, phase: s.phase, word: COLORS[s.word].id, ink: COLORS[s.ink].hex, options: s.options.map((o) => ({ c: o, hex: COLORS[o].hex })), shownAt: s.shownAt, deadline: s.deadline, picked: Object.keys(s.picks), reveal: s.phase === 'gap' ? { ink: s.ink, picks: s.picks } : null, scores: s.scores };
  },
  priv(s, _ctx, pid) {
    return { mine: s.picks[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'show' || s.picks[pid]) return null;
    if (ctx.now() - s.shownAt < ctx.diff(1100, 850, 650) + Math.random() * 400) return null;
    const ok = Math.random() < ctx.diff(0.72, 0.82, 0.9);
    const c = ok ? s.ink : ctx.rng.pick(s.options.filter((o) => o !== s.ink));
    return { action: { t: 'pick', c, ms: ctx.now() - s.shownAt } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const acc = s.right[id] / PROMPTS;
      perfs[id] = { score: s.scores[id], perf: Math.max(0, s.scores[id]) / (PROMPTS * 85), participated: ctx.acted(id), bonuses: s.right[id] === PROMPTS ? [{ label: 'Perfect colour vision', pts: 50 }] : [], highlight: `${s.right[id]}/${PROMPTS} correct (${Math.round(acc * 100)}%)` };
    }
    return { perfs };
  },
});

function nextPrompt(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= PROMPTS) return ctx.end();
  const nOpts = s.i < 6 ? 3 : 4;
  const opts = ctx.rng.sample(COLORS.map((_, i) => i), nOpts);
  s.ink = opts[0];
  // word is usually a *different* colour, sometimes one of the other options (max confusion)
  const others = COLORS.map((_, i) => i).filter((i) => i !== s.ink);
  s.word = ctx.rng.chance(0.18) ? s.ink : ctx.rng.chance(0.7) ? ctx.rng.pick(opts.slice(1)) : ctx.rng.pick(others);
  s.options = ctx.rng.shuffle(opts);
  s.picks = {};
  s.phase = 'show';
  s.shownAt = ctx.now();
  const base = ctx.diff(3600, 3000, 2400) - s.i * ctx.diff(70, 80, 80);
  s.deadline = s.shownAt + ctx.ms(Math.max(1300, base));
  s.timer = ctx.after(s.deadline - s.shownAt, () => endPrompt(s, ctx));
}

function endPrompt(s: S, ctx: GameCtx) {
  s.phase = 'gap';
  ctx.dirty();
  s.timer = ctx.after(900, () => nextPrompt(s, ctx));
}
