import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int } from '../../engine/util';

const DURATION = 40_000;
const KINDS = { big: { r: 70, pts: 1 }, small: { r: 46, pts: 2 }, tiny: { r: 30, pts: 3 }, skull: { r: 56, pts: -2 } } as const;
type Kind = keyof typeof KINDS;

interface Target {
  id: number;
  x: number;
  y: number;
  kind: Kind;
  born: number;
  ttl: number;
  claims: { pid: string; t: number }[];
  owner: string | null;
}

interface S {
  endsAt: number;
  seq: number;
  targets: Target[];
  pops: { id: number; x: number; y: number; pid: string; kind: Kind; at: number }[];
  scores: Record<string, number>;
  hits: Record<string, number>;
  skulls: Record<string, number>;
  botTarget: Record<string, number>;
}

export const quickClick = defineGame<S>({
  id: 'quick-click',
  botDelay: [350, 800],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { endsAt: 0, seq: 0, targets: [], pops: [], scores: z(), hits: z(), skulls: z(), botTarget: {} };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(DURATION);
    spawnLoop(s, ctx);
    ctx.after(ctx.ms(DURATION), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'hit') return;
    const id = int(a.id, 0, 1e6);
    const tg = s.targets.find((t) => t.id === id);
    if (!tg || tg.owner) return;
    ctx.markActed(pid);
    if (tg.kind === 'skull') {
      s.scores[pid] += KINDS.skull.pts;
      s.skulls[pid]++;
      tg.owner = pid;
      s.pops.push({ id: tg.id, x: tg.x, y: tg.y, pid, kind: 'skull', at: ctx.now() });
      s.targets = s.targets.filter((t) => t !== tg);
      ctx.event('skull', null, pid);
      return;
    }
    if (tg.claims.some((c) => c.pid === pid)) return;
    // latency-compensated claim window: earliest (receive time - half RTT) wins
    tg.claims.push({ pid, t: ctx.now() - ctx.rtt(pid) / 2 });
    if (tg.claims.length === 1) ctx.after(90, () => resolve(s, ctx, tg));
  },
  pub(s, ctx) {
    const now = ctx.now();
    s.pops = s.pops.filter((p) => now - p.at < 900);
    return { endsAt: s.endsAt, targets: s.targets.filter((t) => !t.owner).map((t) => ({ id: t.id, x: t.x, y: t.y, kind: t.kind, born: t.born, ttl: t.ttl })), pops: s.pops, scores: s.scores };
  },
  bot(s, ctx, pid) {
    const live = s.targets.filter((t) => !t.owner && ctx.now() - t.born > 250);
    if (!live.length) return null;
    const avoid = Math.random() < ctx.diff(0.75, 0.85, 0.95);
    const options = avoid ? live.filter((t) => t.kind !== 'skull') : live;
    if (!options.length || Math.random() < 0.35) return null;
    return { action: { t: 'hit', id: ctx.rng.pick(options).id } };
  },
  results(s, ctx) {
    const best = Math.max(10, ...Object.values(s.scores));
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      perfs[id] = { score: s.scores[id], perf: Math.max(0, s.scores[id]) / Math.max(best, 18), participated: ctx.acted(id), bonuses: s.skulls[id] === 0 && s.hits[id] >= 5 ? [{ label: 'Skull dodger', pts: 30 }] : [], highlight: `${s.hits[id]} targets · ${s.skulls[id]} skulls` };
    }
    return { perfs };
  },
});

function resolve(s: S, ctx: GameCtx, tg: Target) {
  if (tg.owner || !s.targets.includes(tg)) return;
  const win = tg.claims.reduce((a, b) => (b.t < a.t ? b : a));
  tg.owner = win.pid;
  s.scores[win.pid] += KINDS[tg.kind].pts;
  s.hits[win.pid]++;
  s.pops.push({ id: tg.id, x: tg.x, y: tg.y, pid: win.pid, kind: tg.kind, at: ctx.now() });
  s.targets = s.targets.filter((t) => t !== tg);
  ctx.dirty();
}

function spawnLoop(s: S, ctx: GameCtx) {
  const now = ctx.now();
  s.targets = s.targets.filter((t) => t.owner == null && now - t.born < t.ttl);
  if (now < s.endsAt - 600 && s.targets.length < 3 + Math.min(4, Math.floor(ctx.players.length / 2))) {
    const roll = ctx.rng.next();
    const kind: Kind = roll < 0.14 ? 'skull' : roll < 0.45 ? 'big' : roll < 0.8 ? 'small' : 'tiny';
    const r = KINDS[kind].r;
    s.targets.push({ id: ++s.seq, x: Math.round(r + ctx.rng.next() * (1000 - 2 * r)), y: Math.round(r + ctx.rng.next() * (700 - 2 * r)), kind, born: now, ttl: ctx.diff(3200, 2600, 2000) + ctx.rng.int(0, 800), claims: [], owner: null });
    ctx.dirty();
  }
  ctx.after(ctx.ms(ctx.diff(700, 520, 420) + ctx.rng.int(0, 400)), () => spawnLoop(s, ctx));
}
