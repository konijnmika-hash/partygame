// Shared Maze: each team steers ONE Bloop through the same maze, but every teammate only
// controls some of the directions. Coordinate to reach the exit first. Two mazes.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';
import { DIRS, makeMaze, mazeDistances } from '@shared/maze';

const MAZES = 2;
const TEAM_MOVE_GAP = 90;
const REVEAL_MS = 3000;

interface S {
  i: number;
  phase: 'run' | 'done';
  deadline: number;
  startedAt: number;
  mazes: { w: number; h: number; cells: number[]; exit: number; dist: number[] }[];
  teams: string[][];
  /** team -> dir -> owners */
  owners: string[][][];
  pos: number[];
  lastMove: number[];
  finished: (number | null)[];
  places: number;
  teamScores: number[];
  moves: Record<string, number>;
  timer: number | null;
}

/** Split the four directions among a team's members (each member gets at least one). */
export function assignDirs(members: string[]): string[][] {
  const owners: string[][] = [[], [], [], []];
  if (!members.length) return owners;
  // pairs of directions for two players feel natural: up/down vs left/right
  const order = members.length === 2 ? [0, 2, 1, 3] : [0, 1, 2, 3];
  for (let k = 0; k < 4; k++) owners[order[k]].push(members[members.length === 2 ? Math.floor(k / 2) : k % members.length]);
  // extra members beyond four share directions
  for (let k = 4; k < members.length; k++) owners[k % 4].push(members[k]);
  return owners;
}

export const sharedMaze = defineGame<S>({
  id: 'shared-maze',
  botDelay: [180, 380],
  setup(ctx) {
    const sizes = ctx.diff([7, 9], [9, 11], [11, 13]);
    const mazes = sizes.map((n, k) => {
      const cells = makeMaze(ctx.rng.fork(`smaze${k}`), n, n);
      const exit = n * n - 1;
      return { w: n, h: n, cells, exit, dist: mazeDistances(cells, n, n, exit) };
    });
    const teams = teamList(ctx);
    return {
      i: -1,
      phase: 'run',
      deadline: 0,
      startedAt: 0,
      mazes,
      teams,
      owners: teams.map((m) => assignDirs(ctx.rng.shuffle(m))),
      pos: teams.map(() => 0),
      lastMove: teams.map(() => 0),
      finished: teams.map(() => null),
      places: 0,
      teamScores: teams.map(() => 0),
      moves: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'mv' || s.phase !== 'run') return;
    const d = a.d;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 3) return;
    const t = teamOf(ctx, pid);
    if (s.finished[t] != null || !s.owners[t][d].includes(pid)) return;
    const now = ctx.now();
    if (now - s.lastMove[t] < TEAM_MOVE_GAP) return;
    const m = s.mazes[s.i];
    const c = s.pos[t];
    if (!(m.cells[c] & DIRS[d].bit)) return;
    ctx.markActed(pid);
    s.lastMove[t] = now;
    s.pos[t] = c + DIRS[d].dy * m.w + DIRS[d].dx;
    s.moves[pid]++;
    if (s.pos[t] === m.exit) {
      s.finished[t] = ++s.places;
      s.teamScores[t] += [120, 90, 70][s.places - 1] ?? 60;
      ctx.event('exit', { team: t, place: s.places });
      if (s.finished.every((f, k) => f != null || !s.teams[k].some((id) => ctx.isConnected(id)))) {
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
      teams: s.teams,
      owners: s.owners,
      pos: s.pos,
      finished: s.finished,
      teamScores: s.teamScores,
    };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'run') return null;
    const t = teamOf(ctx, pid);
    if (s.finished[t] != null) return null;
    const m = s.mazes[s.i];
    const c = s.pos[t];
    let best = -1;
    let bd = Infinity;
    for (let d = 0; d < 4; d++) {
      if (!(m.cells[c] & DIRS[d].bit)) continue;
      const n = c + DIRS[d].dy * m.w + DIRS[d].dx;
      if (m.dist[n] < bd) {
        bd = m.dist[n];
        best = d;
      }
    }
    const skill = ctx.diff(0.5, 0.7, 0.9);
    if (best >= 0 && s.owners[t][best].includes(pid) && Math.random() < 0.5 + skill * 0.5) return { action: { t: 'mv', d: best } };
    return null;
  },
  results(s, ctx) {
    return teamResults(ctx, s.teamScores, {
      great: MAZES * 120,
      individual: s.moves,
      highlight: (id, t) => `Team ${s.teamScores[t]} pts · you made ${s.moves[id]} move${s.moves[id] === 1 ? '' : 's'}`,
    });
  },
});

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= MAZES) return ctx.end();
  const m = s.mazes[s.i];
  s.phase = 'run';
  s.startedAt = ctx.now();
  s.deadline = s.startedAt + ctx.ms(m.w * m.h * ctx.diff(700, 560, 460) + 10_000);
  s.pos = s.teams.map(() => 0);
  s.finished = s.teams.map(() => null);
  s.places = 0;
  // shuffle who controls what for the next maze
  s.owners = s.teams.map((members) => assignDirs(ctx.rng.shuffle(members)));
  ctx.cancel(s.timer);
  s.timer = ctx.after(s.deadline - ctx.now(), () => endMaze(s, ctx));
  ctx.dirty();
}

function endMaze(s: S, ctx: GameCtx) {
  if (s.phase === 'done') return;
  const m = s.mazes[s.i];
  const far = m.dist[0] || 1;
  s.teams.forEach((_, t) => {
    if (s.finished[t] == null) s.teamScores[t] += Math.round(40 * Math.max(0, 1 - m.dist[s.pos[t]] / far));
  });
  s.phase = 'done';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
}
