import { quizGame, shuffleChoices } from '../../engine/quiz';
import type { GameCtx } from '../../engine/types';

type Prompt = { kind: 'seq' | 'emoji' | 'odd' | 'letters'; q: string; items: string[] };

function distinctNums(ctx: GameCtx, ans: number, spread: number[]): string[] {
  const set = new Set<number>([ans]);
  for (const d of ctx.rng.shuffle(spread)) {
    if (set.size >= 4) break;
    if (ans + d !== ans) set.add(ans + d);
  }
  while (set.size < 4) set.add(ans + ctx.rng.int(-20, 20) || ans + 7);
  return [...set].filter((v) => v !== ans).slice(0, 3).map(String);
}

const GENS: ((ctx: GameCtx) => { prompt: Prompt; correct: string; wrong: string[] })[] = [
  // arithmetic sequence
  (ctx) => {
    const a = ctx.rng.int(1, 20), d = ctx.rng.int(2, 9) * (ctx.rng.chance(0.2) ? -1 : 1);
    const seq = [0, 1, 2, 3].map((k) => a + d * k);
    const ans = a + d * 4;
    return { prompt: { kind: 'seq', q: 'What comes next?', items: [...seq.map(String), '?'] }, correct: String(ans), wrong: distinctNums(ctx, ans, [d, -d, 1, -1, 2 * d]) };
  },
  // geometric
  (ctx) => {
    const a = ctx.rng.int(1, 4), r = ctx.rng.int(2, 3);
    const seq = [0, 1, 2, 3].map((k) => a * r ** k);
    const ans = a * r ** 4;
    return { prompt: { kind: 'seq', q: 'What comes next?', items: [...seq.map(String), '?'] }, correct: String(ans), wrong: distinctNums(ctx, ans, [-a * r ** 3, a, r, -r * 2]) };
  },
  // fibonacci-like
  (ctx) => {
    const s = [ctx.rng.int(1, 5), ctx.rng.int(1, 6)];
    while (s.length < 6) s.push(s[s.length - 1] + s[s.length - 2]);
    const ans = s[5];
    return { prompt: { kind: 'seq', q: 'What comes next?', items: [...s.slice(0, 5).map(String), '?'] }, correct: String(ans), wrong: distinctNums(ctx, ans, [1, -1, s[4] - s[3], 2]) };
  },
  // squares / cubes
  (ctx) => {
    const start = ctx.rng.int(1, 5);
    const cube = ctx.rng.chance(0.3);
    const f = (n: number) => (cube ? n ** 3 : n * n);
    const ans = f(start + 4);
    return { prompt: { kind: 'seq', q: 'What comes next?', items: [0, 1, 2, 3].map((k) => String(f(start + k))).concat('?') }, correct: String(ans), wrong: distinctNums(ctx, ans, [1, -1, 2 * start + 7, -(2 * start + 7)]) };
  },
  // alternating
  (ctx) => {
    const a = ctx.rng.int(10, 30), up = ctx.rng.int(3, 9), down = ctx.rng.int(1, up - 1);
    const s = [a];
    for (let k = 1; k < 6; k++) s.push(s[k - 1] + (k % 2 ? up : -down));
    const ans = s[5];
    return { prompt: { kind: 'seq', q: 'Up, down... what comes next?', items: [...s.slice(0, 5).map(String), '?'] }, correct: String(ans), wrong: distinctNums(ctx, ans, [up + down, -(up + down), up, -down]) };
  },
  // letters
  (ctx) => {
    const step = ctx.rng.int(1, 4);
    const start = ctx.rng.int(0, 25 - step * 5);
    const L = (i: number) => String.fromCharCode(65 + i);
    const ans = L(start + step * 4);
    const wrong = [L(start + step * 4 + 1), L(start + step * 4 - 1), L(Math.min(25, start + step * 5))].filter((x, i, arr) => x !== ans && arr.indexOf(x) === i);
    while (wrong.length < 3) wrong.push(L(ctx.rng.int(0, 25)) === ans ? 'Z' : L(ctx.rng.int(0, 25)));
    return { prompt: { kind: 'letters', q: 'Which letter comes next?', items: [0, 1, 2, 3].map((k) => L(start + step * k)).concat('?') }, correct: ans, wrong: wrong.slice(0, 3) };
  },
  // emoji pattern
  (ctx) => {
    const pool = ['🔺', '🔵', '🟩', '⭐', '❤️', '🌙', '🍀', '🔶'];
    const [a, b, c] = ctx.rng.sample(pool, 3);
    const pats = [[a, b], [a, a, b], [a, b, c], [a, b, b], [a, b, c, b]];
    const pat = ctx.rng.pick(pats);
    const len = pat.length * 2 + ctx.rng.int(0, pat.length - 1);
    const items = Array.from({ length: len }, (_, i) => pat[i % pat.length]);
    const ans = pat[len % pat.length];
    const wrong = ctx.rng.shuffle(pool.filter((x) => x !== ans)).slice(0, 3);
    return { prompt: { kind: 'emoji', q: 'Continue the pattern', items: [...items, '?'] }, correct: ans, wrong };
  },
  // odd one out
  (ctx) => {
    const kind = ctx.rng.int(0, 2);
    let items: number[] = [];
    let odd = 0;
    if (kind === 0) {
      items = ctx.rng.sample([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], 4);
      odd = ctx.rng.pick([3, 5, 7, 9, 11, 13, 15, 17, 19]);
    } else if (kind === 1) {
      const m = ctx.rng.int(3, 9);
      items = ctx.rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 4).map((k) => k * m);
      odd = m * ctx.rng.int(2, 9) + ctx.rng.int(1, m - 1);
    } else {
      items = ctx.rng.sample([1, 4, 9, 16, 25, 36, 49, 64, 81, 100], 4);
      odd = ctx.rng.pick([2, 8, 10, 15, 24, 30, 50, 63, 80]);
    }
    const all = ctx.rng.shuffle([...items, odd]).map(String);
    return { prompt: { kind: 'odd', q: kind === 0 ? 'Which number is the odd one out?' : kind === 1 ? 'Which number does NOT belong?' : 'Which one breaks the rule?', items: all }, correct: String(odd), wrong: ctx.rng.sample(items.map(String), 3) };
  },
];

export const logicChallenge = quizGame<Prompt, string>({
  id: 'logic-challenge',
  count: 8,
  timeMs: 20_000,
  make(ctx, i) {
    const gen = GENS[(i * 3 + ctx.rng.int(0, GENS.length - 1)) % GENS.length];
    const g = gen(ctx);
    const { choices, answer } = shuffleChoices(ctx, g.correct, g.wrong);
    return { prompt: g.prompt, choices, answer };
  },
});
