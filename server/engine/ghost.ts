// Server wrapper turning a shared GhostDef into a GameDef: authoritative rewindable sims per player.
import { GhostSim, type GhostDef, type GInput } from '@shared/ghost';
import type { BreakdownLine } from '@shared/types';
import type { GameCtx, GameDef, RecordEntry } from './types';
import { isObj } from './util';

export interface GhostOpts<W, S> {
  /** compact public state for rendering a ghost (keep it small, it is broadcast at 10 Hz) */
  pubPlayer(s: S, sim: GhostSim<W, S>): unknown;
  score(w: W, s: S, sim: GhostSim<W, S>, ctx: GameCtx): { score: number; perf: number; highlight?: string; bonuses?: BreakdownLine[]; record?: RecordEntry };
  /** `prev` is the input held on the previous tick (for edge-triggered buttons). */
  bot(w: W, s: S, tick: number, rnd: () => number, skill: number, prev: GInput): GInput;
  summary?(ctx: GameCtx, scores: Record<string, number>): string[];
  /** extra public data computed from the world (e.g. remaining time) */
  extraPub?(w: W, ctx: GameCtx): Record<string, unknown>;
}

interface GState<W, S> {
  seed: number;
  t0: number;
  world: W;
  sims: Record<string, GhostSim<W, S>>;
  privAt: Record<string, number>;
  privCache: Record<string, unknown>;
}

export const GHOST_LEAD_MS = 1200;

export function ghostGame<W, S>(def: GhostDef<W, S>, opts: GhostOpts<W, S>): GameDef<GState<W, S>> {
  const tickMs = 1000 / def.hz;
  const target = (s: GState<W, S>, ctx: GameCtx) => Math.max(0, Math.floor((ctx.now() - s.t0) / tickMs));
  return {
    id: def.id,
    realtime: true,
    pubEvery: 2,
    botDelay: [90, 160],
    setup(ctx) {
      const seed = ctx.rng.int(1, 2_000_000_000);
      const world = def.world(seed, ctx.difficulty);
      const sims: Record<string, GhostSim<W, S>> = {};
      ctx.players.forEach((p, i) => {
        sims[p.id] = new GhostSim(def, world, i, ctx.players.length, 75);
      });
      return { seed, t0: ctx.now() + GHOST_LEAD_MS, world, sims, privAt: {}, privCache: {} };
    },
    tick(s, ctx) {
      const t = target(s, ctx);
      let allDone = true;
      for (const id of ctx.ids) {
        const sim = s.sims[id];
        sim.advanceTo(t);
        if (sim.doneAt == null) allDone = false;
      }
      if (allDone || t >= def.maxTicks) ctx.end();
    },
    action(s, ctx, pid, a) {
      if (!isObj(a) || a.t !== 'gi') return;
      const sim = s.sims[pid];
      if (!sim || sim.doneAt != null) return;
      const k = a.k;
      const i = a.i;
      if (typeof k !== 'number' || !Number.isInteger(k)) return;
      if (!Array.isArray(i) || i.length !== 3) return;
      const [x, y, b] = i;
      if (![x, y, b].every((v) => typeof v === 'number' && Number.isInteger(v))) return;
      if (x < -8 || x > 8 || y < -8 || y > 8 || b < 0 || b > 255) return;
      const now = target(s, ctx);
      const kk = Math.min(Math.max(k, sim.oldest), now + 8);
      sim.applyInput(kk, [x, y, b]);
      ctx.markActed(pid);
    },
    bot(s, ctx, pid) {
      const sim = s.sims[pid];
      if (!sim || sim.doneAt != null) return null;
      const skill = ctx.diff(0.55, 0.75, 0.9);
      const inp = opts.bot(s.world, sim.state, sim.tick, Math.random, skill, sim.inputs.at(sim.tick - 1));
      const cur = sim.inputs.at(sim.tick);
      if (cur[0] !== inp[0] || cur[1] !== inp[1] || cur[2] !== inp[2]) sim.applyInput(sim.tick, inp);
      ctx.markActed(pid);
      return null;
    },
    pub(s, ctx) {
      const p: Record<string, unknown> = {};
      const done: string[] = [];
      for (const id of ctx.ids) {
        const sim = s.sims[id];
        p[id] = opts.pubPlayer(sim.state, sim);
        if (sim.doneAt != null) done.push(id);
      }
      return { seed: s.seed, t0: s.t0, hz: def.hz, diff: ctx.difficulty, p, done, ...(opts.extraPub ? opts.extraPub(s.world, ctx) : {}) };
    },
    priv(s, ctx, pid) {
      const sim = s.sims[pid];
      if (!sim) return null;
      const last = s.privAt[pid] ?? 0;
      if (ctx.now() - last < 300 && s.privCache[pid]) return s.privCache[pid];
      s.privAt[pid] = ctx.now();
      const v = { k: sim.tick, s: sim.state, d: sim.doneAt != null };
      s.privCache[pid] = v;
      return v;
    },
    results(s, ctx) {
      const perfs: Record<string, any> = {};
      const records: Record<string, RecordEntry[]> = {};
      const scores: Record<string, number> = {};
      for (const id of ctx.ids) {
        const sim = s.sims[id];
        const sc = opts.score(s.world, sim.state, sim, ctx);
        scores[id] = sc.score;
        perfs[id] = { score: sc.score, perf: sc.perf, participated: ctx.acted(id), highlight: sc.highlight, bonuses: sc.bonuses };
        if (sc.record) records[id] = [sc.record];
      }
      return { perfs, records, summary: opts.summary?.(ctx, scores) };
    },
  };
}
