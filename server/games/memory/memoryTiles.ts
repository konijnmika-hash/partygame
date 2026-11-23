import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int } from '../../engine/util';

const FACES = ['🍕', '🐙', '🚀', '🌈', '🎸', '🦄', '🍩', '⚽', '🐸', '🌵', '🎩', '🍉', '🦖', '🎲', '🧁', '🐝'];
const TURN_MS = 9000;

interface S {
  faces: string[];
  matched: (string | null)[];
  open: number[];
  turn: number;
  order: string[];
  deadline: number;
  pairs: Record<string, number>;
  phase: 'pick' | 'check';
  timer: number | null;
  seen: Record<string, Record<number, string>>; // bot memory
  lastFlip: { i: number; face: string; by: string } | null;
}

export const memoryTiles = defineGame<S>({
  id: 'memory-tiles',
  botDelay: [700, 1300],
  setup(ctx) {
    const nPairs = ctx.ids.length <= 3 ? 8 : 10;
    const faces = ctx.rng.shuffle(ctx.rng.sample(FACES, nPairs).flatMap((f) => [f, f]));
    return { faces, matched: faces.map(() => null), open: [], turn: 0, order: ctx.rng.shuffle(ctx.ids), deadline: 0, pairs: Object.fromEntries(ctx.ids.map((id) => [id, 0])), phase: 'pick', timer: null, seen: {}, lastFlip: null };
  },
  start(s, ctx) {
    beginTurn(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'flip' || s.phase !== 'pick') return;
    if (s.order[s.turn] !== pid) return;
    const i = int(a.i, 0, s.faces.length - 1);
    if (i == null || s.matched[i] || s.open.includes(i)) return;
    ctx.markActed(pid);
    s.open.push(i);
    s.lastFlip = { i, face: s.faces[i], by: pid };
    for (const id of ctx.ids) (s.seen[id] ??= {})[i] = s.faces[i];
    ctx.event('flip', { i });
    if (s.open.length === 2) {
      s.phase = 'check';
      ctx.cancel(s.timer);
      const [x, y] = s.open;
      const match = s.faces[x] === s.faces[y];
      s.timer = ctx.after(match ? 700 : 1300, () => {
        if (match) {
          s.matched[x] = pid;
          s.matched[y] = pid;
          s.pairs[pid]++;
          ctx.event('match', { by: pid });
        }
        s.open = [];
        if (s.matched.every(Boolean)) return ctx.end();
        if (!match) s.turn = (s.turn + 1) % s.order.length;
        beginTurn(s, ctx);
      });
    }
  },
  pub(s) {
    return {
      cards: s.faces.map((f, i) => (s.matched[i] || s.open.includes(i) ? f : null)),
      matchedBy: s.matched,
      open: s.open,
      turn: s.order[s.turn],
      order: s.order,
      deadline: s.deadline,
      phase: s.phase,
      pairs: s.pairs,
    };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'pick' || s.order[s.turn] !== pid) return null;
    const mem = s.seen[pid] ?? {};
    const skill = ctx.diff(0.5, 0.7, 0.9);
    const unknown = s.faces.map((_, i) => i).filter((i) => !s.matched[i] && !s.open.includes(i));
    if (s.open.length === 1) {
      const f = s.faces[s.open[0]];
      const known = unknown.find((i) => mem[i] === f);
      if (known != null && Math.random() < skill) return { action: { t: 'flip', i: known } };
      const unseen = unknown.filter((i) => mem[i] == null);
      return { action: { t: 'flip', i: ctx.rng.pick(unseen.length ? unseen : unknown) } };
    }
    // look for a remembered pair
    const byFace = new Map<string, number[]>();
    for (const i of unknown) if (mem[i]) byFace.set(mem[i], [...(byFace.get(mem[i]) ?? []), i]);
    for (const idx of byFace.values()) if (idx.length >= 2 && Math.random() < skill) return { action: { t: 'flip', i: idx[0] } };
    const unseen = unknown.filter((i) => mem[i] == null);
    return { action: { t: 'flip', i: ctx.rng.pick(unseen.length ? unseen : unknown) } };
  },
  leave(s, ctx, pid) {
    if (s.order[s.turn] === pid && s.phase === 'pick') {
      ctx.cancel(s.timer);
      s.open = [];
      s.turn = (s.turn + 1) % s.order.length;
      beginTurn(s, ctx);
    }
  },
  results(s, ctx) {
    const total = s.faces.length / 2;
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.pairs[id], perf: Math.min(1, s.pairs[id] / Math.max(1, (total / ctx.ids.length) * 1.6)), participated: ctx.acted(id), highlight: `${s.pairs[id]} pairs` };
    return { perfs };
  },
});

function beginTurn(s: S, ctx: GameCtx) {
  s.phase = 'pick';
  // skip disconnected players
  for (let k = 0; k < s.order.length && !ctx.isConnected(s.order[s.turn]); k++) s.turn = (s.turn + 1) % s.order.length;
  s.deadline = ctx.now() + ctx.ms(TURN_MS);
  s.timer = ctx.after(ctx.ms(TURN_MS), () => {
    s.open = [];
    s.turn = (s.turn + 1) % s.order.length;
    beginTurn(s, ctx);
  });
  ctx.dirty();
}
