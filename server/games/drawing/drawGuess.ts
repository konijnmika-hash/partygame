// Turn-based drawing + guessing. Draw & Guess: typed guesses with letter hints.
// Blind Drawing: the artist's own ink is invisible to them; guessers pick from 8 options.
import { defineGame, type GameCtx, type GameDef } from '../../engine/types';
import { CanvasStore, botScribble, relay } from '../../engine/drawing';
import { isObj, int, str } from '../../engine/util';
import { matchAnswer } from '@shared/validation';
import { DRAW_WORDS_EASY, DRAW_WORDS_MEDIUM } from '../../content/drawing';

interface Opts {
  id: string;
  blind: boolean;
  drawMs: number;
  maxTurns: number;
}

interface S {
  turns: string[];
  turn: number;
  phase: 'choose' | 'draw' | 'reveal';
  options: string[];
  word: string;
  mc: string[];
  startedAt: number;
  deadline: number;
  hints: number[];
  guessed: Record<string, number>;
  lock: Record<string, number>;
  feed: { from: string; text: string; kind: 'guess' | 'correct' | 'close' | 'system' }[];
  scores: Record<string, number>;
  correct: Record<string, number>;
  drawnHits: Record<string, number>;
  canvas: CanvasStore;
  botSeq: number;
  lastGuess: Record<string, number>;
  timers: number[];
}

