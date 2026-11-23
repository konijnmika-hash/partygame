import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, tally } from '../../engine/util';

type Role = 'thief' | 'detective' | 'guard';
const NIGHT_MS = 22_000;
const DAY_MS = 40_000;
const VOTE_MS = 20_000;
const MAX_DAYS = 3;

interface S {
  roles: Record<string, Role>;
  alive: string[];
  day: number;
  phase: 'night' | 'day' | 'vote' | 'verdict' | 'over';
  deadline: number;
  nightPicks: Record<string, string>; // thief -> target
  investigation: string | null;
  investigated: Record<string, Role>; // detective's knowledge
  votes: Record<string, string>;
  lastVictim: string | null;
  lastOut: string | null;
  winner: 'guards' | 'thieves' | null;
  scores: Record<string, number>;
  ready: Record<string, boolean>;
  timer: number | null;
  log: string[];
}

export const hiddenRole = defineGame<S>({
  id: 'hidden-role',
  botDelay: [2000, 5000],
  setup(ctx) {
    const order = ctx.rng.shuffle(ctx.ids);
    const nThieves = ctx.ids.length >= 7 ? 2 : 1;
    const roles: Record<string, Role> = {};
    order.forEach((id, i) => (roles[id] = i < nThieves ? 'thief' : i === nThieves ? 'detective' : 'guard'));
    return { roles, alive: [...ctx.ids], day: 0, phase: 'night', deadline: 0, nightPicks: {}, investigation: null, investigated: {}, votes: {}, lastVictim: null, lastOut: null, winner: null, scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])), ready: {}, timer: null, log: [] };
  },
  start(s, ctx) {
    night(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || !s.alive.includes(pid)) return;
    const target = typeof a.target === 'string' ? a.target : null;
    if (a.t === 'night' && s.phase === 'night' && target && s.alive.includes(target) && target !== pid) {
      ctx.markActed(pid);
      if (s.roles[pid] === 'thief' && s.roles[target] !== 'thief') s.nightPicks[pid] = target;
      else if (s.roles[pid] === 'detective' && !s.investigation) {
        s.investigation = target;
        s.investigated[target] = s.roles[target];
        if (s.roles[target] === 'thief') s.scores[pid] += 50;
      } else if (s.roles[pid] === 'guard') s.ready[pid] = true; // guards "patrol" (keeps night actions secret)
      if (nightDone(s, ctx)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(400, () => dawn(s, ctx));
      }
    } else if (a.t === 'ready' && s.phase === 'day') {
      s.ready[pid] = true;
      if (allDone(ctx, (id) => !s.alive.includes(id) || !!s.ready[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(200, () => voting(s, ctx));
      }
    } else if (a.t === 'vote' && s.phase === 'vote' && !s.votes[pid] && (target === 'skip' || (target && s.alive.includes(target) && target !== pid))) {
      ctx.markActed(pid);
      s.votes[pid] = target!;
      if (allDone(ctx, (id) => !s.alive.includes(id) || !!s.votes[id])) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(300, () => verdict(s, ctx));
      }
    }
  },
  pub(s) {
    return {
      day: s.day,
      phase: s.phase,
      deadline: s.deadline,
      alive: s.alive,
      lastVictim: s.lastVictim,
      lastOut: s.lastOut,
      lastOutRole: s.lastOut ? s.roles[s.lastOut] : null,
      voted: Object.keys(s.votes),
      votes: s.phase === 'verdict' || s.phase === 'over' ? s.votes : null,
      winner: s.winner,
      roles: s.phase === 'over' ? s.roles : null,
      log: s.log.slice(-6),
      // scores would leak roles (thieves score at night), so they stay secret until the end
      scores: s.phase === 'over' ? s.scores : null,
    };
  },
  priv(s, _ctx, pid) {
    const role = s.roles[pid];
    return {
      role,
      partners: role === 'thief' ? Object.keys(s.roles).filter((id) => s.roles[id] === 'thief' && id !== pid) : [],
      investigated: role === 'detective' ? s.investigated : {},
      nightPick: role === 'thief' ? s.nightPicks[pid] ?? null : role === 'detective' ? s.investigation : null,
      myVote: s.votes[pid] ?? null,
    };
  },
  bot(s, ctx, pid) {
    if (!s.alive.includes(pid)) return null;
    const others = s.alive.filter((id) => id !== pid);
    if (s.phase === 'night') {
      const role = s.roles[pid];
      if (role === 'thief' && !s.nightPicks[pid]) return { action: { t: 'night', target: ctx.rng.pick(others.filter((id) => s.roles[id] !== 'thief')) } };
      if (role === 'detective' && !s.investigation) return { action: { t: 'night', target: ctx.rng.pick(others) } };
      if (role === 'guard' && !s.ready[pid]) return { action: { t: 'night', target: ctx.rng.pick(others) } };
    }
    if (s.phase === 'day' && !s.ready[pid]) return { action: { t: 'ready' } };
    if (s.phase === 'vote' && !s.votes[pid]) {
      const known = Object.entries(s.investigated).find(([id, r]) => r === 'thief' && s.alive.includes(id))?.[0];
      if (s.roles[pid] === 'detective' && known) return { action: { t: 'vote', target: known } };
      const pool = s.roles[pid] === 'thief' ? others.filter((id) => s.roles[id] !== 'thief') : others;
      return { action: { t: 'vote', target: ctx.rng.chance(0.15) ? 'skip' : ctx.rng.pick(pool) } };
    }
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      const team = s.roles[id] === 'thief' ? 'thieves' : 'guards';
      const won = s.winner === team;
      perfs[id] = {
        score: (won ? 1000 : 0) + s.scores[id] + (s.alive.includes(id) ? 50 : 0),
        perf: (won ? 0.6 : 0.1) + Math.min(0.3, s.scores[id] / 600) + (s.alive.includes(id) ? 0.1 : 0),
        participated: ctx.acted(id),
        highlight: `${s.roles[id] === 'thief' ? '🦹 Thief' : s.roles[id] === 'detective' ? '🕵️ Detective' : '💂 Guard'} · ${won ? 'won' : 'lost'}${s.alive.includes(id) ? '' : ' · knocked out'}`,
      };
    }
    return { perfs, summary: [s.winner === 'guards' ? '💂 The Guards caught every thief!' : '🦹 The Thieves got away with the loot!'] };
  },
});

