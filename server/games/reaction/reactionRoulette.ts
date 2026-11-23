import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int, reactionTime, allDone } from '../../engine/util';

type Kind = 'color' | 'needle' | 'count' | 'arrow' | 'odd';
const KINDS: Kind[] = ['color', 'needle', 'count', 'arrow', 'odd'];
const TITLES: Record<Kind, string> = {
  color: 'Tap on the colour!',
  needle: 'Stop the needle in the zone!',
  count: 'Tap EXACTLY this many times!',
  arrow: 'Arrow rush!',
  odd: 'Find the odd one!',
};
const COLORS = [['RED', '#ff4f5f'], ['BLUE', '#3da9fc'], ['GREEN', '#34cf78'], ['YELLOW', '#ffd23f'], ['PURPLE', '#9b6bff'], ['PINK', '#ff4f9a']];
const ODD_PAIRS = [['😀', '😃'], ['🐶', '🐕'], ['🌕', '🌝'], ['🍏', '🍎'], ['🔵', '🟦'], ['⭐', '🌟'], ['😺', '😸'], ['🌲', '🌳'], ['🔶', '🔸'], ['🙂', '🙃']];
const DIRS = ['up', 'down', 'left', 'right'] as const;
const SPINS = 8;

interface Res {
  ok: boolean;
  val: number; // lower is better
  pts: number;
}

interface S {
  spin: number;
  kinds: Kind[];
  phase: 'spin' | 'play' | 'result';
  kind: Kind;
  startAt: number;
  params: any;
  colorIdx: number;
  colorShownAt: number;
  results: Record<string, Res>;
  counts: Record<string, number>;
  arrowIdx: Record<string, number>;
  penalties: Record<string, number>;
  scores: Record<string, number>;
  wins: Record<string, number>;
  timer: number | null;
  colorTimer: number | null;
  botPlan: Record<string, number>;
}

