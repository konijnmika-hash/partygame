// Two Player Construction: in every team one Architect sees the blueprint and pings cells (with
// a colour) and sends quick hints; the Builders place the blocks. Roles rotate each blueprint.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';

export const CN = { N: 5, COLORS: 3 } as const;
const BLUEPRINTS = 3;
const BUILD_MS = 40_000;
const REVEAL_MS = 3500;
const PING_MS = 3500;
export const HINTS = ['Top row!', 'Bottom row!', 'Left side', 'Right side', 'Middle', 'Wrong one!', 'Nice!', 'Almost done!'];

interface TeamState {
  board: number[];
  pings: { i: number; c: number; at: number }[];
  hint: { h: number; at: number } | null;
  doneAt: number | null;
}

interface S {
  k: number;
  phase: 'build' | 'reveal';
  deadline: number;
  startedAt: number;
  blueprints: number[][];
  teams: string[][];
  ts: TeamState[];
  teamScores: number[];
  lastAcc: number[];
  placed: Record<string, number>;
  pinged: Record<string, number>;
  timer: number | null;
}

function architect(s: S, t: number): string {
  const m = s.teams[t];
  return m[s.k % m.length];
}

function accuracy(board: number[], bp: number[]): number {
  let ok = 0;
  for (let i = 0; i < bp.length; i++) if (board[i] === bp[i]) ok++;
  return ok / bp.length;
}

