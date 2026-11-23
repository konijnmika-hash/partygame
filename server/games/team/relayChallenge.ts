// Relay Challenge: teammates take turns running a leg — a quick mini-task (mash, maths, aim,
// order, type). Finish your leg to pass the baton. First team through every leg wins.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, str } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';
import { COMMON_WORDS } from '../../content/words';

const TIME_MS = 120_000;
const MASH = 30;
const AIM = 6;
const ORDER = 8;

export type Leg =
  | { k: 'mash'; need: number }
  | { k: 'math'; probs: { q: string; a: number }[] }
  | { k: 'aim'; targets: { x: number; y: number }[] }
  | { k: 'order'; cells: number[] }
  | { k: 'type'; word: string };

interface TeamState { leg: number; prog: number; lockUntil: number; finished: number | null; finishMs: number | null; legStart: number }

interface S {
  legs: Leg[];
  teams: string[][];
  ts: TeamState[];
  places: number;
  startedAt: number;
  endsAt: number;
  lastTap: Record<string, number>;
  legsRun: Record<string, number>;
}

function makeLeg(ctx: GameCtx, kind: Leg['k']): Leg {
  const r = ctx.rng;
  if (kind === 'mash') return { k: 'mash', need: MASH };
  if (kind === 'math') {
    const probs = [0, 1, 2].map(() => {
      if (r.chance(0.5)) {
        const a = r.int(4, 39);
        const b = r.int(3, 29);
        return { q: `${a} + ${b}`, a: a + b };
      }
      const a = r.int(2, 9);
      const b = r.int(2, 9);
      return { q: `${a} × ${b}`, a: a * b };
    });
    return { k: 'math', probs };
  }
  if (kind === 'aim') return { k: 'aim', targets: Array.from({ length: AIM }, () => ({ x: r.int(10, 90), y: r.int(12, 88) })) };
  if (kind === 'order') return { k: 'order', cells: r.sample([...Array(16).keys()], ORDER) };
  const words = COMMON_WORDS.filter((w) => w.length >= 5 && w.length <= 7);
  return { k: 'type', word: r.pick(words) };
}

