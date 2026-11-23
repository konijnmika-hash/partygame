import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int } from '../../engine/util';

const SIZE = 3;
const ROUNDS = 2;
const LIMIT = 120_000;

function neighbors(i: number): number[] {
  const r = Math.floor(i / SIZE), c = i % SIZE;
  const out: number[] = [];
  if (r > 0) out.push(i - SIZE);
  if (r < SIZE - 1) out.push(i + SIZE);
  if (c > 0) out.push(i - 1);
  if (c < SIZE - 1) out.push(i + 1);
  return out;
}

function solved(b: number[]): boolean {
  for (let i = 0; i < b.length - 1; i++) if (b[i] !== i + 1) return false;
  return b[b.length - 1] === 0;
}

/** Scramble by legal moves from the solved state (always solvable). Returns board + tile path to undo. */
function scramble(ctx: GameCtx, moves: number): { board: number[]; solution: number[] } {
  const b = [...Array.from({ length: SIZE * SIZE - 1 }, (_, i) => i + 1), 0];
  let blank = b.length - 1;
  let prev = -1;
  const path: number[] = [];
  for (let k = 0; k < moves; k++) {
    const opts = neighbors(blank).filter((n) => n !== prev);
    const n = ctx.rng.pick(opts);
    path.push(b[n]);
    [b[blank], b[n]] = [b[n], b[blank]];
    prev = blank;
    blank = n;
  }
  if (solved(b)) return scramble(ctx, moves + 1);
  return { board: b, solution: path.reverse() };
}

interface P {
  round: number;
  board: number[];
  moves: number;
  times: number[];
  botStep: number;
}
interface S {
  boards: { board: number[]; solution: number[] }[];
  p: Record<string, P>;
  startAt: number;
  endsAt: number;
  roundStart: Record<string, number>;
  order: string[];
}

export const puzzleRush = defineGame<S>({
  id: 'puzzle-rush',
  botDelay: [350, 850],
  setup(ctx) {
    const boards = [scramble(ctx, ctx.diff(16, 24, 34)), scramble(ctx, ctx.diff(24, 36, 50))];
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { round: 0, board: [...boards[0].board], moves: 0, times: [], botStep: 0 };
    return { boards, p, startAt: 0, endsAt: 0, roundStart: {}, order: [] };
  },
  start(s, ctx) {
    s.startAt = ctx.now();
    s.endsAt = s.startAt + ctx.ms(LIMIT);
    for (const id of ctx.ids) s.roundStart[id] = s.startAt;
    ctx.after(ctx.ms(LIMIT), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'move') return;
    const pl = s.p[pid];
    if (!pl || pl.round >= ROUNDS) return;
    const tile = int(a.tile, 1, SIZE * SIZE - 1);
    if (tile == null) return;
    const i = pl.board.indexOf(tile);
    const blank = pl.board.indexOf(0);
    if (!neighbors(blank).includes(i)) return;
    ctx.markActed(pid);
    [pl.board[blank], pl.board[i]] = [pl.board[i], pl.board[blank]];
    pl.moves++;
    if (solved(pl.board)) {
      pl.times.push(ctx.now() - s.roundStart[pid]);
      pl.round++;
      pl.botStep = 0;
      ctx.event('solved', { round: pl.round }, pid);
      if (pl.round < ROUNDS) {
        pl.board = [...s.boards[pl.round].board];
        s.roundStart[pid] = ctx.now();
      } else {
        s.order.push(pid);
        if (ctx.ids.every((id) => s.p[id].round >= ROUNDS || !ctx.isConnected(id))) ctx.after(800, () => ctx.end());
      }
    }
  },
  pub(s) {
    return {
      endsAt: s.endsAt,
      rounds: ROUNDS,
      progress: Object.fromEntries(Object.entries(s.p).map(([id, p]) => [id, { round: p.round, moves: p.moves }])),
      order: s.order,
    };
  },
  priv(s, _ctx, pid) {
    const pl = s.p[pid];
    return pl ? { board: pl.board, round: pl.round, moves: pl.moves, times: pl.times } : null;
  },
  bot(s, ctx, pid) {
    const pl = s.p[pid];
    if (!pl || pl.round >= ROUNDS) return null;
    const sol = s.boards[pl.round].solution;
    if (Math.random() < ctx.diff(0.25, 0.15, 0.06)) {
      // fumble: random legal move (we then lose our place in the plan and re-plan via undo)
      return null;
    }
    const tile = sol[pl.botStep];
    if (tile == null) return null;
    pl.botStep++;
    return { action: { t: 'move', tile } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const records: Record<string, any[]> = {};
    for (const id of ctx.ids) {
      const p = s.p[id];
      const total = p.times.reduce((a, b) => a + b, 0);
      const score = p.round * 1_000_000 - total;
      const speed = p.round ? Math.max(0, 1 - total / (p.round * 60_000)) : 0;
      perfs[id] = { score, perf: (p.round / ROUNDS) * 0.7 + speed * 0.3, participated: ctx.acted(id), highlight: p.round ? `${p.round}/${ROUNDS} solved in ${(total / 1000).toFixed(1)} s · ${p.moves} moves` : `${p.moves} moves, not solved` };
      if (p.times.length) records[id] = [{ key: 'fastest', label: 'Fastest slide solve', value: Math.min(...p.times), better: 'lower', format: 'sec' }];
    }
    return { perfs, records };
  },
});