export const construction = defineGame<S>({
  id: 'two-player-construction',
  botDelay: [500, 1100],
  setup(ctx) {
    const cells = CN.N * CN.N;
    const blueprints = Array.from({ length: BLUEPRINTS }, (_, k) => {
      const bp = new Array(cells).fill(0);
      const count = 7 + k * 2 + ctx.rng.int(0, 2);
      for (const i of ctx.rng.sample([...Array(cells).keys()], count)) bp[i] = ctx.rng.int(1, CN.COLORS);
      return bp;
    });
    const teams = teamList(ctx);
    return {
      k: -1,
      phase: 'build',
      deadline: 0,
      startedAt: 0,
      blueprints,
      teams,
      ts: [],
      teamScores: teams.map(() => 0),
      lastAcc: teams.map(() => 0),
      placed: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      pinged: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || s.phase !== 'build') return;
    const t = teamOf(ctx, pid);
    const st = s.ts[t];
    if (st.doneAt != null) return;
    const arch = architect(s, t);
    const solo = s.teams[t].length === 1;
    const now = ctx.now();
    const cells = CN.N * CN.N;
    const okCell = (i: unknown): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < cells;
    const okColor = (c: unknown): c is number => typeof c === 'number' && Number.isInteger(c) && c >= 0 && c <= CN.COLORS;
    if (a.t === 'ping' && pid === arch && !solo && okCell(a.i) && okColor(a.c)) {
      ctx.markActed(pid);
      st.pings = st.pings.filter((p) => now - p.at < PING_MS && p.i !== a.i);
      st.pings.push({ i: a.i, c: a.c, at: now });
      if (st.pings.length > 6) st.pings.shift();
      s.pinged[pid]++;
    } else if (a.t === 'hint' && pid === arch && !solo && typeof a.h === 'number' && a.h >= 0 && a.h < HINTS.length) {
      ctx.markActed(pid);
      st.hint = { h: a.h, at: now };
    } else if (a.t === 'place' && (pid !== arch || solo) && okCell(a.i) && okColor(a.c)) {
      ctx.markActed(pid);
      st.board[a.i] = a.c;
      s.placed[pid]++;
      st.pings = st.pings.filter((p) => p.i !== a.i);
      if (accuracy(st.board, s.blueprints[s.k]) === 1) {
        st.doneAt = now;
        ctx.event('built', { team: t });
        if (s.ts.every((x, k) => x.doneAt != null || !s.teams[k].some((id) => ctx.isConnected(id)))) {
          ctx.cancel(s.timer);
          s.timer = ctx.after(700, () => reveal(s, ctx));
        }
      }
    } else return;
    ctx.dirty();
  },
  pub(s) {
    return {
      k: s.k,
      n: BLUEPRINTS,
      phase: s.phase,
      deadline: s.deadline,
      size: CN.N,
      colors: CN.COLORS,
      hints: HINTS,
      teams: s.teams,
      architects: s.teams.map((_, t) => architect(s, t)),
      boards: s.ts.map((x) => x.board),
      done: s.ts.map((x) => x.doneAt != null),
      teamScores: s.teamScores,
      blueprint: s.phase === 'reveal' ? s.blueprints[s.k] : null,
      lastAcc: s.phase === 'reveal' ? s.lastAcc : null,
    };
  },
  priv(s, ctx, pid) {
    const t = teamOf(ctx, pid);
    const st = s.ts[t];
    if (!st) return null;
    const arch = architect(s, t);
    const solo = s.teams[t].length === 1;
    // solo players get to peek at the blueprint for the first few seconds
    const peek = solo && ctx.now() - s.startedAt < 5000;
    return {
      role: solo ? 'solo' : pid === arch ? 'architect' : 'builder',
      blueprint: (pid === arch && !solo) || peek ? s.blueprints[s.k] : null,
      pings: st.pings,
      hint: st.hint,
    };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'build') return null;
    const t = teamOf(ctx, pid);
    const st = s.ts[t];
    if (st.doneAt != null) return null;
    const bp = s.blueprints[s.k];
    const skill = ctx.diff(0.5, 0.72, 0.9);
    const arch = architect(s, t);
    const solo = s.teams[t].length === 1;
    const wrong = bp.map((c, i) => (st.board[i] !== c ? i : -1)).filter((i) => i >= 0);
    if (!wrong.length) return null;
    if (pid === arch && !solo) {
      const pinged = new Set(st.pings.filter((p) => ctx.now() - p.at < PING_MS).map((p) => p.i));
      const todo = wrong.filter((i) => !pinged.has(i));
      if (!todo.length) return null;
      const i = todo[Math.floor(Math.random() * todo.length)];
      return { action: { t: 'ping', i, c: bp[i] } };
    }
    // builders follow pings (solo bots remember the blueprint imperfectly)
    const ping = st.pings.find((p) => ctx.now() - p.at < PING_MS && st.board[p.i] !== p.c);
    if (ping) return Math.random() < skill + 0.1 ? { action: { t: 'place', i: ping.i, c: ping.c } } : null;
    if (solo && Math.random() < skill) {
      const i = wrong[0];
      return { action: { t: 'place', i, c: bp[i] } };
    }
    return null;
  },
  results(s, ctx) {
    return teamResults(ctx, s.teamScores, {
      great: BLUEPRINTS * 120,
      individual: Object.fromEntries(ctx.ids.map((id) => [id, s.placed[id] + s.pinged[id]])),
      highlight: (id, t) => `Team ${Math.round(s.teamScores[t])} pts · you placed ${s.placed[id]} block${s.placed[id] === 1 ? '' : 's'} and sent ${s.pinged[id]} ping${s.pinged[id] === 1 ? '' : 's'}`,
    });
  },
});

function next(s: S, ctx: GameCtx) {
  s.k++;
  if (s.k >= BLUEPRINTS) return ctx.end();
  s.phase = 'build';
  s.startedAt = ctx.now();
  s.deadline = s.startedAt + ctx.ms(BUILD_MS);
  s.ts = s.teams.map(() => ({ board: new Array(CN.N * CN.N).fill(0), pings: [], hint: null, doneAt: null }));
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(BUILD_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  if (s.phase === 'reveal') return;
  const bp = s.blueprints[s.k];
  s.lastAcc = s.ts.map((st) => accuracy(st.board, bp));
  s.ts.forEach((st, t) => {
    const speed = st.doneAt != null ? Math.max(0, 1 - (st.doneAt - s.startedAt) / ctx.ms(BUILD_MS)) : 0;
    s.teamScores[t] += Math.round(s.lastAcc[t] * 80 + speed * 40);
  });
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
}
