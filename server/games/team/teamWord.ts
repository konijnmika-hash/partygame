// Team Word Game: one teammate sees a secret word and gives one-word clues; the others guess.
// A correct guess scores and the clue-giver role rotates. Teams play at the same time.
import { defineGame, type GameCtx } from '../../engine/types';
import { isObj, str } from '../../engine/util';
import { teamList, teamOf, teamResults } from '../../engine/teams';
import { matchAnswer } from '@shared/validation';
import { CLUE_WORDS, wordsForClue } from '../../content/teamWords';

const TIME_MS = 100_000;
const MAX_CLUES = 3;
const MAX_SKIPS = 3;

interface TeamState {
  giver: number;
  word: string;
  clues: string[];
  guesses: { id: string; g: string; ok: boolean }[];
  got: number;
  skips: number;
  wordAt: number;
  deck: number[];
}

interface S {
  teams: string[][];
  ts: TeamState[];
  startedAt: number;
  endsAt: number;
  clued: Record<string, number>;
  guessed: Record<string, number>;
}

function giverOf(s: S, t: number): string {
  const m = s.teams[t];
  return m[s.ts[t].giver % m.length];
}

export const teamWord = defineGame<S>({
  id: 'team-word',
  botDelay: [900, 1800],
  setup(ctx) {
    const teams = teamList(ctx);
    // every team gets the same word order so it's fair
    const deck = ctx.rng.shuffle([...CLUE_WORDS.keys()]);
    return {
      teams,
      ts: teams.map(() => ({ giver: 0, word: CLUE_WORDS[deck[0]].w, clues: [], guesses: [], got: 0, skips: 0, wordAt: 0, deck: deck.slice(1) })),
      startedAt: 0,
      endsAt: 0,
      clued: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      guessed: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
    };
  },
  start(s, ctx) {
    s.startedAt = ctx.now() + 1200;
    s.endsAt = s.startedAt + ctx.ms(TIME_MS);
    for (const t of s.ts) t.wordAt = s.startedAt;
    ctx.after(s.endsAt - ctx.now(), () => ctx.end());
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || ctx.now() < s.startedAt) return;
    const t = teamOf(ctx, pid);
    const st = s.ts[t];
    const solo = s.teams[t].length === 1;
    const giver = giverOf(s, t);
    if (a.t === 'clue' && pid === giver && !solo) {
      const c = str(a.c, 24);
      if (!c || st.clues.length >= MAX_CLUES) return;
      const clue = c.trim().toLowerCase();
      // one word, and it must not give the answer away
      if (!/^[a-zÀ-ɏ'-]+$/i.test(clue)) return ctx.event('badClue', { reason: 'One word only!' }, pid);
      if (clue.includes(st.word) || st.word.includes(clue) || matchAnswer(clue, [st.word]) !== 'no') return ctx.event('badClue', { reason: 'Too close to the word!' }, pid);
      ctx.markActed(pid);
      st.clues.push(clue);
      s.clued[pid]++;
      ctx.dirty();
    } else if (a.t === 'guess' && (pid !== giver || solo)) {
      const g = str(a.g, 30);
      if (!g || !st.clues.length) return;
      ctx.markActed(pid);
      const ok = matchAnswer(g, [st.word]) === 'exact';
      st.guesses.push({ id: pid, g: g.slice(0, 30), ok });
      if (st.guesses.length > 12) st.guesses.shift();
      if (ok) {
        st.got++;
        s.guessed[pid]++;
        ctx.event('got', { team: t, word: st.word, by: pid });
        nextWord(s, ctx, t, true);
      }
      ctx.dirty();
    } else if (a.t === 'skip' && pid === giver && st.skips < MAX_SKIPS && ctx.now() - st.wordAt > 6000) {
      ctx.markActed(pid);
      st.skips++;
      nextWord(s, ctx, t, false);
      ctx.dirty();
    }
  },
  pub(s, ctx) {
    return {
      startedAt: s.startedAt,
      endsAt: s.endsAt,
      teams: s.teams,
      ts: s.ts.map((st, t) => ({ giver: giverOf(s, t), clues: st.clues, guesses: st.guesses, got: st.got, skips: st.skips, len: st.word.length, wordAt: st.wordAt, solo: s.teams[t].length === 1 })),
    };
  },
  priv(s, ctx, pid) {
    const t = teamOf(ctx, pid);
    return { word: giverOf(s, t) === pid && s.teams[t].length > 1 ? s.ts[t].word : null };
  },
  tick(s, ctx) {
    // solo teams get automatic clues from the bank
    const now = ctx.now();
    s.teams.forEach((m, t) => {
      if (m.length !== 1) return;
      const st = s.ts[t];
      const due = st.clues.length === 0 ? 1500 : st.clues.length < MAX_CLUES ? 9000 * st.clues.length : Infinity;
      if (now - st.wordAt > due) {
        const e = CLUE_WORDS.find((x) => x.w === st.word);
        const c = e?.clues.find((x) => !st.clues.includes(x));
        if (c) {
          st.clues.push(c);
          ctx.dirty();
        }
      }
    });
  },
  bot(s, ctx, pid) {
    const now = ctx.now();
    if (now < s.startedAt) return null;
    const t = teamOf(ctx, pid);
    const st = s.ts[t];
    const giver = giverOf(s, t);
    const skill = ctx.diff(0.5, 0.7, 0.9);
    if (pid === giver && s.teams[t].length > 1) {
      const e = CLUE_WORDS.find((x) => x.w === st.word);
      const waited = now - st.wordAt;
      if (!st.clues.length && waited > 1500) return { action: { t: 'clue', c: e?.clues[0] ?? 'thing' } };
      if (st.clues.length && st.clues.length < MAX_CLUES && waited > 7000 * st.clues.length && e) return { action: { t: 'clue', c: e.clues[st.clues.length] } };
      if (waited > 26_000 && st.skips < MAX_SKIPS) return { action: { t: 'skip' } };
      return null;
    }
    if (!st.clues.length || Math.random() > 0.55) return null;
    // candidates pointed at by every clue so far
    let cands: string[] | null = null;
    for (const c of st.clues) {
      const w = wordsForClue(c);
      cands = cands ? cands.filter((x) => w.includes(x)) : w;
    }
    const pool = cands && cands.length ? cands : CLUE_WORDS.map((e) => e.w);
    const tried = new Set(st.guesses.map((g) => g.g.toLowerCase()));
    const fresh = pool.filter((w) => !tried.has(w));
    const g = fresh.includes(st.word) && Math.random() < skill ? st.word : fresh[Math.floor(Math.random() * fresh.length)];
    return g ? { action: { t: 'guess', g } } : null;
  },
  results(s, ctx) {
    const scores = s.ts.map((st) => st.got * 20);
    return teamResults(ctx, scores, {
      great: 160,
      individual: Object.fromEntries(ctx.ids.map((id) => [id, s.guessed[id] * 10 + s.clued[id]])),
      highlight: (id, t) => `${s.ts[t].got} word${s.ts[t].got === 1 ? '' : 's'} for your team · you guessed ${s.guessed[id]} and gave ${s.clued[id]} clue${s.clued[id] === 1 ? '' : 's'}`,
    });
  },
});

function nextWord(s: S, ctx: GameCtx, t: number, rotate: boolean) {
  const st = s.ts[t];
  const next = st.deck.shift() ?? 0;
  st.word = CLUE_WORDS[next].w;
  st.clues = [];
  st.guesses = [];
  st.wordAt = ctx.now();
  if (rotate) st.giver++;
}
