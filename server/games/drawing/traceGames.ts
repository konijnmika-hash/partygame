// Scored shape drawing. Eyes Closed: trace the target with invisible ink (target vanishes when you
// start). Drawing From Memory: the doodle flashes, then you redraw it from memory with normal ink.
import { defineGame, type GameCtx, type GameDef } from '../../engine/types';
import { CanvasStore, botScribble } from '../../engine/drawing';
import { allDone, isObj } from '../../engine/util';
import { DOODLES, drawingAccuracy } from '@shared/doodles';

interface Opts {
  id: string;
  rounds: number;
  showMs: number[];
  drawMs: number;
}

interface S {
  round: number;
  doodles: number[];
  phase: 'show' | 'draw' | 'reveal';
  deadline: number;
  canvas: CanvasStore;
  acc: Record<string, number[]>;
  timer: number | null;
  botSeq: number;
  botStroked: Record<string, number>;
  done: Record<string, boolean>;
}

export function traceGame(o: Opts): GameDef<S> {
  const cv = (pid: string, r: number) => `${o.id}:${pid}:${r}`;

  function next(s: S, ctx: GameCtx) {
    s.round++;
    if (s.round >= o.rounds) return ctx.end();
    s.phase = 'show';
    s.botStroked = {};
    s.done = {};
    const show = ctx.ms(o.showMs[s.round] ?? o.showMs[o.showMs.length - 1]);
    s.deadline = ctx.now() + show;
    s.timer = ctx.after(show, () => {
      s.phase = 'draw';
      s.deadline = ctx.now() + ctx.ms(o.drawMs);
      ctx.dirty();
      s.timer = ctx.after(ctx.ms(o.drawMs), () => reveal(s, ctx));
    });
    ctx.dirty();
  }

  function reveal(s: S, ctx: GameCtx) {
    const target = DOODLES[s.doodles[s.round]].strokes;
    const gallery: Record<string, unknown> = {};
    for (const id of ctx.ids) {
      const strokes = s.canvas.snapshot(cv(id, s.round));
      const acc = drawingAccuracy(target, strokes.map((st) => st.p));
      s.acc[id].push(acc);
      gallery[id] = { strokes, acc: Math.round(acc * 100) };
    }
    ctx.asset(`${o.id}:gallery:${s.round}`, gallery);
    s.phase = 'reveal';
    ctx.dirty();
    s.timer = ctx.after(5500, () => next(s, ctx));
  }

  return defineGame<S>({
    id: o.id,
    botDelay: [500, 1100],
    setup(ctx) {
      return { round: -1, doodles: ctx.rng.sample(DOODLES.map((_, i) => i), o.rounds), phase: 'show', deadline: 0, canvas: new CanvasStore(), acc: Object.fromEntries(ctx.ids.map((id) => [id, []])), timer: null, botSeq: 1, botStroked: {}, done: {} };
    },
    start(s, ctx) {
      next(s, ctx);
    },
    action(s, ctx, pid, a) {
      if (!isObj(a) || s.phase !== 'draw') return;
      if ((a.t === 'draw' || a.t === 'undo' || a.t === 'clear') && a.cv === cv(pid, s.round)) {
        if (s.canvas.apply(pid, a)) ctx.markActed(pid);
      } else if (a.t === 'done') {
        // player finished early; when everyone is done we reveal straight away
        s.done[pid] = true;
        if (allDone(ctx, (id) => !!s.done[id])) {
          ctx.cancel(s.timer);
          s.timer = ctx.after(300, () => reveal(s, ctx));
        }
      }
    },
    pub(s, ctx) {
      return {
        round: s.round,
        n: o.rounds,
        phase: s.phase,
        deadline: s.deadline,
        doodle: s.doodles[s.round],
        cvPrefix: o.id,
        acc: Object.fromEntries(ctx.ids.map((id) => [id, s.acc[id].map((a) => Math.round(a * 100))])),
      };
    },
    bot(s, ctx, pid) {
      if (s.phase !== 'draw') return null;
      const n = s.botStroked[pid] ?? 0;
      if (n >= 4) return s.done[pid] ? null : { action: { t: 'done' } };
      s.botStroked[pid] = n + 1;
      // bots trace a noisy copy of the target (so they score something sensible)
      const target = DOODLES[s.doodles[s.round]].strokes;
      const st = target[n % target.length];
      if (!st) return { action: botScribble(cv(pid, s.round), s.botSeq++, Math.random) };
      const noise = ctx.diff(70, 45, 25);
      const p = st.slice(0, 300).map((v) => Math.max(0, Math.min(1000, Math.round(v + (Math.random() - 0.5) * noise))));
      return { action: { t: 'draw', cv: cv(pid, s.round), s: s.botSeq++, c: 0, w: 9, p } };
    },
    results(s, ctx) {
      const perfs: Record<string, any> = {};
      const records: Record<string, any[]> = {};
      for (const id of ctx.ids) {
        const a = s.acc[id];
        const avg = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
        const best = Math.max(0, ...a);
        perfs[id] = { score: avg, perf: Math.min(1, avg / 0.85), participated: ctx.acted(id), bonuses: best >= 0.9 ? [{ label: 'Steady artist (90%+)', pts: 40 }] : [], highlight: `avg accuracy ${Math.round(avg * 100)}% · best ${Math.round(best * 100)}%` };
        if (ctx.acted(id)) records[id] = [{ key: 'best', label: 'Most accurate drawing', value: best, better: 'higher', format: 'pct' }];
      }
      return { perfs, records };
    },
  });
}

export const eyesClosed = traceGame({ id: 'eyes-closed', rounds: 3, showMs: [3000, 3000, 2500], drawMs: 14_000 });
export const memoryDraw = traceGame({ id: 'memory-draw', rounds: 3, showMs: [5000, 4000, 3000], drawMs: 15_000 });
