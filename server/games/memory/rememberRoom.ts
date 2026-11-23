import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, int } from '../../engine/util';

const OBJECTS = ['🛋️', '🪴', '🖼️', '🕰️', '📚', '🧸', '🎸', '🐱', '🐶', '💡', '🪑', '🧦', '☕', '🍎', '🎮', '📺', '🧁', '🎈', '⚽', '🪀', '🦆', '🌵', '🕯️', '📦'];
const TINTS = [['red', '#ff8a8f'], ['blue', '#8fc9ff'], ['green', '#8ff0b3'], ['yellow', '#ffe58a'], ['purple', '#c9b0ff']];
const SCENES = 3;
const QUESTIONS = 3;
const COLS = 4;
const ROWS = 3;

interface Item {
  e: string;
  c: number;
}
interface Q {
  text: string;
  choices: string[];
  answer: number;
}
interface S {
  scene: number;
  q: number;
  phase: 'study' | 'question' | 'reveal';
  grid: (Item | null)[];
  questions: Q[];
  shownAt: number;
  deadline: number;
  picks: Record<string, { c: number; ms: number }>;
  gains: Record<string, number>;
  scores: Record<string, number>;
  right: Record<string, number>;
  timer: number | null;
}

function makeScene(ctx: GameCtx): { grid: (Item | null)[]; questions: Q[] } {
  const n = COLS * ROWS;
  const count = ctx.diff(7, 9, 10);
  const pool = ctx.rng.shuffle(OBJECTS);
  // allow one duplicated object for counting questions
  const base = pool.slice(0, count - 2);
  const dup = base[0];
  const objs = ctx.rng.shuffle([...base, dup, dup]);
  const slots = ctx.rng.sample(Array.from({ length: n }, (_, i) => i), objs.length);
  const grid: (Item | null)[] = Array.from({ length: n }, () => null);
  objs.forEach((e, k) => (grid[slots[k]] = { e, c: ctx.rng.int(0, TINTS.length - 1) }));
  const present = [...new Set(objs)];
  const absent = pool.slice(count);
  const qs: Q[] = [];
  const shuffleQ = (text: string, correct: string, wrong: string[]): Q => {
    const choices = ctx.rng.shuffle([correct, ...wrong.slice(0, 3)]);
    return { text, choices, answer: choices.indexOf(correct) };
  };
  const kinds = ctx.rng.shuffle(['present', 'absent', 'count', 'color', 'where']);
  for (const k of kinds.slice(0, QUESTIONS)) {
    if (k === 'present') qs.push(shuffleQ('Which of these WAS in the room?', ctx.rng.pick(present), ctx.rng.sample(absent, 3)));
    else if (k === 'absent') qs.push(shuffleQ('Which of these was NOT in the room?', ctx.rng.pick(absent), ctx.rng.sample(present, 3)));
    else if (k === 'count') {
      const num = objs.filter((o) => o === dup).length;
      qs.push(shuffleQ(`How many ${dup} were in the room?`, String(num), ['1', '2', '3', '4', '5'].filter((x) => x !== String(num))));
    } else if (k === 'color') {
      const idx = slots[ctx.rng.int(0, slots.length - 1)];
      const it = grid[idx]!;
      if (objs.filter((o) => o === it.e).length > 1) {
        qs.push(shuffleQ('Which of these WAS in the room?', ctx.rng.pick(present), ctx.rng.sample(absent, 3)));
        continue;
      }
      qs.push(shuffleQ(`What colour was the tile behind ${it.e}?`, TINTS[it.c][0], ctx.rng.shuffle(TINTS.map((t) => t[0]).filter((t) => t !== TINTS[it.c][0]))));
    } else {
      const idx = slots.find((sl) => objs.filter((o) => o === grid[sl]!.e).length === 1) ?? slots[0];
      const it = grid[idx]!;
      const col = idx % COLS;
      const where = col === 0 ? 'Far left' : col === COLS - 1 ? 'Far right' : 'Middle';
      const row = Math.floor(idx / COLS);
      const ans = `${row === 0 ? 'Top' : row === ROWS - 1 ? 'Bottom' : 'Centre'} · ${where}`;
      const opts = ['Top · Far left', 'Top · Middle', 'Top · Far right', 'Centre · Far left', 'Centre · Middle', 'Centre · Far right', 'Bottom · Far left', 'Bottom · Middle', 'Bottom · Far right'];
      qs.push(shuffleQ(`Where was ${it.e}?`, ans, ctx.rng.shuffle(opts.filter((o) => o !== ans))));
    }
  }
  return { grid, questions: qs };
}

