import { defineGame } from '../../engine/types';
import { isObj, int } from '../../engine/util';

// Sound ids map to synthesized motifs on the client (see client/src/games/memory/sound-memory.tsx).
export const SOUND_IDS = ['up', 'down', 'zap', 'boing', 'chime', 'buzz', 'trill', 'bass', 'bell', 'siren', 'drop', 'chirp'];
const BOARD_PAIRS = [6, 8];
const PENALTY = 1000;
const LIMIT = 100_000;

interface P {
  board: number;
  matched: number[];
  first: number | null;
  penalty: number;
  startedAt: number;
  times: number[];
  misses: number;
  heard: Record<number, string>;
}
interface S {
  boards: string[][];
  p: Record<string, P>;
  endsAt: number;
}

export const soundMemory = defineGame<S>({
  id: 'sound-memory',
  botDelay: [700, 1400],
  setup(ctx) {
    const boards = BOARD_PAIRS.map((n) => ctx.rng.shuffle(ctx.rng.sample(SOUND_IDS, n).flatMap((f) => [f, f])));
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { board: 0, matched: [], first: null, penalty: 0, startedAt: 0, times: [], misses: 0, heard: {} };
    return { boards, p, endsAt: 0 };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(LIMIT);
    for (const pl of Object.values(s.p)) pl.startedAt = ctx.now();
    ctx.after(ctx.ms(LIMIT), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'flip') return;
    const pl = s.p[pid];
    if (!pl || pl.board >= s.boards.length) return;
    const sounds = s.boards[pl.board];
    const i = int(a.i, 0, sounds.length - 1);
    if (i == null || pl.matched.includes(i) || pl.first === i) return;
    ctx.markActed(pid);
    pl.heard[i] = sounds[i];
    ctx.event('play', { i, s: sounds[i] }, pid);
    if (pl.first == null) {
      pl.first = i;
      return;
    }
    const j = pl.first;
    pl.first = null;
    if (sounds[i] === sounds[j]) {
      pl.matched.push(i, j);
      ctx.event('match', { i, j }, pid);
      if (pl.matched.length === sounds.length) {
        pl.times.push(ctx.now() - pl.startedAt + pl.penalty);
        pl.penalty = 0;
        pl.board++;
        pl.matched = [];
        pl.heard = {};
        pl.startedAt = ctx.now();
        if (pl.board >= s.boards.length && ctx.ids.every((id) => s.p[id].board >= s.boards.length || !ctx.isConnected(id))) ctx.after(800, () => ctx.end());
      }
    } else {
      pl.penalty += PENALTY;
      pl.misses++;
      ctx.event('miss', { i, j }, pid);
    }
  },
  pub(s) {
    return { endsAt: s.endsAt, boards: s.boards.length, progress: Object.fromEntries(Object.entries(s.p).map(([id, p]) => [id, { board: p.board, matched: p.matched.length }])) };
  },
  priv(s, _ctx, pid) {
    const pl = s.p[pid];
    if (!pl) return null;
    return { board: pl.board, count: s.boards[pl.board]?.length ?? 0, matched: pl.matched, first: pl.first, penalty: pl.penalty, times: pl.times };
  },
  bot(s, ctx, pid) {
    const pl = s.p[pid];
    if (!pl || pl.board >= s.boards.length) return null;
    const sounds = s.boards[pl.board];
    const open = sounds.map((_, i) => i).filter((i) => !pl.matched.includes(i) && i !== pl.first);
    if (pl.first != null) {
      const known = open.find((i) => pl.heard[i] === sounds[pl.first!]);
      if (known != null && Math.random() < ctx.diff(0.6, 0.75, 0.9)) return { action: { t: 'flip', i: known } };
    }
    const unheard = open.filter((i) => !pl.heard[i]);
    return { action: { t: 'flip', i: ctx.rng.pick(unheard.length ? unheard : open) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const p = s.p[id];
      const total = p.times.reduce((a, b) => a + b, 0);
      const partial = p.board < s.boards.length ? p.matched.length / s.boards[p.board].length : 0;
      perfs[id] = { score: (p.board + partial) * 1e6 - total, perf: ((p.board + partial) / s.boards.length) * 0.7 + (p.board === s.boards.length ? Math.max(0, 1 - total / 90_000) * 0.3 : 0), participated: ctx.acted(id), highlight: `${p.board}/${s.boards.length} boards · ${p.misses} misses` };
    }
    return { perfs };
  },
});