function nightDone(s: S, ctx: GameCtx): boolean {
  const thieves = s.alive.filter((id) => s.roles[id] === 'thief');
  const det = s.alive.find((id) => s.roles[id] === 'detective');
  const guards = s.alive.filter((id) => s.roles[id] === 'guard');
  return thieves.every((t) => s.nightPicks[t] || !ctx.isConnected(t)) && (!det || !!s.investigation || !ctx.isConnected(det)) && guards.every((g) => s.ready[g] || !ctx.isConnected(g));
}

function night(s: S, ctx: GameCtx) {
  s.day++;
  s.phase = 'night';
  s.nightPicks = {};
  s.investigation = null;
  s.ready = {};
  s.votes = {};
  s.deadline = ctx.now() + ctx.ms(NIGHT_MS);
  s.timer = ctx.after(ctx.ms(NIGHT_MS), () => dawn(s, ctx));
  ctx.dirty();
}

function dawn(s: S, ctx: GameCtx) {
  const picks = Object.values(s.nightPicks);
  let victim: string | null = null;
  if (picks.length) {
    const t = tally(Object.fromEntries(Object.entries(s.nightPicks)));
    const max = Math.max(...Object.values(t));
    victim = ctx.rng.pick(Object.keys(t).filter((id) => t[id] === max));
  } else {
    const targets = s.alive.filter((id) => s.roles[id] !== 'thief');
    victim = targets.length ? ctx.rng.pick(targets) : null;
  }
  s.lastVictim = victim;
  s.lastOut = null;
  if (victim) {
    s.alive = s.alive.filter((id) => id !== victim);
    s.log.push(`🌙 Night ${s.day}: ${ctx.name(victim)} was robbed and fainted!`);
    for (const t of s.alive.filter((id) => s.roles[id] === 'thief')) s.scores[t] += 40;
  }
  if (checkWin(s, ctx)) return;
  s.phase = 'day';
  s.ready = {};
  s.deadline = ctx.now() + ctx.ms(DAY_MS);
  s.timer = ctx.after(ctx.ms(DAY_MS), () => voting(s, ctx));
  ctx.dirty();
}

function voting(s: S, ctx: GameCtx) {
  s.phase = 'vote';
  s.votes = {};
  s.deadline = ctx.now() + ctx.ms(VOTE_MS);
  s.timer = ctx.after(ctx.ms(VOTE_MS), () => verdict(s, ctx));
  ctx.dirty();
}

function verdict(s: S, ctx: GameCtx) {
  const counts = tally(Object.fromEntries(Object.entries(s.votes).filter(([, t]) => t !== 'skip')));
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((id) => counts[id] === max);
  const skips = Object.values(s.votes).filter((v) => v === 'skip').length;
  s.lastOut = max > 0 && top.length === 1 && max > skips ? top[0] : null;
  for (const [voter, t] of Object.entries(s.votes)) if (t !== 'skip' && s.roles[t] === 'thief' && s.roles[voter] !== 'thief') s.scores[voter] += 80;
  if (s.lastOut) {
    s.alive = s.alive.filter((id) => id !== s.lastOut);
    s.log.push(`☀️ Day ${s.day}: the town sent ${ctx.name(s.lastOut)} away — they were a ${s.roles[s.lastOut]}!`);
  } else s.log.push(`☀️ Day ${s.day}: nobody was sent away.`);
  s.phase = 'verdict';
  ctx.dirty();
  s.timer = ctx.after(4500, () => {
    if (checkWin(s, ctx)) return;
    if (s.day >= MAX_DAYS) {
      s.winner = 'thieves';
      return over(s, ctx);
    }
    night(s, ctx);
  });
}

function checkWin(s: S, ctx: GameCtx): boolean {
  const thieves = s.alive.filter((id) => s.roles[id] === 'thief').length;
  const others = s.alive.length - thieves;
  if (thieves === 0) s.winner = 'guards';
  else if (thieves >= others) s.winner = 'thieves';
  if (s.winner) {
    over(s, ctx);
    return true;
  }
  return false;
}

function over(s: S, ctx: GameCtx) {
  s.phase = 'over';
  ctx.dirty();
  ctx.after(6500, () => ctx.end());
}