export const reactionRoulette = defineGame<S>({
  id: 'reaction-roulette',
  botDelay: [60, 140],
  setup(ctx) {
    const kinds: Kind[] = [];
    let bag: Kind[] = [];
    for (let i = 0; i < SPINS; i++) {
      if (!bag.length) bag = ctx.rng.shuffle(KINDS);
      kinds.push(bag.pop()!);
    }
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { spin: -1, kinds, phase: 'spin', kind: kinds[0], startAt: 0, params: {}, colorIdx: 0, colorShownAt: 0, results: {}, counts: {}, arrowIdx: {}, penalties: {}, scores: z(), wins: z(), timer: null, colorTimer: null, botPlan: {} };
  },
  start(s, ctx) {
    nextSpin(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || s.phase !== 'play' || s.results[pid]) return;
    ctx.markActed(pid);
    const p = s.params;
    switch (s.kind) {
      case 'color': {
        if (a.t !== 'tap') return;
        if (s.colorIdx !== p.target) return finish(s, ctx, pid, { ok: false, val: 9e9, pts: 0 });
        finish(s, ctx, pid, { ok: true, val: reactionTime(ctx, pid, s.colorShownAt, a.ms), pts: 0 });
        return;
      }
      case 'needle': {
        if (a.t !== 'tap') return;
        const el = reactionTime(ctx, pid, s.startAt, a.ms);
        const pos = needleAt(el, p.period);
        const off = Math.abs(pos - p.center);
        finish(s, ctx, pid, { ok: off <= p.half, val: off, pts: 0 });
        return;
      }
      case 'count': {
        if (a.t !== 'tap') return;
        s.counts[pid] = (s.counts[pid] ?? 0) + 1;
        if (s.counts[pid] === p.n) {
          s.penalties[pid] = ctx.now() - s.startAt; // provisional finish time; over-taps invalidate later
        } else if (s.counts[pid] > p.n) {
          finish(s, ctx, pid, { ok: false, val: 9e9, pts: 0 });
        }
        ctx.dirty();
        return;
      }
      case 'arrow': {
        if (a.t !== 'dir' || typeof a.d !== 'string') return;
        const idx = s.arrowIdx[pid] ?? 0;
        if (a.d === p.seq[idx]) {
          s.arrowIdx[pid] = idx + 1;
          if (idx + 1 >= p.seq.length) finish(s, ctx, pid, { ok: true, val: ctx.now() - s.startAt + (s.penalties[pid] ?? 0) - ctx.rtt(pid) / 2, pts: 0 });
        } else {
          s.penalties[pid] = (s.penalties[pid] ?? 0) + 800;
          ctx.event('wrong', null, pid);
        }
        return;
      }
      case 'odd': {
        if (a.t !== 'pick') return;
        const i = int(a.i, 0, p.grid.length - 1);
        if (i == null) return;
        finish(s, ctx, pid, i === p.odd ? { ok: true, val: ctx.now() - s.startAt - ctx.rtt(pid) / 2, pts: 0 } : { ok: false, val: 9e9, pts: 0 });
        return;
      }
    }
  },
  pub(s) {
    const p = s.params;
    const pubParams =
      s.kind === 'color' ? { targetName: COLORS[p.target]?.[0], targetHex: COLORS[p.target]?.[1] }
        : s.kind === 'needle' ? { period: p.period, center: p.center, half: p.half }
          : s.kind === 'count' ? { n: p.n }
            : s.kind === 'arrow' ? { len: p.seq?.length ?? 0 }
              : s.kind === 'odd' ? { grid: p.grid } : {};
    return {
      spin: s.spin,
      n: SPINS,
      phase: s.phase,
      kind: s.kind,
      title: TITLES[s.kind],
      params: pubParams,
      startAt: s.startAt,
      color: s.kind === 'color' && s.phase === 'play' ? COLORS[s.colorIdx][1] : null,
      colorName: s.kind === 'color' && s.phase === 'play' ? COLORS[s.colorIdx][0] : null,
      done: Object.keys(s.results),
      results: s.phase === 'result' ? s.results : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    const p = s.params;
    return {
      count: s.counts[pid] ?? 0,
      arrow: s.kind === 'arrow' && s.phase === 'play' && p.seq ? p.seq[s.arrowIdx[pid] ?? 0] ?? null : null,
      arrowIdx: s.arrowIdx[pid] ?? 0,
      res: s.results[pid] ?? null,
    };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'play' || s.results[pid]) return null;
    const p = s.params;
    const el = ctx.now() - s.startAt;
    const skill = ctx.diff(0.6, 0.78, 0.92);
    switch (s.kind) {
      case 'color': {
        if (s.colorIdx !== p.target) return null;
        const aim = (s.botPlan[pid] ??= 260 + Math.random() * 300);
        const r = ctx.now() - s.colorShownAt;
        return r >= aim ? { action: { t: 'tap', ms: r } } : null;
      }
      case 'needle': {
        const pos = needleAt(el, p.period);
        if (Math.abs(pos - p.center) < p.half * (1.2 - skill) + 0.02 && Math.random() < 0.7) return { action: { t: 'tap', ms: el } };
        return el > p.period * 3 ? { action: { t: 'tap', ms: el } } : null;
      }
      case 'count': {
        const c = s.counts[pid] ?? 0;
        // sloppy bots sometimes overshoot the exact count
        if (c >= p.n) return Math.random() < (1 - skill) * 0.12 ? { action: { t: 'tap' } } : null;
        return { action: { t: 'tap' } };
      }
      case 'arrow': {
        const want = p.seq[s.arrowIdx[pid] ?? 0];
        return { action: { t: 'dir', d: Math.random() < skill + 0.1 ? want : ctx.rng.pick(DIRS) } };
      }
      case 'odd': {
        if (el < 1600 + Math.random() * 2400) return null;
        return { action: { t: 'pick', i: Math.random() < skill ? p.odd : ctx.rng.int(0, p.grid.length - 1) } };
      }
    }
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) {
      perfs[id] = { score: s.scores[id], perf: s.scores[id] / (SPINS * 100), participated: ctx.acted(id), highlight: `${s.wins[id]} spin wins` };
    }
    return { perfs };
  },
});

function needleAt(ms: number, period: number): number {
  // triangle wave 0..1..0
  const ph = (ms % period) / period;
  return ph < 0.5 ? ph * 2 : 2 - ph * 2;
}

function finish(s: S, ctx: GameCtx, pid: string, r: Res) {
  if (s.results[pid]) return;
  s.results[pid] = r;
  if (allDone(ctx, (id) => !!s.results[id])) {
    ctx.cancel(s.timer);
    s.timer = ctx.after(400, () => endSpin(s, ctx));
  }
}

