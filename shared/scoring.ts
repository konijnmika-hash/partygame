// Scoring normalization: every minigame reports raw performance, and this module converts it
// into a balanced 0..1000 round score so no single minigame dominates the leaderboard.
//
//   placement   up to 500  (rank among the players in the round, ties share)
//   performance up to 400  (game-specific absolute performance 0..1)
//   participation      50  (took at least one valid action)
//   bonuses     up to  50  (game-specific feats: perfect run, fastest, MVP...)
//
// Non-participants get no placement, no participation and no bonus points.

import type { BreakdownLine } from './types';

export const SCORE_RULES = {
  placement: 500,
  performance: 400,
  participation: 50,
  bonusCap: 50,
  max: 1000,
} as const;

export interface Perf {
  /** raw score used for ranking (higher is better). Team games give teammates the team score. */
  score: number;
  /** absolute performance 0..1 */
  perf: number;
  participated: boolean;
  bonuses?: BreakdownLine[];
  highlight?: string;
}

export interface NormalizedScore {
  points: number;
  rank: number;
  breakdown: BreakdownLine[];
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function normalizeRound(perfs: Record<string, Perf>): Record<string, NormalizedScore> {
  const ids = Object.keys(perfs);
  const n = ids.length;
  const active = ids.filter((id) => perfs[id].participated);
  const idle = ids.filter((id) => !perfs[id].participated);
  // sort active players by score descending
  active.sort((a, b) => sanitize(perfs[b].score) - sanitize(perfs[a].score));

  const out: Record<string, NormalizedScore> = {};
  let pos = 0;
  while (pos < active.length) {
    const s = sanitize(perfs[active[pos]].score);
    let end = pos;
    while (end + 1 < active.length && sanitize(perfs[active[end + 1]].score) === s) end++;
    const avgPos = (pos + end) / 2 + 1; // 1-based average position for ties
    const rank = pos + 1;
    for (let i = pos; i <= end; i++) {
      const id = active[i];
      const p = perfs[id];
      const placement = n <= 1 ? SCORE_RULES.placement : Math.round((SCORE_RULES.placement * (n - avgPos)) / (n - 1));
      const performance = Math.round(SCORE_RULES.performance * clamp01(p.perf));
      const breakdown: BreakdownLine[] = [
        { label: `${ordinal(rank)} place`, pts: placement },
        { label: `Performance ${Math.round(clamp01(p.perf) * 100)}%`, pts: performance },
        { label: 'Participation', pts: SCORE_RULES.participation },
      ];
      let bonusTotal = 0;
      for (const b of p.bonuses || []) {
        const pts = Math.max(0, Math.min(Math.round(b.pts), SCORE_RULES.bonusCap - bonusTotal));
        if (pts <= 0) continue;
        bonusTotal += pts;
        breakdown.push({ label: b.label, pts });
      }
      const points = Math.min(SCORE_RULES.max, placement + performance + SCORE_RULES.participation + bonusTotal);
      out[id] = { points, rank, breakdown };
    }
    pos = end + 1;
  }
  const idleRank = active.length + 1;
  for (const id of idle) {
    out[id] = { points: 0, rank: idleRank, breakdown: [{ label: 'Did not participate', pts: 0 }] };
  }
  return out;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function sanitize(v: number): number {
  return Number.isFinite(v) ? v : -Infinity;
}

/** Leaderboard points are scaled by the share of human players, so bot-farming is not profitable. */
export function leaderboardPoints(points: number, humans: number, participants: number): number {
  if (participants <= 0) return 0;
  return Math.round(points * Math.min(1, humans / participants));
}

/** Helper for games: map a value into 0..1 between a "bad" and a "great" reference. */
export function perfBetween(value: number, bad: number, great: number): number {
  if (great === bad) return value >= great ? 1 : 0;
  return clamp01((value - bad) / (great - bad));
}
