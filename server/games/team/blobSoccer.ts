// Blob Soccer: bump the ball into a rival goal. The pitch is round with one goal per team on the
// rim (left/right for two teams, a triangle for three). Dash for a power kick. Golden goal on a tie.
import { defineGame, type GameCtx } from '../../engine/types';
import type { InputFrame } from '@shared/types';
import { Buttons, collide, dash, integrate, makeBody, r1, steer, type Body } from '../../engine/arena';
import { teamList, teamOf, teamResults } from '../../engine/teams';

export const BS = { C: 500, R: 470, BALL: 22, P: 26, MOUTH: 0.5 } as const;
const MATCH_MS = 110_000;
const GOLDEN_MS = 30_000;
const KICKOFF_MS = 2200;
const DASH_CD = 1100;
const DASH_MS = 230;

interface P { b: Body; dashAt: number; goals: number; touches: number; own: number }

interface S {
  teams: string[][];
  goalAng: number[];
  p: Record<string, P>;
  ball: Body;
  inputs: Record<string, InputFrame>;
  btn: Buttons;
  score: number[];
  phase: 'kickoff' | 'play' | 'goal' | 'over';
  phaseEnds: number;
  endsAt: number;
  golden: boolean;
  lastTouch: string | null;
  lastGoal: { team: number; by: string | null; own: boolean } | null;
}