function nextSpin(s: S, ctx: GameCtx) {
  s.spin++;
  if (s.spin >= SPINS) return ctx.end();
  s.kind = s.kinds[s.spin];
  s.phase = 'spin';
  s.results = {};
  s.counts = {};
  s.arrowIdx = {};
  s.penalties = {};
  s.botPlan = {};
  const rng = ctx.rng;
  switch (s.kind) {
    case 'color':
      s.params = { target: rng.int(0, COLORS.length - 1) };
      break;
    case 'needle': {
      const half = ctx.diff(0.09, 0.07, 0.05);
      s.params = { period: ctx.diff(1700, 1400, 1100), center: Math.round((0.2 + rng.next() * 0.6) * 100) / 100, half };
      break;
    }
    case 'count':
      s.params = { n: rng.int(6, ctx.diff(9, 12, 15)) };
      break;
    case 'arrow':
      s.params = { seq: Array.from({ length: ctx.diff(5, 6, 8) }, () => rng.pick(DIRS)) };
      break;
    case 'odd': {
      const [a, b] = rng.pick(ODD_PAIRS);
      const n = ctx.diff(16, 20, 25);
      const odd = rng.int(0, n - 1);
      s.params = { grid: Array.from({ length: n }, (_, i) => (i === odd ? b : a)), odd };
      break;
    }
  }
  ctx.dirty();
  s.timer = ctx.after(1900, () => beginPlay(s, ctx));
}

function beginPlay(s: S, ctx: GameCtx) {
  s.phase = 'play';
  s.startAt = ctx.now();
  ctx.dirty();
  if (s.kind === 'color') {
    // cycle colours live; the target appears after a few changes
    const steps = ctx.rng.int(2, 6);
    let i = 0;
    const tick = () => {
      if (s.phase !== 'play') return;
      i++;
      let c = ctx.rng.int(0, COLORS.length - 1);
      if (i === steps) c = s.params.target;
      else if (c === s.params.target) c = (c + 1) % COLORS.length;
      s.colorIdx = c;
      if (c === s.params.target) s.colorShownAt = ctx.now();
      ctx.dirty();
      if (i < steps) s.colorTimer = ctx.after(ctx.diff(900, 750, 600) + ctx.rng.int(0, 400), tick);
    };
    s.colorIdx = (s.params.target + 1) % COLORS.length;
    s.colorTimer = ctx.after(700, tick);
  }
  const limit = s.kind === 'color' ? 9000 : s.kind === 'needle' ? 7000 : s.kind === 'count' ? 6500 : s.kind === 'arrow' ? 9000 : 9000;
  s.timer = ctx.after(limit, () => endSpin(s, ctx));
}

function endSpin(s: S, ctx: GameCtx) {
  ctx.cancel(s.colorTimer);
  if (s.kind === 'count') {
    for (const id of ctx.ids) {
      if (s.results[id]) continue;
      const c = s.counts[id] ?? 0;
      s.results[id] = c === s.params.n ? { ok: true, val: s.penalties[id] ?? 9e8, pts: 0 } : { ok: false, val: 9e9, pts: 0 };
    }
  }
  for (const id of ctx.ids) if (!s.results[id]) s.results[id] = { ok: false, val: 9e9, pts: 0 };
  const ok = ctx.ids.filter((id) => s.results[id].ok).sort((a, b) => s.results[a].val - s.results[b].val);
  const n = Math.max(2, ctx.ids.length);
  ok.forEach((id, rank) => {
    const pts = Math.round(40 + 60 * ((n - 1 - rank) / (n - 1)));
    s.results[id].pts = pts;
    s.scores[id] += pts;
    if (rank === 0) s.wins[id]++;
  });
  // needle: near misses still get a few points
  if (s.kind === 'needle') {
    for (const id of ctx.ids) {
      const r = s.results[id];
      if (!r.ok && r.val < 0.25) {
        r.pts = Math.round(20 * (1 - r.val / 0.25));
        s.scores[id] += r.pts;
      }
    }
  }
  s.phase = 'result';
  ctx.dirty();
  s.timer = ctx.after(2000, () => nextSpin(s, ctx));
}
