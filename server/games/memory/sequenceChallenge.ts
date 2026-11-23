import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, int } from '../../engine/util';

const PADS = 4;
const MAX_LEN = 30;

interface S {
  seq: number[];
  len: number;
  phase: 'show' | 'input' | 'result';
  showStart: number;
  stepMs: number;
  inputUntil: number;
  progress: Record<string, number>;
  alive: string[];
  outAt: Record<string, number>; // sequence length reached when eliminated
  doneThisRound: Record<string, boolean>;
  timer: number | null;
}

export const sequenceChallenge = defineGame<S>({
  id: 'sequence-challenge',
  botDelay: [250, 500],
  setup(ctx) {
    return { seq: Array.from({ length: MAX_LEN }, () => ctx.rng.int(0, PADS - 1)), len: ctx.diff(2, 3, 4), phase: 'show', showStart: 0, stepMs: 600, inputUntil: 0, progress: {}, alive: [...ctx.ids], outAt: {}, doneThisRound: {}, timer: null };
  },
  start(s, ctx) {
    showRound(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'pad' || s.phase !== 'input' || !s.alive.includes(pid) || s.doneThisRound[pid]) return;
    const p = int(a.p, 0, PADS - 1);
    if (p == null) return;
    ctx.markActed(pid);
    const k = s.progress[pid] ?? 0;
    if (s.seq[k] !== p) {
      s.alive = s.alive.filter((id) => id !== pid);
      s.outAt[pid] = s.len - 1;
      ctx.event('out', { expected: s.seq[k] }, pid);
      checkRoundDone(s, ctx);
      return;
    }
    s.progress[pid] = k + 1;
    if (k + 1 >= s.len) {
      s.doneThisRound[pid] = true;
      checkRoundDone(s, ctx);
    }
  },
  pub(s) {
    return {
      len: s.len,
      phase: s.phase,
      // the sequence is revealed only while it is being shown (and only the current length)
      show: s.phase === 'show' ? s.seq.slice(0, s.len) : null,
      showStart: s.showStart,
      stepMs: s.stepMs,
      inputUntil: s.inputUntil,
      alive: s.alive,
      done: Object.keys(s.doneThisRound),
      outAt: s.outAt,
    };
  },
  priv(s, _ctx, pid) {
    return { progress: s.progress[pid] ?? 0 };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'input' || !s.alive.includes(pid) || s.doneThisRound[pid]) return null;
    const k = s.progress[pid] ?? 0;
    const errRate = 0.015 + s.len * ctx.diff(0.012, 0.008, 0.005);
    return { action: { t: 'pad', p: Math.random() < errRate ? (s.seq[k] + 1) % PADS : s.seq[k] } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const records: Record<string, any[]> = {};
    for (const id of ctx.ids) {
      const reached = s.outAt[id] ?? s.len;
      perfs[id] = { score: reached, perf: reached / 14, participated: ctx.acted(id), bonuses: s.alive.includes(id) && s.alive.length === 1 ? [{ label: 'Last one standing', pts: 40 }] : [], highlight: `Remembered ${reached} steps` };
      if (reached > 0) records[id] = [{ key: 'len', label: 'Longest sequence', value: reached, better: 'higher', format: 'int' }];
    }
    return { perfs, records };
  },
});

function showRound(s: S, ctx: GameCtx) {
  if (s.len > MAX_LEN) return ctx.end();
  s.phase = 'show';
  s.progress = {};
  s.doneThisRound = {};
  s.stepMs = Math.max(320, ctx.diff(720, 620, 520) - s.len * 15);
  s.showStart = ctx.now() + 500;
  const showMs = 500 + s.len * s.stepMs + 300;
  s.timer = ctx.after(showMs, () => {
    s.phase = 'input';
    const inputMs = ctx.ms(3000 + s.len * 900);
    s.inputUntil = ctx.now() + inputMs;
    ctx.dirty();
    s.timer = ctx.after(inputMs, () => {
      for (const id of [...s.alive]) {
        if (!s.doneThisRound[id]) {
          s.alive = s.alive.filter((x) => x !== id);
          s.outAt[id] = s.len - 1;
        }
      }
      endRound(s, ctx);
    });
  });
}

function checkRoundDone(s: S, ctx: GameCtx) {
  if (s.alive.every((id) => s.doneThisRound[id] || !ctx.isConnected(id))) {
    ctx.cancel(s.timer);
    s.timer = ctx.after(400, () => endRound(s, ctx));
  }
}

function endRound(s: S, ctx: GameCtx) {
  s.phase = 'result';
  ctx.dirty();
  if (s.alive.length === 0 || s.len >= MAX_LEN) {
    s.timer = ctx.after(1500, () => ctx.end());
    return;
  }
  s.timer = ctx.after(1200, () => {
    s.len++;
    showRound(s, ctx);
  });
}
