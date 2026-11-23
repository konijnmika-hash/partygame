// Helpers for team minigames: who is on which team, and turning team scores into per-player results.
import { teamName } from '@shared/teams';
import type { BreakdownLine } from '@shared/types';
import type { GameCtx, GameResults } from './types';

export function teamOf(ctx: GameCtx, pid: string): number {
  return ctx.player(pid)?.team ?? 0;
}

/** Team index -> members, always at least one entry per team that has players. */
export function teamList(ctx: GameCtx): string[][] {
  if (ctx.teams.length) return ctx.teams.map((t) => [...t]);
  return [ctx.ids.slice()];
}

/**
 * Everyone on a team shares the team result. `individual` adds a small personal component
 * (contribution) so active teammates rank above idle ones on the same team.
 */
export function teamResults(
  ctx: GameCtx,
  teamScores: number[],
  opts: {
    great?: number;
    individual?: Record<string, number>;
    highlight?: (pid: string, team: number) => string;
    bonuses?: (pid: string, team: number) => BreakdownLine[];
    summary?: string[];
  } = {},
): GameResults {
  const best = Math.max(1e-9, ...teamScores);
  const great = opts.great ?? best;
  const ranked = teamScores.map((s, t) => ({ s, t })).sort((a, b) => b.s - a.s);
  const perfs: GameResults['perfs'] = {};
  for (const id of ctx.ids) {
    const t = teamOf(ctx, id);
    const ts = teamScores[t] ?? 0;
    const ind = opts.individual?.[id] ?? 0;
    perfs[id] = {
      // team score dominates; individual contribution only breaks ties inside a team
      score: ts * 1000 + ind,
      perf: Math.max(0, Math.min(1, ts / Math.max(great, 1e-9))),
      participated: ctx.acted(id),
      highlight: opts.highlight?.(id, t) ?? `Team ${teamName(t)} — ${Math.round(ts)}`,
      bonuses: opts.bonuses?.(id, t) ?? [],
    };
  }
  const summary = opts.summary ?? [
    ranked.length > 1 && ranked[0].s === ranked[1].s ? `🤝 It's a tie at ${Math.round(ranked[0].s)}!` : `🏆 Team ${teamName(ranked[0].t)} wins with ${Math.round(ranked[0].s)}`,
  ];
  return { perfs, summary, teamScores: Object.fromEntries(teamScores.map((s, t) => [t, s])) };
}
