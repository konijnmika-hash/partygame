// Maze Race: everyone gets the same maze; move cell by cell to the exit. Three mazes, each
// bigger than the last. Every move is validated against the walls on the server.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';
import { DIRS, makeMaze, mazeDistances } from '@shared/maze';

const MAZES = 3;
const MOVE_GAP = 60;
const REVEAL_MS = 3500;
const PLACE_PTS = [120, 100, 85, 72, 62, 55, 50];

interface Maze {
  w: number;
  h: number;
  cells: number[];
  exit: number;
  dist: number[];
}

interface S {
  i: number;
  phase: 'run' | 'done';
  deadline: number;
  startedAt: number;
  mazes: Maze[];
  pos: Record<string, number>;
  moves: Record<string, number>;
  lastMove: Record<string, number>;
  finished: Record<string, { ms: number; place: number }>;
  scores: Record<string, number>;
  solved: Record<string, number>;
  timer: number | null;
}

export const mazeRace = defineGame<S>({
  id: 'maze-race',
  botDelay: [140, 260],
  setup(ctx) {
    const sizes = ctx.diff([7, 9, 11], [9, 11, 13], [11, 13, 15]);
    const mazes = sizes.map((n, k) => {
      const cells = makeMaze(ctx.rng.fork(`maze${k}`), n, n);
      const exit = n * n - 1;
      return { w: n, h: n, cells, exit, dist: mazeDistances(cells, n, n, exit) };
    });
    return {
      i: -1,
      phase: 'run',
      deadline: 0,
      startedAt: 0,
      mazes,
      pos: {},
      moves: {},
      lastMove: {},
      finished: {},
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      solved: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'mv' || s.phase !== 'run' || s.finished[pid]) return;
    const d = a.d;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 3) return;
    const now = ctx.now();
    if (now - (s.lastMove[pid] ?? 0) < MOVE_GAP) return;
    const m = s.mazes[s.i];
    const c = s.pos[pid];
    const dir = DIRS[d];
    if (!(m.cells[c] & dir.bit)) return;
    s.lastMove[pid] = now;
    ctx.markActed(pid);
    const n = c + dir.dy * m.w + dir.dx;
    s.pos[pid] = n;
    s.moves[pid] = (s.moves[pid] ?? 0) + 1;
    if (n === m.exit) {
      const place = Object.keys(s.finished).length + 1;
      const ms = now - s.startedAt;
      s.finished[pid] = { ms, place };
      const speed = Math.round(30 * Math.max(0, 1 - ms / (s.deadline - s.startedAt)));
      s.scores[pid] += (PLACE_PTS[place - 1] ?? 45) + speed;
      s.solved[pid]++;
      ctx.event('exit', { id: pid, place });
      if (ctx.ids.filter((id) => ctx.isConnected(id)).every((id) => s.finished[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(900, () => endMaze(s, ctx));
      }
    }
    ctx.dirty();
  },
  pub(s) {
    const m = s.mazes[s.i];
    return {
      i: s.i,
      n: MAZES,
      phase: s.phase,
      deadline: s.deadline,
      maze: m ? { w: m.w, h: m.h, cells: m.cells, exit: m.exit } : null,
      pos: s.pos,
      finished: s.finished,
      scores: s.scores,
    };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'run' || s.finished[pid]) return null;
    const m = s.mazes[s.i];
    const c = s.pos[pid];
    const skill = ctx.diff(0.55, 0.75, 0.9);
    // mostly follow the shortest path, sometimes wander into a dead end
    let best = -1;
    let bd = Infinity;
    const opts: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (!(m.cells[c] & DIRS[i].bit)) continue;
      opts.push(i);
      const n = c + DIRS[i].dy * m.w + DIRS[i].dx;
      if (m.dist[n] < bd) {
        bd = m.dist[n];
        best = i;
      }
    }
    if (Math.random() > skill * 0.9 + 0.12 && opts.length > 1) best = opts[Math.floor(Math.random() * opts.length)];
    return best >= 0 ? { action: { t: 'mv', d: best } } : null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / (MAZES * 130)),
        participated: ctx.acted(id),
        highlight: `${s.solved[id]}/${MAZES} mazes escaped · ${s.moves[id] ?? 0} steps`,
        bonuses: s.solved[id] === MAZES ? [{ label: 'Maze master', pts: 30 }] : [],
      };
    }
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= MAZES) return ctx.end();
  const m = s.mazes[s.i];
  const now = ctx.now();
  s.phase = 'run';
  s.startedAt = now + 800;
  s.deadline = s.startedAt + ctx.ms(m.w * m.h * ctx.diff(420, 340, 280) + 8000);
  s.finished = {};
  for (const id of ctx.ids) {
    s.pos[id] = 0;
    s.lastMove[id] = now + 600;
  }
  ctx.cancel(s.timer);
  s.timer = ctx.after(s.deadline - now, () => endMaze(s, ctx));
  ctx.dirty();
}

function endMaze(s: S, ctx: GameCtx) {
  if (s.phase === 'done') return;
  // unfinished players earn a little for how close they got
  const m = s.mazes[s.i];
  const far = m.dist[0] || 1;
  for (const id of ctx.ids) if (!s.finished[id]) s.scores[id] += Math.round(25 * Math.max(0, 1 - m.dist[s.pos[id]] / far));
  s.phase = 'done';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
}
