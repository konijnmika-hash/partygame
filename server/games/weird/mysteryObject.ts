// Mystery Object: an everyday thing shown extremely zoomed in, slowly zooming out. One guess
// per object — the earlier you get it right, the more it is worth.
import { quizGame } from '../../engine/quiz';
import { MYSTERY_OBJECTS } from '../../content/weird';

export const mysteryObject = quizGame<{ e: string; fx: number; fy: number; zoom: number }, string>({
  id: 'mystery-object',
  count: 8,
  timeMs: 13_000,
  revealMs: 2800,
  botAccuracy: [0.45, 0.6, 0.75],
  noun: 'objects',
  make(ctx, _i, used) {
    let k = ctx.rng.int(0, MYSTERY_OBJECTS.length - 1);
    for (let t = 0; t < 60 && used.has(MYSTERY_OBJECTS[k][1]); t++) k = ctx.rng.int(0, MYSTERY_OBJECTS.length - 1);
    const [e, name] = MYSTERY_OBJECTS[k];
    used.add(name);
    const others = ctx.rng.sample(MYSTERY_OBJECTS.filter((o) => o[1] !== name), 5).map((o) => o[1]);
    const choices = ctx.rng.shuffle([name, ...others]);
    // focus somewhere off-centre so the first frames are a true mystery
    return {
      prompt: { e, fx: Math.round((ctx.rng.next() - 0.5) * 50) / 100, fy: Math.round((ctx.rng.next() - 0.5) * 50) / 100, zoom: ctx.diff(10, 14, 18) },
      choices,
      answer: choices.indexOf(name),
    };
  },
});