export const blobSoccer = defineGame<S>({
  id: 'blob-soccer',
  realtime: true,
  botDelay: [80, 140],
  setup(ctx) {
    const teams = teamList(ctx);
    const n = teams.length;
    const goalAng = teams.map((_, t) => Math.PI + (2 * Math.PI * t) / n);
    const p: Record<string, P> = {};
    for (const id of ctx.ids) p[id] = { b: makeBody(id, BS.C, BS.C, BS.P), dashAt: -99999, goals: 0, touches: 0, own: 0 };
    const ball = makeBody('ball', BS.C, BS.C, BS.BALL, 0.55);
    return { teams, goalAng, p, ball, inputs: {}, btn: new Buttons(), score: teams.map(() => 0), phase: 'kickoff', phaseEnds: 0, endsAt: 0, golden: false, lastTouch: null, lastGoal: null };
  },
  start(s, ctx) {
    s.endsAt = ctx.now() + KICKOFF_MS + ctx.ms(MATCH_MS);
    kickoff(s, ctx);
  },
  input(s, _ctx, pid, f) {
    s.inputs[pid] = f;
  },
  tick(s, ctx, dt) {
    const now = ctx.now();
    if (s.phase === 'kickoff' || s.phase === 'goal') {
      if (now >= s.phaseEnds) {
        if (s.phase === 'goal') kickoff(s, ctx);
        else {
          s.phase = 'play';
          ctx.dirty();
        }
      }
      return;
    }
    if (s.phase !== 'play') return;
    if (now >= s.endsAt) {
      const top = Math.max(...s.score);
      const leaders = s.score.filter((v) => v === top).length;
      if (leaders > 1 && !s.golden) {
        s.golden = true;
        s.endsAt = now + ctx.ms(GOLDEN_MS);
        ctx.event('golden', {});
        ctx.dirty();
      } else {
        s.phase = 'over';
        ctx.end();
        return;
      }
    }
    for (const id of ctx.ids) {
      const pl = s.p[id];
      const f = s.inputs[id];
      steer(pl.b, f, dt, 1600, 330, 3.4);
      if (s.btn.pressed(id, f) && now - pl.dashAt > DASH_CD) {
        pl.dashAt = now;
        dash(pl.b, f, 560);
      }
      pl.b.m = now - pl.dashAt < DASH_MS ? 2.2 : 1;
    }
    const bodies = [...ctx.ids.map((id) => s.p[id].b), s.ball];
    collide(bodies, 0.85, (a, b) => {
      const other = a.id === 'ball' ? b : b.id === 'ball' ? a : null;
      if (!other) return;
      s.lastTouch = other.id;
      s.p[other.id].touches++;
      // power kick when dashing into the ball
      if (now - s.p[other.id].dashAt < DASH_MS) {
        const dx = s.ball.x - other.x;
        const dy = s.ball.y - other.y;
        const d = Math.hypot(dx, dy) || 1;
        s.ball.vx += (dx / d) * 380;
        s.ball.vy += (dy / d) * 380;
        ctx.event('kick', { id: other.id });
      }
    });
    for (const id of ctx.ids) {
      integrate(s.p[id].b, dt);
      rimBounce(s.p[id].b, null, s);
    }
    // ball
    const k = Math.max(0, 1 - 0.9 * dt);
    s.ball.vx *= k;
    s.ball.vy *= k;
    const sp = Math.hypot(s.ball.vx, s.ball.vy);
    if (sp > 900) {
      s.ball.vx *= 900 / sp;
      s.ball.vy *= 900 / sp;
    }
    integrate(s.ball, dt);
    const scoredOn = rimBounce(s.ball, true, s);
    if (scoredOn != null) goal(s, ctx, scoredOn);
  },
  pub(s, ctx) {
    const now = ctx.now();
    return {
      phase: s.phase,
      phaseEnds: s.phaseEnds,
      endsAt: s.endsAt,
      golden: s.golden,
      goalAng: s.goalAng.map((a) => Math.round(a * 1000) / 1000),
      mouth: BS.MOUTH,
      teams: s.teams,
      score: s.score,
      lastGoal: s.phase === 'goal' ? s.lastGoal : null,
      p: ctx.ids.map((id) => {
        const pl = s.p[id];
        return { id, x: r1(pl.b.x), y: r1(pl.b.y), d: now - pl.dashAt < DASH_MS ? 1 : 0 };
      }),
      o: [{ id: 'ball', x: r1(s.ball.x), y: r1(s.ball.y) }],
    };
  },
  bot(s, ctx, pid) {
    if (s.phase !== 'play') return { input: { x: 0, y: 0, b: 0 } };
    const me = s.p[pid].b;
    const t = teamOf(ctx, pid);
    const skill = ctx.diff(0.45, 0.7, 0.9);
    const mates = s.teams[t];
    // the teammate closest to the ball attacks, the rest defend
    const dBall = (id: string) => Math.hypot(s.p[id].b.x - s.ball.x, s.p[id].b.y - s.ball.y);
    const attacker = mates.reduce((a, b) => (dBall(b) < dBall(a) ? b : a), mates[0]);
    if (pid !== attacker && mates.length > 1) {
      const ga = s.goalAng[t];
      const gx = BS.C + Math.cos(ga) * (BS.R - 120);
      const gy = BS.C + Math.sin(ga) * (BS.R - 120);
      // stand between the ball and our goal
      const tx = gx + (s.ball.x - gx) * 0.3;
      const ty = gy + (s.ball.y - gy) * 0.3;
      return { input: toward(me, tx, ty, 30) };
    }
    // attack the rival goal nearest to the ball
    let target = -1;
    let bd = Infinity;
    s.goalAng.forEach((a, k) => {
      if (k === t) return;
      const d = Math.hypot(BS.C + Math.cos(a) * BS.R - s.ball.x, BS.C + Math.sin(a) * BS.R - s.ball.y);
      if (d < bd) {
        bd = d;
        target = k;
      }
    });
    const ga = s.goalAng[target];
    const gx = BS.C + Math.cos(ga) * BS.R;
    const gy = BS.C + Math.sin(ga) * BS.R;
    const dx = gx - s.ball.x;
    const dy = gy - s.ball.y;
    const d = Math.hypot(dx, dy) || 1;
    // get behind the ball, then push through it
    const bx = s.ball.x - (dx / d) * 44;
    const by = s.ball.y - (dy / d) * 44;
    const behind = Math.hypot(me.x - bx, me.y - by) < 40;
    const inp = behind ? toward(me, s.ball.x + (dx / d) * 30, s.ball.y + (dy / d) * 30, 0) : toward(me, bx, by, 0);
    if (behind && Math.hypot(me.x - s.ball.x, me.y - s.ball.y) < 80 && ctx.now() - s.p[pid].dashAt > DASH_CD && Math.random() < skill * 0.6) inp.b = 1;
    inp.x += (Math.random() - 0.5) * (1 - skill) * 0.6;
    inp.y += (Math.random() - 0.5) * (1 - skill) * 0.6;
    return { input: inp };
  },
  results(s, ctx) {
    return teamResults(ctx, s.score, {
      great: Math.max(3, ...s.score),
      individual: Object.fromEntries(ctx.ids.map((id) => [id, s.p[id].goals * 50 + Math.min(40, s.p[id].touches)])),
      highlight: (id) => `Final score ${s.score.join(' – ')} · you scored ${s.p[id].goals}${s.p[id].own ? ` (and ${s.p[id].own} own goal${s.p[id].own === 1 ? '' : 's'})` : ''}`,
      bonuses: (id) => (s.p[id].goals >= 2 ? [{ label: s.p[id].goals >= 3 ? 'Hat-trick!' : 'Brace', pts: s.p[id].goals >= 3 ? 50 : 25 }] : []),
    });
  },
});

