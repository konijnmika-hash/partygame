import { quizGame, shuffleChoices } from '../../engine/quiz';
import { TRIVIA } from '../../content/trivia';

export const triviaBattle = quizGame<{ q: string; topic: string }, string>({
  id: 'trivia-battle',
  count: 10,
  timeMs: 15_000,
  make(ctx, _i, used) {
    let q = ctx.rng.pick(TRIVIA);
    for (let k = 0; k < 50 && used.has(q[0]); k++) q = ctx.rng.pick(TRIVIA);
    used.add(q[0]);
    const { choices, answer } = shuffleChoices(ctx, q[1], [q[2], q[3], q[4]]);
    return { prompt: { q: q[0], topic: q[5] }, choices, answer };
  },
});
