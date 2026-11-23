import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int } from '../../engine/util';

const FACES = ['🍒', '🍋', '🍇', '🍓', '🥝', '🍑', '🥥', '🍍', '🥕', '🌽', '🍄', '🥨', '🧀', '🍔', '🌮', '🍣', '🍪', '🍿'];
const BOARD_PAIRS = [6, 8, 10];
const PREVIEW_MS = [3000, 3200, 3600];
const PENALTY = 1500;
const LIMIT = 100_000;

interface P {
  board: number;
  matched: number[];
  first: number | null;
  previewUntil: number;
  penalty: number;
  startedAt: number;
  times: number[];
  misses: number;
  botMem: Record<number, string>;
}
interface S {
  boards: string[][];
  p: Record<string, P>;
  endsAt: number;
}

export const matchObjects = defineGame<S>({
  id: 'match-objects',
  botDelay: [450, 900],
  setup(ctx) {
    const boards = BOARD_PAIRS.map((n) => ctx.rng.shuffle(ctx.rng.sample(FACES, n).flatMap((f) => [f, f])));
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { board: 0, matched: [], first: null, previewUntil: 0, penalty: 0, startedAt: 0, times: [], misses: 0, botMem: {} };
    return { boards, p, endsAt: 0 };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(LIMIT);
    for (const id of ctx.ids) beginBoard(s, ctx, id);
    ctx.after(ctx.ms(LIMIT), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'flip') return;
    const pl = s.p[pid];
    if (!pl || pl.board >= s.boards.length || ctx.now() < pl.previewUntil) return;
    const faces = s.boards[pl.board];
    const i = int(a.i, 0, faces.length - 1);
    if (i == null || pl.matched.includes(i) || pl.first === i) return;
    ctx.markActed(pid);
    pl.botMem[i] = faces[i];
    if (pl.first == null) {
      pl.first = i;
      ctx.event('flip', { i, f: faces[i] }, pid);
      return;
    }
    const j = pl.first;
    pl.first = null;
    if (faces[i] === faces[j]) {
      pl.matched.push(i, j);
      ctx.event('match', { i, j, f: faces[i] }, pid);
      if (pl.matched.length === faces.length) {
        pl.times.push(ctx.now() - pl.startedAt + pl.penalty);
        pl.penalty = 0;
        pl.board++;
        if (pl.board < s.boards.length) beginBoard(s, ctx, pid);
        else if (ctx.ids.every((id) => s.p[id].board >= s.boards.length || !ctx.isConnected(id))) ctx.after(800, () => ctx.end());
      }
    } else {
      pl.penalty += PENALTY;
      pl.misses++;
      ctx.event('miss', { i, j, fi: faces[i], fj: faces[j] }, pid);
    }
  },
  pub(s) {
    return { endsAt: s.endsAt, boards: s.boards.length, progress: Object.fromEntries(Object.entries(s.p).map(([id, p]) => [id, { board: p.board, matched: p.matched.length }])) };
  },
  priv(s, ctx, pid) {
    const pl = s.p[pid];
    if (!pl) return null;
    const faces = s.boards[pl.board] ?? [];
    const preview = ctx.now() < pl.previewUntil;
    return {
      board: pl.board,
      cards: faces.map((f, i) => (preview || pl.matched.includes(i) || pl.first === i ? f : null)),
      preview,
      previewUntil: pl.previewUntil,
      penalty: pl.penalty,
      times: pl.times,
    };
  },
  bot(s, ctx, pid) {
    const pl = s.p[pid];
    if (!pl || pl.board >= s.boards.length || ctx.now() < pl.previewUntil) return null;
    const faces = s.boards[pl.board];
    const skill = ctx.diff(0.45, 0.65, 0.85);
    const open = faces.map((_, i) => i).filter((i) => !pl.matched.includes(i) && i !== pl.first);
    if (pl.first != null) {
      const partner = open.find((i) => faces[i] === faces[pl.first!]);
      if (partner != null && (pl.botMem[partner] || Math.random() < skill * 0.5)) return { action: { t: 'flip', i: partner } };
      return { action: { t: 'flip', i: ctx.rng.pick(open) } };
    }
    return { action: { t: 'flip', i: ctx.rng.pick(open) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const p = s.p[id];
      const total = p.times.reduce((a, b) => a + b, 0);
      const partial = p.board < s.boards.length ? p.matched.length / s.boards[p.board].length : 0;
      perfs[id] = { score: (p.board + partial) * 1e6 - total, perf: ((p.board + partial) / s.boards.length) * 0.7 + (p.board === s.boards.length ? Math.max(0, 1 - total / 90_000) * 0.3 : 0), participated: ctx.acted(id), bonuses: p.misses === 0 && p.board === s.boards.length ? [{ label: 'Photographic memory', pts: 50 }] : [], highlight: `${p.board}/${s.boards.length} boards · ${p.misses} misses` };
    }
    return { perfs };
  },
});

function beginBoard(s: S, ctx: GameCtx, id: string) {
  const pl = s.p[id];
  pl.matched = [];
  pl.first = null;
  pl.botMem = {};
  const ms = ctx.ms(PREVIEW_MS[pl.board] ?? 3000);
  pl.previewUntil = ctx.now() + ms;
  pl.startedAt = pl.previewUntil;
  ctx.after(ms + 10, () => ctx.dirty());
}
