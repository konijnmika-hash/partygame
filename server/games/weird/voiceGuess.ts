// Weird Voice Guessing: the actor gets a secret character and a phrase, then records it in that
// voice (or performs it with the built-in voice synthesizer). Everyone else guesses the character.
import { defineGame, type GameCtx } from '../../engine/types';
import { allDone, isObj, num } from '../../engine/util';
import { VOICE_CHARACTERS, VOICE_PHRASES } from '../../content/weird';

const PERFORM_MS = 30_000;
const LISTEN_MS = 22_000;
const REVEAL_MS = 4500;
const MAX_ROUNDS = 6;
const MAX_AUDIO = 220_000;
const AUDIO_RE = /^data:audio\/[a-z0-9.+-]+(;codecs=[a-z0-9.,+-]+)?;base64,[A-Za-z0-9+/=]+$/i;

interface Round { actor: string; options: number[]; answer: number; phrase: string }
type Clip = { kind: 'audio'; data: string } | { kind: 'synth'; pitch: number; rate: number; text: string };

interface S {
  rounds: Round[];
  r: number;
  phase: 'perform' | 'listen' | 'reveal';
  deadline: number;
  clip: Clip | null;
  picks: Record<string, number>;
  scores: Record<string, number>;
  guessed: Record<string, number>;
  recognised: Record<string, number>;
  timer: number | null;
}

