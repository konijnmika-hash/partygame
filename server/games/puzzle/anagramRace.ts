import { defineGame } from '../../engine/types';
import { isObj, str } from '../../engine/util';
import { ANAGRAM_SEEDS, subWords } from '../../content/words';

const DURATION = 75_000;
const PTS: Record<number, number> = { 3: 1, 4: 2, 5: 4, 6: 7, 7: 12 };

interface S {
  seed: string;
  letters: string;
  valid: Set<string>;
  validList: string[];
  endsAt: number;
  found: Record<string, string[]>;
  base: Record<string, number>;
  done: boolean;
  uniq: Record<string, number>;
}

export const anagramRace = defineGame<S>({
  id: 'anagram-race',
  botDelay: [2200, 5000],
  setup(ctx) {
    const seed = ctx.rng.pick(ANAGRAM_SEEDS);
    const valid = subWords(seed);
    const letters = ctx.rng.shuffle(seed.split('')).join('').toUpperCase();
    return { seed, letters, valid: new Set(valid), validList: valid, endsAt: 0, found: Object.fromEntries(ctx.ids.map((id) => [id, []])), base: Object.fromEntries(ctx.ids.map((id) => [id, 0])), done: false, uniq: {} };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + ctx.ms(DURATION);
    ctx.after(ctx.ms(DURATION), () => {
      // unique-word bonus: words nobody else found are worth 50% more
      const counts = new Map<string, number>();
      for (const id of ctx.ids) for (const w of s.found[id]) counts.set(w, (counts.get(w) ?? 0) + 1);
      for (const id of ctx.ids) {
        let bonus = 0;
        for (const w of s.found[id]) if (counts.get(w) === 1) bonus += Math.ceil((PTS[w.length] ?? 12) / 2);
        s.uniq[id] = bonus;
      }
      s.done = true;
      ctx.dirty();
      ctx.after(2500, () => ctx.end());
    });
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'word' || s.done) return;
    const w = (str(a.w, 12) ?? '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return;
    ctx.markActed(pid);
    const mine = s.found[pid];
    if (w.length < 3) return ctx.event('bad', { w, why: 'Too short' }, pid);
    if (mine.includes(w)) return ctx.event('bad', { w, why: 'Already found' }, pid);
    if (!s.valid.has(w)) return ctx.event('bad', { w, why: 'Not a word here' }, pid);
    mine.push(w);
    const pts = PTS[w.length] ?? 12;
    s.base[pid] += pts;
    ctx.event('ok', { w, pts }, pid);
  },
  pub(s) {
    const counts = Object.fromEntries(Object.entries(s.found).map(([id, f]) => [id, f.length]));
    const scores = Object.fromEntries(Object.keys(s.found).map((id) => [id, s.base[id] + (s.uniq[id] ?? 0)]));
    return {
      letters: s.letters,
      endsAt: s.endsAt,
      counts,
      scores,
      total: s.validList.length,
      done: s.done,
      reveal: s.done ? { best: [...s.validList].sort((a, b) => b.length - a.length).slice(0, 12), uniq: s.uniq } : null,
    };
  },
  priv(s, _ctx, pid) {
    return { found: s.found[pid] ?? [] };
  },
  bot(s, ctx, pid) {
    if (s.done) return null;
    const mine = s.found[pid];
    const pool = s.validList.filter((w) => !mine.includes(w) && w.length <= ctx.diff(4, 5, 6));
    if (!pool.length) return null;
    return { action: { t: 'word', w: Math.random() < 0.85 ? ctx.rng.pick(pool) : 'zzz' } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const great = Math.max(30, Math.min(120, s.validList.length * 1.2));
    for (const id of ctx.ids) {
      const total = s.base[id] + (s.uniq[id] ?? 0);
      const seven = s.found[id].some((w) => w.length === 7);
      perfs[id] = { score: total, perf: total / great, participated: ctx.acted(id), bonuses: seven ? [{ label: `Found "${s.seed.toUpperCase()}"!`, pts: 40 }] : [], highlight: `${s.found[id].length} words · +${s.uniq[id] ?? 0} unique bonus` };
    }
    return { perfs, summary: [`🔤 The 7-letter word was ${s.seed.toUpperCase()}`] };
  },
});
