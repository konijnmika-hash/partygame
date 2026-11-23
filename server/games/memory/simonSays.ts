import { defineGame, type GameCtx } from '../../engine/types';
import { isObj } from '../../engine/util';

// Steps the player can perform. Each command is a chain of steps; only obey if it starts with "Simon says".
const STEPS = [
  { id: 'red', text: 'tap RED' },
  { id: 'blue', text: 'tap BLUE' },
  { id: 'green', text: 'tap GREEN' },
  { id: 'yellow', text: 'tap YELLOW' },
  { id: 'up', text: 'swipe UP' },
  { id: 'down', text: 'swipe DOWN' },
  { id: 'left', text: 'swipe LEFT' },
  { id: 'right', text: 'swipe RIGHT' },
  { id: 'hold', text: 'HOLD the big button' },
  { id: 'double', text: 'DOUBLE-tap the big button' },
] as const;
type StepId = (typeof STEPS)[number]['id'];
const VALID = new Set<string>(STEPS.map((s) => s.id));
const ROUNDS = 12;
const LIVES = 3;

interface Cmd {
  simon: boolean;
  steps: StepId[];
  text: string;
}
interface S {
  round: number;
  cmd: Cmd | null;
  phase: 'cmd' | 'result';
  shownAt: number;
  deadline: number;
  progress: Record<string, StepId[]>;
  verdict: Record<string, 'ok' | 'fail' | 'trap' | 'safe'>;
  lives: Record<string, number>;
  score: Record<string, number>;
  timer: number | null;
}

function makeCmd(ctx: GameCtx, round: number): Cmd {
  const len = Math.min(4, 1 + Math.floor(round / 3));
  const steps = Array.from({ length: len }, () => ctx.rng.pick(STEPS).id);
  const simon = round < 2 ? true : ctx.rng.chance(0.68);
  const lead = simon ? 'Simon says' : ctx.rng.pick(['Simon SAID', 'Simone says', 'Please', 'Quick!', 'Simon wants you to', 'Now']);
  const body = steps.map((id) => STEPS.find((s) => s.id === id)!.text).join(', then ');
  // "Simon wants you to" is NOT "Simon says" — a classic trap
  return { simon, steps, text: `${lead}: ${body}!` };
}

export const simonSays = defineGame<S>({
  id: 'simon-says',
  botDelay: [500, 1100],
  setup(ctx) {
    const z = (v: number) => Object.fromEntries(ctx.ids.map((id) => [id, v]));
    return { round: -1, cmd: null, phase: 'cmd', shownAt: 0, deadline: 0, progress: {}, verdict: {}, lives: z(LIVES), score: z(0), timer: null };
  },
  start(s, ctx) {
    next(s, ctx);
  },
  action(s, ctx, pid, a) {
    if (!isObj(a) || a.t !== 'do' || s.phase !== 'cmd' || !s.cmd || typeof a.s !== 'string' || !VALID.has(a.s)) return;
    if (s.lives[pid] <= 0 || s.verdict[pid]) return;
    ctx.markActed(pid);
    const step = a.s as StepId;
    if (!s.cmd.simon) {
      s.verdict[pid] = 'trap';
      s.lives[pid]--;
      ctx.event('trap', null, pid);
      return;
    }
    const prog = (s.progress[pid] ??= []);
    if (s.cmd.steps[prog.length] !== step) {
      s.verdict[pid] = 'fail';
      s.lives[pid]--;
      ctx.event('fail', { expected: s.cmd.steps[prog.length] }, pid);
      return;
    }
    prog.push(step);
    if (prog.length === s.cmd.steps.length) {
      s.verdict[pid] = 'ok';
      const speed = Math.max(0, 1 - (ctx.now() - s.shownAt) / (s.deadline - s.shownAt));
      s.score[pid] += 50 + Math.round(30 * speed) + 10 * (s.cmd.steps.length - 1);
      ctx.event('ok', null, pid);
    }
  },
  pub(s, ctx) {
    return {
      round: s.round,
      n: ROUNDS,
      phase: s.phase,
      text: s.cmd?.text ?? '',
      len: s.cmd?.steps.length ?? 0,
      deadline: s.deadline,
      shownAt: s.shownAt,
      simon: s.phase === 'result' ? s.cmd?.simon : null,
      verdict: s.phase === 'result' ? s.verdict : Object.fromEntries(Object.keys(s.verdict).map((id) => [id, 'done'])),
      lives: s.lives,
      score: s.score,
      alive: ctx.ids.filter((id) => s.lives[id] > 0),
    };
  },
  priv(s, _ctx, pid) {
    return { done: s.progress[pid]?.length ?? 0, verdict: s.verdict[pid] ?? null };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'cmd' || !s.cmd || s.verdict[pid] || s.lives[pid] <= 0) return null;
    const fooled = !s.cmd.simon && Math.random() < ctx.diff(0.3, 0.18, 0.08);
    if (!s.cmd.simon && !fooled) return null;
    const prog = s.progress[pid]?.length ?? 0;
    const step = Math.random() < 0.92 ? s.cmd.steps[prog] ?? s.cmd.steps[0] : ctx.rng.pick(STEPS).id;
    return { action: { t: 'do', s: step } };
  },
  results(s, ctx) {
    const perfs: Record<string, any> = {};
    for (const id of ctx.ids) perfs[id] = { score: s.score[id] + s.lives[id] * 30, perf: s.score[id] / (ROUNDS * 70) + s.lives[id] * 0.05, participated: ctx.acted(id), bonuses: s.lives[id] === LIVES ? [{ label: 'Never fooled by Simon', pts: 40 }] : [], highlight: `${s.lives[id]} lives left · ${s.score[id]} pts` };
    return { perfs };
  },
});

function next(s: S, ctx: GameCtx) {
  s.round++;
  if (s.round >= ROUNDS || ctx.ids.every((id) => s.lives[id] <= 0)) return ctx.end();
  s.cmd = makeCmd(ctx, s.round);
  s.progress = {};
  s.verdict = {};
  s.phase = 'cmd';
  s.shownAt = ctx.now();
  const ms = ctx.ms(ctx.diff(4200, 3500, 2900) + s.cmd.steps.length * 1100);
  s.deadline = s.shownAt + ms;
  s.timer = ctx.after(ms, () => {
    // judge players who did nothing / did not finish
    for (const id of ctx.ids) {
      if (s.lives[id] <= 0 || s.verdict[id]) continue;
      if (s.cmd!.simon) {
        s.verdict[id] = 'fail';
        s.lives[id]--;
      } else {
        s.verdict[id] = 'safe';
        s.score[id] += 40;
      }
    }
    s.phase = 'result';
    ctx.dirty();
    s.timer = ctx.after(1800, () => next(s, ctx));
  });
}
