import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, reactionTime } from '../../engine/util';

const FAKES = ['DRAT!', 'DRAGON!', 'DRAWER', 'DRAMA!', 'DRAIN', 'DREW?', 'DRA...', 'DRUM!'];
const WINS_NEEDED = 2;

interface Pair {
  a: string;
  b: string | null;
  wa: number;
  wb: number;
  winner: string | null;
}

interface S {
  bracket: number;
  pairs: Pair[];
  alive: string[];
  phase: 'standoff' | 'draw' | 'result' | 'bracket';
  word: string;
  drawAt: number;
  taps: Record<string, { ms: number | null; fault: boolean }>;
  last: { pair: number; winner: string | null; why: string }[];
  reached: Record<string, number>;
  showdownWins: Record<string, number>;
  times: Record<string, number[]>;
  timer: number | null;
  botAim: Record<string, number>;
}

export const reactionDuel = defineGame<S>({
  id: 'reaction-duel',
  botDelay: [40, 90],
  setup(ctx) {
    const z = Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { bracket: 0, pairs: [], alive: [...ctx.ids], phase: 'bracket', word: '', drawAt: 0, taps: {}, last: [], reached: { ...z }, showdownWins: { ...z }, times: Object.fromEntries(ctx.ids.map((id) => [id, []])), timer: null, botAim: {} };
  },
  start(s, ctx) {
    makeBracket(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'tap') return;
    const pair = s.pairs.find((p) => (p.a === pid || p.b === pid) && !p.winner && p.b);
    if (!pair || s.taps[pid]) return;
    ctx.markActed(pid);
    if (s.phase === 'standoff' || a.early === true) {
      s.taps[pid] = { ms: null, fault: true };
      ctx.event('fault', null, pid);
      checkAllTapped(s, ctx);
      return;
    }
    if (s.phase !== 'draw') return;
    const ms = reactionTime(ctx, pid, s.drawAt, a.ms);
    s.taps[pid] = { ms, fault: false };
    s.times[pid].push(ms);
    checkAllTapped(s, ctx);
  },
  pub(s) {
    return {
      bracket: s.bracket,
      phase: s.phase,
      word: s.word,
      drawAt: s.phase === 'draw' ? s.drawAt : 0,
      pairs: s.pairs.map((p) => ({ a: p.a, b: p.b, wa: p.wa, wb: p.wb, winner: p.winner })),
      alive: s.alive,
      tapped: Object.keys(s.taps),
      last: s.phase === 'result' ? s.last : [],
      need: WINS_NEEDED,
    };
  },
  bot(s, ctx, pid) {
    if (s.taps[pid]) return null;
    const pair = s.pairs.find((p) => (p.a === pid || p.b === pid) && !p.winner && p.b);
    if (!pair) return null;
    if (s.phase === 'standoff') return Math.random() < 0.003 ? { action: { t: 'tap' } } : null;
    if (s.phase !== 'draw') return null;
    const aim = (s.botAim[pid] ??= ctx.diff(430, 330, 260) + Math.random() * 140);
    const el = ctx.now() - s.drawAt;
    return el >= aim ? { action: { t: 'tap', ms: el } } : null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const maxDepth = Math.max(1, Math.ceil(Math.log2(Math.max(2, ctx.ids.length))));
    for (const id of ctx.ids) {
      const t = s.times[id];
      const avg = t.length ? t.reduce((a, b) => a + b, 0) / t.length : 999;
      const champion = s.alive.length === 1 && s.alive[0] === id;
      perfs[id] = {
        score: s.reached[id] * 1000 + s.showdownWins[id] * 10 - avg / 100,
        perf: Math.min(1, (s.reached[id] + (champion ? 1 : 0)) / (maxDepth + 1)) * 0.7 + Math.min(1, s.showdownWins[id] / (WINS_NEEDED * maxDepth)) * 0.3,
        participated: ctx.acted(id),
        bonuses: champion ? [{ label: 'Fastest gun in the west', pts: 50 }] : [],
        highlight: champion ? '🤠 Champion!' : `Out in round ${s.reached[id] + 1}${t.length ? ` · avg ${Math.round(avg)} ms` : ''}`,
      };
    }
    const stats: Record<string, Record<string, number>> = {};
    for (const id of ctx.ids) if (s.times[id].length) stats[id] = { reactionMs: Math.min(...s.times[id]) };
    return { perfs, stats, summary: s.alive.length === 1 ? [`🤠 ${ctx.name(s.alive[0])} is the fastest draw!`] : [] };
  },
});

