// Weird Quiz: strange-but-true questions with a confidence wager on every answer.
import { quizGame, shuffleChoices } from '../../engine/quiz';
import { WEIRD_TRIVIA } from '../../content/trivia';

export const weirdQuiz = quizGame<{ q: string }, string>({
  id: 'weird-quiz',
  count: 8,
  timeMs: 16_000,
  wager: true,
  revealMs: 3200,
  botAccuracy: [0.4, 0.55, 0.7],
  make(ctx, _i, used) {
    let q = ctx.rng.pick(WEIRD_TRIVIA);
    for (let k = 0; k < 60 && used.has(q[0]); k++) q = ctx.rng.pick(WEIRD_TRIVIA);
    used.add(q[0]);
    const { choices, answer } = shuffleChoices(ctx, q[1], [q[2], q[3], q[4]]);
    return { prompt: { q: q[0] }, choices, answer };
  },
});