export const relayChallenge = defineGame<S>({
  id: 'relay-challenge',
  botDelay: [140, 280],
  setup(ctx) {
    const teams = teamList(ctx);
    const L = Math.max(3, Math.min(6, Math.max(...teams.map((m) => m.length))));
    const kinds: Leg['k'][] = ctx.rng.shuffle(['mash', 'math', 'aim', 'order', 'type']);
    const legs = Array.from({ length: L }, (_, i) => makeLeg(ctx, kinds[i % kinds.length]));
    return {
      legs,
      teams,
      ts: teams.map(() => ({ leg: 0, prog: 0, lockUntil: 0, finished: null, finishMs: null, legStart: 0 })),
      places: 0,
      startedAt: 0,
      endsAt: 0,
      lastTap: {},
      legsRun: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
    };
  },
  start(s, ctx) {
    s.startedAt = ctx.now() + 1500;
    s.endsAt = s.startedAt + ctx.ms(TIME_MS);
    for (const t of s.ts) t.legStart = s.startedAt;
    ctx.after(s.endsAt - ctx.now(), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    const now = ctx.now();
    if (now < s.startedAt) return;
    const t = teamOf(ctx, pid);
    const st = s.ts[t];
    if (st.finished != null || runner(s, t, ctx) !== pid || now < st.lockUntil) return;
    const leg = s.legs[st.leg];
    let advanced = false;
    if (leg.k === 'mash' && a.t === 'tap') {
      if (now - (s.lastTap[pid] ?? 0) < 45) return;
      s.lastTap[pid] = now;
      st.prog++;
      advanced = st.prog >= leg.need;
    } else if (leg.k === 'math' && a.t === 'ans') {
      if (typeof a.v !== 'number') return;
      if (a.v === leg.probs[st.prog].a) {
        st.prog++;
        advanced = st.prog >= leg.probs.length;
      } else st.lockUntil = now + 800;
    } else if (leg.k === 'aim' && a.t === 'hit') {
      if (a.i !== st.prog) return;
      st.prog++;
      advanced = st.prog >= leg.targets.length;
    } else if (leg.k === 'order' && a.t === 'num') {
      if (a.v !== st.prog + 1) {
        st.lockUntil = now + 600;
        ctx.markActed(pid);
        ctx.dirty();
        return;
      }
      st.prog++;
      advanced = st.prog >= leg.cells.length;
    } else if (leg.k === 'type' && a.t === 'word') {
      const w = str(a.w, 30);
      if (!w) return;
      if (w.trim().toLowerCase() === leg.word) advanced = true;
      else st.lockUntil = now + 500;
    } else return;
    ctx.markActed(pid);
    if (advanced) {
      s.legsRun[pid]++;
      st.leg++;
      st.prog = 0;
      st.legStart = now;
      if (st.leg >= s.legs.length) {
        st.finished = ++s.places;
        st.finishMs = now - s.startedAt;
        ctx.event('finish', { team: t, place: st.finished });
        if (s.ts.every((x, k) => x.finished != null || !s.teams[k].some((id) => ctx.isConnected(id)))) ctx.after(1500, () => ctx.end());
      } else ctx.event('baton', { team: t, to: runner(s, t, ctx) });
    }
    ctx.dirty();
  },
  pub(s, ctx) {
    return {
      startedAt: s.startedAt,
      endsAt: s.endsAt,
      legs: s.legs,
      teams: s.teams,
      ts: s.ts.map((st, t) => ({ ...st, runner: st.finished != null ? null : runner(s, t, ctx) })),
    };
  },
  bot(s, ctx, pid) {
    const now = ctx.now();
    if (now < s.startedAt) return null;
    const t = teamOf(ctx, pid);
    const st = s.ts[t];
    if (st.finished != null || runner(s, t, ctx) !== pid || now < st.lockUntil) return null;
    const skill = ctx.diff(0.5, 0.7, 0.9);
    const leg = s.legs[st.leg];
    if (Math.random() > 0.45 + skill * 0.5) return null;
    switch (leg.k) {
      case 'mash':
        return { action: { t: 'tap' } };
      case 'math':
        return { action: { t: 'ans', v: Math.random() < skill + 0.05 ? leg.probs[st.prog].a : leg.probs[st.prog].a + 1 } };
      case 'aim':
        return { action: { t: 'hit', i: st.prog } };
      case 'order':
        return { action: { t: 'num', v: Math.random() < skill + 0.08 ? st.prog + 1 : st.prog + 2 } };
      case 'type':
        return now - st.legStart > 1800 + leg.word.length * 260 * (1.5 - skill) ? { action: { t: 'word', w: leg.word } } : null;
    }
  },
  results(s, ctx) {
    const scores = s.ts.map((st) => {
      if (st.finished != null) return 100 + (st.finished === 1 ? 40 : 0) + Math.round(40 * Math.max(0, 1 - (st.finishMs ?? TIME_MS) / TIME_MS));
      return Math.round((st.leg / s.legs.length) * 80);
    });
    return teamResults(ctx, scores, {
      great: 180,
      individual: s.legsRun,
      highlight: (id, t) => {
        const st = s.ts[t];
        return `${st.finished != null ? `Finished #${st.finished} in ${((st.finishMs ?? 0) / 1000).toFixed(1)} s` : `Reached leg ${st.leg + 1}/${s.legs.length}`} · you ran ${s.legsRun[id]} leg${s.legsRun[id] === 1 ? '' : 's'}`;
      },
    });
  },
});

/** Whose leg it is; a disconnected teammate's leg passes to the next connected one. */
function runner(s: S, t: number, ctx: GameCtx): string {
  const members = s.teams[t];
  for (let k = 0; k < members.length; k++) {
    const id = members[(s.ts[t].leg + k) % members.length];
    if (ctx.isConnected(id)) return id;
  }
  return members[s.ts[t].leg % members.length];
}