export const voiceGuess = defineGame<S>({
  id: 'voice-guess',
  botDelay: [1500, 3500],
  setup(ctx) {
    const actors = ctx.rng.shuffle(ctx.ids).slice(0, MAX_ROUNDS);
    const rounds = actors.map((actor) => {
      const options = ctx.rng.sample([...VOICE_CHARACTERS.keys()], 6);
      return { actor, options, answer: ctx.rng.int(0, 5), phrase: ctx.rng.pick(VOICE_PHRASES) };
    });
    return {
      rounds,
      r: -1,
      phase: 'perform',
      deadline: 0,
      clip: null,
      picks: {},
      scores: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      guessed: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      recognised: Object.fromEntries(ctx.ids.map((id) => [id, 0])),
      timer: null,
    };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a)) return;
    const round = s.rounds[s.r];
    if (!round) return;
    if (s.phase === 'perform' && pid === round.actor) {
      if (a.t === 'voice') {
        if (typeof a.data !== 'string' || a.data.length > MAX_AUDIO || !AUDIO_RE.test(a.data)) return;
        ctx.markActed(pid);
        return toListen(s, ctx, { kind: 'audio', data: a.data });
      }
      if (a.t === 'synth') {
        const pitch = num(a.pitch, 0.1, 2);
        const rate = num(a.rate, 0.4, 2);
        if (pitch == null || rate == null) return;
        ctx.markActed(pid);
        return toListen(s, ctx, { kind: 'synth', pitch: Math.round(pitch * 100) / 100, rate: Math.round(rate * 100) / 100, text: round.phrase });
      }
      return;
    }
    if (s.phase === 'listen' && a.t === 'pick' && pid !== round.actor && s.picks[pid] == null) {
      const c = a.c;
      if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > 5) return;
      ctx.markActed(pid);
      s.picks[pid] = c;
      if (allDone(ctx, (id) => id === round.actor || s.picks[id] != null)) {
        ctx.cancel(s.timer);
        s.timer = ctx.after(500, () => reveal(s, ctx));
      }
      ctx.dirty();
    }
  },
  pub(s) {
    const round = s.rounds[s.r];
    return {
      r: s.r,
      n: s.rounds.length,
      phase: s.phase,
      deadline: s.deadline,
      actor: round?.actor ?? null,
      options: round ? round.options.map((k) => ({ name: VOICE_CHARACTERS[k].name, emoji: VOICE_CHARACTERS[k].emoji })) : [],
      clipKind: s.clip?.kind ?? null,
      answered: Object.keys(s.picks),
      answer: s.phase === 'reveal' ? round.answer : null,
      phrase: s.phase === 'reveal' ? round.phrase : null,
      picks: s.phase === 'reveal' ? s.picks : null,
      scores: s.scores,
    };
  },
  priv(s, _ctx, pid) {
    const round = s.rounds[s.r];
    if (!round || pid !== round.actor) return { role: 'listener', myPick: s.picks[pid] ?? null };
    const ch = VOICE_CHARACTERS[round.options[round.answer]];
    return { role: 'actor', character: ch.name, emoji: ch.emoji, phrase: round.phrase, preset: ch.synth };
  },
  bot(s, ctx, pid) {
    const round = s.rounds[s.r];
    if (!round) return null;
    if (s.phase === 'perform' && pid === round.actor) {
      const p = VOICE_CHARACTERS[round.options[round.answer]].synth;
      const wob = ctx.diff(0.35, 0.2, 0.1);
      return { action: { t: 'synth', pitch: Math.max(0.1, Math.min(2, p.pitch + (Math.random() - 0.5) * wob)), rate: Math.max(0.4, Math.min(2, p.rate + (Math.random() - 0.5) * wob)) } };
    }
    if (s.phase === 'listen' && pid !== round.actor && s.picks[pid] == null) {
      const skill = ctx.diff(0.45, 0.65, 0.85);
      let c = Math.floor(Math.random() * 6);
      if (s.clip?.kind === 'synth') {
        // pick the character whose voice settings sound closest
        const clip = s.clip;
        let bd = Infinity;
        round.options.forEach((k, i) => {
          const p = VOICE_CHARACTERS[k].synth;
          const d = Math.abs(p.pitch - clip.pitch) + Math.abs(p.rate - clip.rate) + Math.random() * (1 - skill) * 1.2;
          if (d < bd) {
            bd = d;
            c = i;
          }
        });
      } else if (Math.random() < skill * 0.4) c = round.answer;
      return { action: { t: 'pick', c } };
    }
    return null;
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    const best = Math.max(1, ...Object.values(s.scores));
    for (const id of ctx.ids) {
      const acted = s.rounds.some((r) => r.actor === id);
      perfs[id] = {
        score: s.scores[id],
        perf: Math.min(1, s.scores[id] / best),
        participated: ctx.acted(id),
        highlight: `Guessed ${s.guessed[id]} voice${s.guessed[id] === 1 ? '' : 's'}${acted ? ` · ${s.recognised[id]} recognised yours` : ''}`,
      };
    }
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.r++;
  if (s.r >= s.rounds.length) return ctx.end();
  s.phase = 'perform';
  s.clip = null;
  s.picks = {};
  s.deadline = ctx.now() + ctx.ms(PERFORM_MS);
  ctx.cancel(s.timer);
  // the actor froze on stage: the synthesizer reads it in a plain voice
  s.timer = ctx.after(ctx.ms(PERFORM_MS), () => toListen(s, ctx, { kind: 'synth', pitch: 1, rate: 1, text: s.rounds[s.r].phrase }));
  ctx.dirty();
}

function toListen(s: S, ctx: GameCtx, clip: Clip) {
  if (s.phase !== 'perform') return;
  s.clip = clip;
  ctx.asset(`vg:${s.r}`, clip);
  s.phase = 'listen';
  s.deadline = ctx.now() + ctx.ms(LISTEN_MS);
  ctx.cancel(s.timer);
  s.timer = ctx.after(ctx.ms(LISTEN_MS), () => reveal(s, ctx));
  ctx.dirty();
}

function reveal(s: S, ctx: GameCtx) {
  if (s.phase !== 'listen') return;
  const round = s.rounds[s.r];
  const guessers = Object.keys(s.picks).length;
  let right = 0;
  for (const [id, c] of Object.entries(s.picks)) {
    if (c === round.answer) {
      s.scores[id] += 100;
      s.guessed[id]++;
      right++;
    }
  }
  if (right) {
    s.scores[round.actor] += Math.round((200 * right) / Math.max(1, guessers));
    s.recognised[round.actor] += right;
  }
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.dirty();
  ctx.cancel(s.timer);
  s.timer = ctx.after(REVEAL_MS, () => next(s, ctx));
}
