// Team Reaction: wait for the signal, then tap. "Everyone" signals reward fast, synchronised
// teams; player signals show one teammate per team — only that player should tap.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, reactionTime } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';

const SIGNALS = 8;
const WINDOW = 2000;
const GAP_MS = 2200;

interface Sig { kind: 'all' | 'player'; targets: string[]; at: number; shownAt: number }

interface S {
  i: number;
  phase: 'wait' | 'go' | 'show';
  sigs: Sig[];
  teams: string[][];
  taps: Record<string, number>;
  early: Record<string, boolean>;
  wrongTap: Record<string, boolean>;
  teamScores: number[];
  last: { team: number; pts: number; avg: number | null; sync: boolean }[] | null;
  personalBest: Record<string, number>;
  timer: number | null;
}

export const teamReaction = defineGame<S>({
  id: 'team-reaction',
  botDelay: [120, 240],
  setup(ctx) {
    const teams = teamList(ctx);
    const sigs: Sig[] = [];
    for (let i = 0; i < SIGNALS; i++) {
      const kind = i >= 2 && ctx.rng.chance(0.45) ? 'player' : 'all';
      sigs.push({ kind, targets: kind === 'player' ? teams.map((m) => ctx.rng.pick(m)) : [], at: 0, shownAt: 0 });
    }
    return { i: -1, phase: 'wait', sigs, teams, taps: {}, early: {}, wrongTap: {}, teamScores: teams.map(() => 0), last: null, personalBest: {}, timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'tap') return;
    const sig = s.sigs[s.i];
    if (!sig) return;
    ctx.markActed(pid);
    if (s.phase === 'wait') {
      s.early[pid] = true;
      return;
    }
    if (s.phase !== 'go' || s.taps[pid] != null || s.early[pid]) return;
    if (sig.kind === 'player' && !sig.targets.includes(pid)) {
      s.wrongTap[pid] = true;
      s.taps[pid] = -1;
      ctx.event('wrongTap', { id: pid });
      return;
    }
    const ms = reactionTime(ctx, pid, sig.shownAt, a.ms);
    s.taps[pid] = ms;
    s.personalBest[pid] = Math.min(s.personalBest[pid] ?? 99999, ms);
    if (everyoneDone(s, ctx)) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(250, () => score(s, ctx));
    }
  },
  pub(s) {
    const sig = s.sigs[s.i];
    return {
      i: s.i,
      n: s.sigs.length,
      phase: s.phase,
      kind: s.phase === 'wait' ? null : sig?.kind ?? null,
      targets: s.phase === 'wait' ? [] : sig?.targets ?? [],
      shownAt: s.phase === 'wait' ? 0 : sig?.shownAt ?? 0,
      tapped: Object.keys(s.taps),
      early: Object.keys(s.early),
      teams: s.teams,
      teamScores: s.teamScores,
      last: s.phase === 'show' ? s.last : null,
      taps: s.phase === 'show' ? s.taps : null,
    };
  },
  bot(s, ctx, pid) {
    const sig = s.sigs[s.i];
    if (!sig || s.phase !== 'go' || s.taps[pid] != null) return null;
    const skill = ctx.diff(0.45, 0.7, 0.9);
    if (sig.kind === 'player' && !sig.targets.includes(pid)) return Math.random() < (1 - skill) * 0.04 ? { action: { t: 'tap', ms: 400 } } : null;
    const waited = ctx.now() - sig.shownAt;
    const want = 260 + (1 - skill) * 380 + Math.random() * 160;
    return waited >= want ? { action: { t: 'tap', ms: waited } } : null;
  },
  results(s, ctx) {
    return teamResults(ctx, s.teamScores, {
      great: SIGNALS * 95,
      individual: Object.fromEntries(ctx.ids.map((id) => [id, s.personalBest[id] ? Math.max(0, 1000 - s.personalBest[id]) : 0])),
      highlight: (id, t) => `Team ${Math.round(s.teamScores[t])} pts · your best ${s.personalBest[id] ? `${s.personalBest[id]} ms` : '—'}`,
    });
  },
});

function relevant(s: S, ctx: GameCtx): string[] {
  const sig = s.sigs[s.i];
  const ids = sig.kind === 'player' ? sig.targets : ctx.ids;
  return ids.filter((id) => ctx.isConnected(id) && !s.early[id]);
}

function everyoneDone(s: S, ctx: GameCtx): boolean {
  return relevant(s, ctx).every((id) => s.taps[id] != null);
}

function next(s: S, ctx: GameCtx) {
  s.i++;
  if (s.i >= s.sigs.length) return ctx.end();
  s.phase = 'wait';
  s.taps = {};
  s.early = {};
  s.wrongTap = {};
  s.last = null;
  const wait = ctx.rng.int(1500, 3800);
  ctx.cancel(s.timer);
  ctx.dirty();
  s.timer = ctx.after(wait, () => {
    const sig = s.sigs[s.i];
    sig.shownAt = ctx.now();
    s.phase = 'go';
    ctx.dirty();
    s.timer = ctx.after(WINDOW, () => score(s, ctx));
  });
}

function score(s: S, ctx: GameCtx) {
  if (s.phase !== 'go') return;
  const sig = s.sigs[s.i];
  s.last = s.teams.map((members, t) => {
    const who = sig.kind === 'player' ? [sig.targets[t]] : members;
    const times = who.map((id) => (s.taps[id] != null && s.taps[id] >= 0 ? s.taps[id] : WINDOW));
    const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
    let pts = Math.max(0, Math.round((WINDOW - avg) / 20));
    const tappedAll = who.every((id) => s.taps[id] != null && s.taps[id] >= 0);
    const sync = sig.kind === 'all' && who.length > 1 && tappedAll && Math.max(...times) - Math.min(...times) < 160;
    if (sync) pts += 30;
    for (const id of members) {
      if (s.early[id]) pts -= 15;
      if (s.wrongTap[id]) pts -= 20;
    }
    s.teamScores[t] += pts;
    return { team: t, pts, avg: tappedAll ? Math.round(avg) : null, sync };
  });
  s.phase = 'show';
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(GAP_MS, () => next(s, ctx));
}
