// Tug of War: teams mash to pull the knot toward their line. Taps on the beat pull twice as
// hard. Works for 2 teams (left/right) and 3 teams (a three-way tug). Best of three pulls.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';

export const TW = { WIN: 300, BEAT: 500, TOL: 95 } as const;
const COUNTDOWN = 2600;
const PULL_MAX = 22_000;
const RESULT_MS = 2600;
/** knot movement per (tap / team member) */
const GAIN = 17;

interface S {
  round: number;
  rounds: number;
  phase: 'count' | 'pull' | 'result' | 'over';
  phaseEnds: number;
  beat0: number;
  knot: { x: number; y: number };
  dirs: { x: number; y: number }[];
  teams: string[][];
  wins: number[];
  pending: number[];
  power: number[];
  lastTap: Record<string, number>;
  taps: Record<string, number>;
  onBeat: Record<string, number>;
  roundWinner: number | null;
}

export const tugOfWar = defineGame<S>({
  id: 'tug-of-war',
  realtime: true,
  botDelay: [80, 140],
  setup(ctx) {
    const teams = teamList(ctx);
    const n = teams.length;
    const dirs = teams.map((_, t) => {
      const a = Math.PI + (2 * Math.PI * t) / n;
      return { x: Math.round(Math.cos(a) * 1000) / 1000, y: Math.round(Math.sin(a) * 1000) / 1000 };
    });
    return {
      round: 0,
      rounds: 3,
      phase: 'count',
      phaseEnds: 0,
      beat0: 0,
      knot: { x: 0, y: 0 },
      dirs,
      teams,
      wins: teams.map(() => 0),
      pending: teams.map(() => 0),
      power: teams.map(() => 0),
      lastTap: {},
      taps: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      onBeat: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      roundWinner: null,
    };
  },
  start(s, ctx) {
    startPull(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'tap' || s.phase !== 'pull') return;
    const now = ctx.now();
    if (now - (s.lastTap[pid] ?? 0) < 55) return;
    s.lastTap[pid] = now;
    ctx.markActed(pid);
    // judge the beat at the moment the player tapped (receive time minus half the round trip)
    const at = now - Math.min(250, ctx.rtt(pid) / 2);
    const ph = (((at - s.beat0) % TW.BEAT) + TW.BEAT) % TW.BEAT;
    const err = Math.min(ph, TW.BEAT - ph);
    const beat = err <= TW.TOL;
    s.taps[pid]++;
    if (beat) s.onBeat[pid]++;
    s.pending[teamOf(ctx, pid)] += beat ? 2 : 1;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (s.phase === 'count' && now >= s.phaseEnds) {
      s.phase = 'pull';
      s.phaseEnds = now + ctx.ms(PULL_MAX);
      ctx.dirty();
    } else if (s.phase === 'pull') {
      // each team pulls along its own direction, normalised by team size so bigger teams don't win by numbers
      for (let t = 0; t < s.teams.length; t++) {
        const size = Math.max(1, s.teams[t].filter((id) => ctx.isConnected(id)).length);
        const f = (s.pending[t] / size) * GAIN;
        s.knot.x += s.dirs[t].x * f;
        s.knot.y += s.dirs[t].y * f;
        s.power[t] = s.power[t] * 0.85 + (s.pending[t] / size / dt) * 0.15;
        s.pending[t] = 0;
      }
      let winner: number | null = null;
      for (let t = 0; t < s.teams.length; t++) {
        if (s.knot.x * s.dirs[t].x + s.knot.y * s.dirs[t].y >= TW.WIN) winner = t;
      }
      if (winner == null && now >= s.phaseEnds) {
        // time up: whoever pulled it furthest toward their side
        let best = -Infinity;
        for (let t = 0; t < s.teams.length; t++) {
          const p = s.knot.x * s.dirs[t].x + s.knot.y * s.dirs[t].y;
          if (p > best) {
            best = p;
            winner = t;
          }
        }
      }
      if (winner != null) {
        s.wins[winner]++;
        s.roundWinner = winner;
        s.phase = 'result';
        s.phaseEnds = now + RESULT_MS;
        ctx.event('pulled', { team: winner });
        ctx.dirty();
      }
    } else if (s.phase === 'result' && now >= s.phaseEnds) {
      const need = Math.floor(s.rounds / 2) + 1;
      if (s.round + 1 >= s.rounds || (s.teams.length === 2 && s.wins.some((w) => w >= need))) {
        s.phase = 'over';
        ctx.end();
        return;
      }
      s.round++;
      startPull(s, ctx);
    }
  },
  pub(s) {
    return {
      round: s.round,
      rounds: s.rounds,
      phase: s.phase,
      phaseEnds: s.phaseEnds,
      beat0: s.beat0,
      beat: TW.BEAT,
      knot: { x: Math.round(s.knot.x * 10) / 10, y: Math.round(s.knot.y * 10) / 10 },
      dirs: s.dirs,
      win: TW.WIN,
      teams: s.teams,
      wins: s.wins,
      power: s.power.map((p) => Math.round(p * 10) / 10),
      roundWinner: s.phase === 'result' || s.phase === 'over' ? s.roundWinner : null,
    };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'pull') return null;
    const skill = ctx.diff(0.5, 0.72, 0.9);
    if (Math.random() > 0.55 + skill * 0.4) return null;
    return { action: { t: 'tap' } };
  },
  results(s, ctx) {
    const total = s.teams.map((m) => m.reduce((a, id) => a + s.taps[id], 0));
    const scores = s.wins.map((w, t) => w * 100 + Math.min(60, total[t] / Math.max(1, s.teams[t].length) / 5));
    return teamResults(ctx, scores, {
      great: 230,
      individual: Object.fromEntries(ctx.ids.map((id) => [id, s.taps[id] + s.onBeat[id]])),
      highlight: (id, t) => `${s.wins[t]} pull${s.wins[t] === 1 ? '' : 's'} won · you tapped ${s.taps[id]}× (${s.onBeat[id]} on the beat)`,
      bonuses: (id) => (s.taps[id] > 20 && s.onBeat[id] / s.taps[id] > 0.5 ? [{ label: 'In the groove', pts: 25 }] : []),
    });
  },
});

function startPull(s: S, ctx: GameCtx) {
  const now = ctx.now();
  s.knot = { x: 0, y: 0 };
  s.pending = s.teams.map(() => 0);
  s.power = s.teams.map(() => 0);
  s.roundWinner = null;
  s.phase = 'count';
  s.phaseEnds = now + COUNTDOWN;
  s.beat0 = s.phaseEnds;
  ctx.dirty();
}