export function drawGuessGame(o: Opts): GameDef<S> {
  const cvOf = (s: S) => `turn${s.turn}`;

  function next(s: S, ctx: GameCtx) {
    for (const t of s.timers) ctx.cancel(t);
    s.turn++;
    if (s.turn >= s.turns.length) return ctx.end();
    const pool = ctx.difficulty === 'easy' ? DRAW_WORDS_EASY : ctx.difficulty === 'hard' ? DRAW_WORDS_MEDIUM : [...DRAW_WORDS_EASY, ...DRAW_WORDS_MEDIUM];
    s.options = ctx.rng.sample(pool, 3);
    s.word = '';
    s.guessed = {};
    s.lock = {};
    s.hints = [];
    s.mc = [];
    s.phase = 'choose';
    s.deadline = ctx.now() + 9000;
    s.timers = [ctx.after(9000, () => beginDraw(s, ctx, ctx.rng.int(0, 2)))];
    ctx.dirty();
  }

  function beginDraw(s: S, ctx: GameCtx, choice: number) {
    if (s.phase !== 'choose') return;
    for (const t of s.timers) ctx.cancel(t);
    s.word = s.options[choice];
    if (o.blind) {
      const pool = [...DRAW_WORDS_EASY, ...DRAW_WORDS_MEDIUM].filter((w) => w !== s.word);
      s.mc = ctx.rng.shuffle([s.word, ...ctx.rng.sample(pool, 7)]);
    }
    s.phase = 'draw';
    s.startedAt = ctx.now();
    const ms = ctx.ms(o.drawMs);
    s.deadline = s.startedAt + ms;
    s.feed.push({ from: 'system', text: `${ctx.name(s.turns[s.turn])} is drawing!`, kind: 'system' });
    s.timers = [ctx.after(ms, () => reveal(s, ctx))];
    if (!o.blind) {
      const letters = s.word.split('').map((c, i) => (c === ' ' ? -1 : i)).filter((i) => i >= 0);
      const order = ctx.rng.shuffle(letters);
      const nHints = Math.max(1, Math.floor(letters.length / 3));
      s.timers.push(ctx.after(ms * 0.5, () => { s.hints = order.slice(0, Math.ceil(nHints / 2)); ctx.dirty(); }));
      s.timers.push(ctx.after(ms * 0.75, () => { s.hints = order.slice(0, nHints); ctx.dirty(); }));
    }
    ctx.dirty();
  }

  function reveal(s: S, ctx: GameCtx) {
    for (const t of s.timers) ctx.cancel(t);
    s.phase = 'reveal';
    s.feed.push({ from: 'system', text: `The word was “${s.word}”`, kind: 'system' });
    ctx.dirty();
    s.timers = [ctx.after(4000, () => next(s, ctx))];
  }

  function correct(s: S, ctx: GameCtx, pid: string) {
    const drawer = s.turns[s.turn];
    const order = Object.keys(s.guessed).length;
    s.guessed[pid] = order;
    const el = ctx.now() - s.startedAt;
    const pts = Math.max(30, 100 - order * 12) + Math.round(40 * Math.max(0, 1 - el / ctx.ms(o.drawMs)));
    s.scores[pid] += pts;
    s.correct[pid]++;
    s.scores[drawer] += 35;
    s.drawnHits[drawer]++;
    s.feed.push({ from: pid, text: `${ctx.name(pid)} guessed it! +${pts}`, kind: 'correct' });
    ctx.event('correct', { pts }, pid);
    const guessers = ctx.ids.filter((id) => id !== drawer && ctx.isConnected(id));
    if (guessers.every((id) => s.guessed[id] != null)) {
      for (const t of s.timers) ctx.cancel(t);
      s.timers = [ctx.after(700, () => reveal(s, ctx))];
    }
  }

  return defineGame<S>({
    id: o.id,
    botDelay: [700, 1600],
    setup(ctx) {
      const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
      return { turns: ctx.rng.shuffle(ctx.ids).slice(0, Math.min(o.maxTurns, ctx.ids.length)), turn: -1, phase: 'choose', options: [], word: '', mc: [], startedAt: 0, deadline: 0, hints: [], guessed: {}, lock: {}, feed: [], scores: z(), correct: z(), drawnHits: z(), canvas: new CanvasStore(), botSeq: 1, lastGuess: {}, timers: [] };
    },
    start(s, ctx) {
      next(s, ctx);
    },
    action(s, ctx, pid, a) {
      if (!isObj(a)) return;
      const drawer = s.turns[s.turn];
      if (a.t === 'choose' && pid === drawer && s.phase === 'choose') {
        const i = int(a.i, 0, 2);
        if (i == null) return;
        ctx.markActed(pid);
        beginDraw(s, ctx, i);
        return;
      }
      if ((a.t === 'draw' || a.t === 'undo' || a.t === 'clear') && pid === drawer && s.phase === 'draw' && a.cv === cvOf(s)) {
        const r = s.canvas.apply(pid, a);
        if (r) {
          ctx.markActed(pid);
          relay(ctx, r, ctx.ids.filter((id) => id !== pid));
        }
        return;
      }
      if (s.phase !== 'draw' || pid === drawer || s.guessed[pid] != null) return;
      if (!o.blind && a.t === 'guess') {
        const g = str(a.g, 40);
        if (!g) return;
        const now = ctx.now();
        if (now - (s.lastGuess[pid] ?? 0) < 400) return;
        s.lastGuess[pid] = now;
        ctx.markActed(pid);
        const m = matchAnswer(g, [s.word]);
        if (m === 'exact') correct(s, ctx, pid);
        else {
          if (m === 'close') ctx.event('close', { g }, pid);
          s.feed.push({ from: pid, text: g, kind: 'guess' });
          if (s.feed.length > 40) s.feed.splice(0, s.feed.length - 40);
        }
      } else if (o.blind && a.t === 'pick') {
        if ((s.lock[pid] ?? 0) > ctx.now()) return;
        const c = int(a.c, 0, s.mc.length - 1);
        if (c == null) return;
        ctx.markActed(pid);
        if (s.mc[c] === s.word) correct(s, ctx, pid);
        else {
          s.lock[pid] = ctx.now() + 2000;
          ctx.event('wrong', { c }, pid);
        }
      }
    },
    pub(s, ctx) {
      const drawer = s.turns[s.turn];
      return {
        turn: s.turn,
        turns: s.turns.length,
        drawer,
        phase: s.phase,
        deadline: s.deadline,
        startedAt: s.startedAt,
        cv: cvOf(s),
        blind: o.blind,
        mask: s.phase === 'draw' && !o.blind ? s.word.split('').map((c, i) => (c === ' ' ? ' ' : s.hints.includes(i) ? c : '_')).join('') : null,
        len: s.word.length,
        mc: s.phase === 'draw' ? s.mc : null,
        word: s.phase === 'reveal' ? s.word : null,
        guessed: s.guessed,
        feed: s.feed.slice(-14),
        scores: s.scores,
        players: ctx.ids.length,
      };
    },
    priv(s, _ctx, pid) {
      const drawer = s.turns[s.turn];
      return { options: pid === drawer && s.phase === 'choose' ? s.options : null, word: pid === drawer ? s.word : s.guessed[pid] != null ? s.word : null, lockUntil: s.lock[pid] ?? 0 };
    },
    rejoin(s, ctx, pid) {
      s.canvas.sync(ctx, cvOf(s), pid);
    },
    bot(s, ctx, pid) {
      const drawer = s.turns[s.turn];
      if (pid === drawer) {
        if (s.phase === 'choose') return { action: { t: 'choose', i: ctx.rng.int(0, 2) } };
        if (s.phase === 'draw' && Math.random() < 0.6) return { action: botScribble(cvOf(s), s.botSeq++, Math.random) };
        return null;
      }
      if (s.phase !== 'draw' || s.guessed[pid] != null) return null;
      const frac = (ctx.now() - s.startedAt) / ctx.ms(o.drawMs);
      const right = Math.random() < 0.04 + frac * ctx.diff(0.15, 0.22, 0.3);
      if (o.blind) {
        if ((s.lock[pid] ?? 0) > ctx.now()) return null;
        return { action: { t: 'pick', c: right ? s.mc.indexOf(s.word) : ctx.rng.int(0, s.mc.length - 1) } };
      }
      return { action: { t: 'guess', g: right ? s.word : ctx.rng.pick(DRAW_WORDS_EASY) } };
    },
    results(s, ctx) {
      const perfs: Record<string, any> = {};
      const guessTurns = Math.max(1, s.turns.length - 1);
      for (const id of ctx.ids) {
        const drew = s.turns.includes(id);
        perfs[id] = {
          score: s.scores[id],
          perf: Math.min(1, s.correct[id] / guessTurns) * 0.65 + (drew ? Math.min(1, s.drawnHits[id] / Math.max(1, ctx.ids.length - 1)) * 0.35 : 0.2),
          participated: ctx.acted(id),
          highlight: `Guessed ${s.correct[id]}× · ${drew ? `drawing guessed by ${s.drawnHits[id]}` : 'did not draw'}`,
        };
      }
      return { perfs };
    },
  });
}

export const drawGuess = drawGuessGame({ id: 'draw-guess', blind: false, drawMs: 55_000, maxTurns: 4 });
export const blindDrawing = drawGuessGame({ id: 'blind-drawing', blind: true, drawMs: 45_000, maxTurns: 4 });