function toward(me: Body, x: number, y: number, slack: number): InputFrame {
  const dx = x - me.x;
  const dy = y - me.y;
  const d = Math.hypot(dx, dy);
  if (d < slack) return { x: 0, y: 0, b: 0 };
  return { x: dx / (d || 1), y: dy / (d || 1), b: 0 };
}

/** Keep a body inside the round pitch. For the ball, returns the team whose goal it entered. */
function rimBounce(b: Body, isBall: true | null, s: S): number | null {
  const dx = b.x - BS.C;
  const dy = b.y - BS.C;
  const d = Math.hypot(dx, dy);
  const lim = BS.R - b.r;
  if (d <= lim) return null;
  const a = Math.atan2(dy, dx);
  if (isBall) {
    for (let t = 0; t < s.goalAng.length; t++) {
      let da = a - s.goalAng[t];
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) < BS.MOUTH / 2) return t;
    }
  }
  const nx = dx / d;
  const ny = dy / d;
  b.x = BS.C + nx * lim;
  b.y = BS.C + ny * lim;
  const vn = b.vx * nx + b.vy * ny;
  if (vn > 0) {
    b.vx -= 1.7 * vn * nx;
    b.vy -= 1.7 * vn * ny;
  }
  return null;
}

function goal(s: S, ctx: GameCtx, scoredOn: number) {
  const by = s.lastTouch;
  const byTeam = by ? teamOf(ctx, by) : null;
  const own = byTeam === scoredOn;
  if (own || byTeam == null) {
    // own goal (or untouched): every other team gets the point
    for (let t = 0; t < s.score.length; t++) if (t !== scoredOn) s.score[t]++;
    if (by) s.p[by].own++;
  } else {
    s.score[byTeam]++;
    if (by) s.p[by].goals++;
  }
  s.lastGoal = { team: own || byTeam == null ? -1 : byTeam, by, own };
  s.phase = 'goal';
  s.phaseEnds = ctx.now() + 2400;
  ctx.event('goal', s.lastGoal);
  ctx.dirty();
  if (s.golden) {
    s.phase = 'over';
    ctx.after(2200, () => ctx.end());
  }
}

function kickoff(s: S, ctx: GameCtx) {
  s.ball.x = BS.C;
  s.ball.y = BS.C;
  s.ball.vx = 0;
  s.ball.vy = 0;
  s.lastTouch = null;
  s.teams.forEach((members, t) => {
    const a = s.goalAng[t];
    members.forEach((id, i) => {
      const b = s.p[id].b;
      const spread = (i - (members.length - 1) / 2) * 70;
      b.x = BS.C + Math.cos(a) * 230 - Math.sin(a) * spread;
      b.y = BS.C + Math.sin(a) * 230 + Math.cos(a) * spread;
      b.vx = 0;
      b.vy = 0;
    });
  });
  s.phase = 'kickoff';
  s.phaseEnds = ctx.now() + KICKOFF_MS;
  ctx.dirty();
}