export const rememberRoom = defineGame<S>({
  id: 'remember-room',
  botDelay: [800, 2200],
  setup(ctx) {
    const z = () => Object.fromEntries(ctx.ids.map((id) => [id, 0]));
    return { scene: -1, q: 0, phase: 'study', grid: [], questions: [], shownAt: 0, deadline: 0, picks: {}, gains: {}, scores: z(), right: z(), timer: null };
  },
  start(s, ctx) {
    nextScene(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'pick' || s.phase !== 'question' || s.picks[pid]) return;
    const c = int(a.c, 0, 3);
    if (c == null) return;
    ctx.markActed(pid);
    s.picks[pid] = { c, ms: ctx.now() - s.shownAt };
    if (allDone(ctx, (id) => !!s.picks[id])) {
      ctx.cancel(s.timer);
      s.timer = ctx.after(300, () => reveal(s, ctx));
    }
  },
  pub(s) {
    const q = s.questions[s.q];
    return {
      scene: s.scene,
      n: SCENES,
      qi: s.q,
      qn: QUESTIONS,
      phase: s.phase,
      grid: s.phase === 'study' || s.phase === 'reveal' ? s.grid.map((g) => (g ? { e: g.e, hex: TINTS[g.c][1] } : null)) : null,
      cols: COLS,
      question: s.phase !== 'study' && q ? { text: q.text, choices: q.choices } : null,
      answer: s.phase === 'reveal' ? q?.answer : null,
      deadline: s.deadline,
      shownAt: s.shownAt,
      answered: Object.keys(s.picks),
      gains: s.phase === 'reveal' ? s.gains : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    return { mine: s.picks[pid]?.c ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'question' || s.picks[pid]) return null;
    const q = s.questions[s.q];
    return { action: { t: 'pick', c: Math.random() < ctx.diff(0.5, 0.65, 0.8) ? q.answer : ctx.rng.int(0, 3) } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const total = SCENES * QUESTIONS;
    for (const id of ctx.ids) perfs[id] = { score: s.scores[id], perf: s.scores[id] / (total * 150), participated: ctx.acted(id), bonuses: s.right[id] === total ? [{ label: 'Total recall', pts: 50 }] : [], highlight: `${s.right[id]}/${total} correct` };
    return { perfs };
  },
});

function nextScene(s: S, ctx: GameCtx) {
  s.scene++;
  if (s.scene >= SCENES) return ctx.end();
  const sc = makeScene(ctx);
  s.grid = sc.grid;
  s.questions = sc.questions;
  s.q = 0;
  s.phase = 'study';
  s.shownAt = ctx.now();
  const ms = ctx.ms(ctx.diff(8000, 6500, 5000));
  s.deadline = s.shownAt + ms;
  s.timer = ctx.after(ms, () => ask(s, ctx));
}

function ask(s: S, ctx: GameCtx) {
  s.phase = 'question';
  s.picks = {};
  s.gains = {};
  s.shownAt = ctx.now();
  s.deadline = s.shownAt + ctx.ms(11000);
  s.timer = ctx.after(ctx.ms(11000), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  const q = s.questions[s.q];
  for (const id of ctx.ids) {
    const p = s.picks[id];
    if (p && p.c === q.answer) {
      const g = 100 + Math.round(50 * Math.max(0, 1 - p.ms / 11000));
      s.gains[id] = g;
      s.scores[id] += g;
      s.right[id]++;
    } else if (p) s.gains[id] = 0;
  }
  s.phase = 'reveal';
  ctx.dirty();
  s.timer = ctx.after(2400, () => {
    s.q++;
    if (s.q >= s.questions.length) nextScene(s, ctx);
    else ask(s, ctx);
  });
}
