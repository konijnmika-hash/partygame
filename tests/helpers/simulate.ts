// Runs a minigame to completion with bot players under a fake clock (no sockets, no real time).
import { GAME_MAP } from '@shared/catalog/index';
import { normalizeRound } from '@shared/scoring';
import type { Difficulty } from '@shared/types';
import { GameRunner, STEP_MS, type RunnerIO } from '../../server/engine/runner';
import type { GameDef, GamePlayer, GameResults } from '../../server/engine/types';

export interface SimOptions {
  players: number;
  difficulty?: Difficulty;
  seed?: number;
  teams?: number;
  /** safety cap on simulated time */
  maxMs?: number;
}

export interface SimReport {
  ended: boolean;
  simulatedMs: number;
  pubCount: number;
  privCount: number;
  eventCount: number;
  errors: string[];
  results: GameResults | null;
  points: Record<string, number>;
  maxPubBytes: number;
}

export function simulateGame(def: GameDef, opts: SimOptions): SimReport {
  const meta = GAME_MAP[def.id];
  if (!meta) throw new Error(`no meta for ${def.id}`);
  let t = 1_700_000_000_000;
  const clock = { now: () => t };
  const errors: string[] = [];
  let pubCount = 0;
  let privCount = 0;
  let eventCount = 0;
  let maxPubBytes = 0;
  const check = (what: string, data: unknown) => {
    try {
      const s = JSON.stringify(data);
      if (what === 'pub') maxPubBytes = Math.max(maxPubBytes, s ? s.length : 0);
    } catch (e) {
      errors.push(`${what} not serializable: ${(e as Error).message}`);
    }
  };
  const io: RunnerIO = {
    pub: (d) => {
      pubCount++;
      check('pub', d);
    },
    priv: (_p, d) => {
      privCount++;
      check('priv', d);
    },
    event: (_t, d) => {
      eventCount++;
      check('event', d);
    },
    asset: (_k, d) => check('asset', d),
  };
  const teamCount = meta.teams ? Math.max(2, opts.teams ?? 2) : 0;
  const players: GamePlayer[] = Array.from({ length: opts.players }, (_, i) => ({
    id: `bot${i}`,
    name: `Bot ${i}`,
    isBot: true,
    team: teamCount ? i % teamCount : null,
    color: '#ff00ff',
    index: i,
  }));
  const runner = new GameRunner(def, meta, players, {
    clock,
    seed: opts.seed ?? 12345,
    difficulty: opts.difficulty ?? 'normal',
    timeScale: 1,
    io,
    onError: (err, where) => errors.push(`${where}: ${(err as Error)?.stack || err}`),
  });
  const start = t;
  runner.begin();
  const maxMs = opts.maxMs ?? Math.max(240_000, meta.duration * 1000 * 4);
  while (!runner.ended && t - start < maxMs) {
    t += STEP_MS;
    runner.step();
  }
  const points: Record<string, number> = {};
  if (runner.results) {
    const norm = normalizeRound(runner.results.perfs);
    for (const [id, n] of Object.entries(norm)) {
      points[id] = n.points;
      if (n.points < 0 || n.points > 1000 || !Number.isFinite(n.points)) errors.push(`invalid points ${id}=${n.points}`);
    }
    for (const p of players) if (!runner.results.perfs[p.id]) errors.push(`missing perf for ${p.id}`);
  }
  return {
    ended: runner.ended,
    simulatedMs: t - start,
    pubCount,
    privCount,
    eventCount,
    errors,
    results: runner.results,
    points,
    maxPubBytes,
  };
}