function makeBracket(s: S, ctx: GameCtx) {
  if (s.alive.length <= 1) return ctx.end();
  const order = ctx.rng.shuffle(s.alive);
  s.pairs = [];
  for (let i = 0; i < order.length; i += 2) s.pairs.push({ a: order[i], b: order[i + 1] ?? null, wa: 0, wb: 0, winner: order[i + 1] ? null : order[i] });
  s.phase = 'bracket';
  ctx.dirty();
  s.timer = ctx.after(2600, () => showdown(s, ctx));
}

function showdown(s: S, ctx: GameCtx) {
  s.taps = {};
  s.botAim = {};
  s.phase = 'standoff';
  s.word = 'Ready...';
  const fakes = ctx.rng.int(0, ctx.diff(1, 2, 3));
  let t = 900 + ctx.rng.next() * 800;
  for (let f = 0; f < fakes; f++) {
    const word = ctx.rng.pick(FAKES);
    ctx.after(t, () => {
      if (s.phase !== 'standoff') return;
      s.word = word;
      ctx.dirty();
    });
    t += 700 + ctx.rng.next() * 700;
    ctx.after(t - 250, () => {
      if (s.phase !== 'standoff') return;
      s.word = '...';
      ctx.dirty();
    });
  }
  t += 300 + ctx.rng.next() * 1200;
  s.timer = ctx.after(t, () => {
    s.phase = 'draw';
    s.word = 'DRAW!';
    s.drawAt = ctx.now();
    ctx.dirty();
    s.timer = ctx.after(2200, () => resolve(s, ctx));
  });
}

function checkAllTapped(s: S, ctx: GameCtx) {
  const active = s.pairs.filter((p) => !p.winner && p.b);
  const done = active.every((p) => {
    const ta = s.taps[p.a];
    const tb = s.taps[p.b!];
    // a pair is decided once both acted, or one faulted, or (during draw) anyone tapped validly
    if (ta?.fault || tb?.fault) return true;
    return !!ta && !!tb;
  });
  if (done) {
    ctx.cancel(s.timer);
    s.timer = ctx.after(s.phase === 'draw' ? 400 : 200, () => resolve(s, ctx));
  }
}

function resolve(s: S, ctx: GameCtx) {
  s.last = [];
  s.pairs.forEach((p, idx) => {
    if (p.winner || !p.b) return;
    const ta = s.taps[p.a];
    const tb = s.taps[p.b];
    let w: string | null = null;
    let why = '';
    if (ta?.fault && !tb?.fault) { w = p.b; why = `${ctx.name(p.a)} drew too early!`; }
    else if (tb?.fault && !ta?.fault) { w = p.a; why = `${ctx.name(p.b)} drew too early!`; }
    else if (ta?.ms != null && (tb?.ms == null || ta.ms < tb.ms)) { w = p.a; why = `${ta.ms} ms${tb?.ms != null ? ` vs ${tb.ms} ms` : ''}`; }
    else if (tb?.ms != null) { w = p.b; why = `${tb.ms} ms${ta?.ms != null ? ` vs ${ta.ms} ms` : ''}`; }
    else why = 'Nobody drew!';
    if (w === p.a) p.wa++;
    if (w === p.b) p.wb++;
    if (w) s.showdownWins[w]++;
    if (p.wa >= WINS_NEEDED) p.winner = p.a;
    if (p.wb >= WINS_NEEDED) p.winner = p.b;
    s.last.push({ pair: idx, winner: w, why });
  });
  s.phase = 'result';
  ctx.dirty();
  s.timer = ctx.after(2200, () => {
    if (s.pairs.every((p) => p.winner)) {
      const winners = s.pairs.map((p) => p.winner!);
      for (const id of winners) s.reached[id] = s.bracket + 1;
      s.alive = winners;
      s.bracket++;
      makeBracket(s, ctx);
    } else showdown(s, ctx);
  });
}
