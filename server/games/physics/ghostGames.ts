// Physics games built on client-predicted deterministic sims (each player runs their own copy).
import { ghostGame } from '../../engine/ghost';
import { ballBalanceDef, balanceBot, BB_HZ, type BBState } from '@shared/ghosts/ballBalance';
import { hillRaceDef, hillBot, HR_HZ, HR_LEN, type HRState } from '@shared/ghosts/hillRace';
import { stackDef, stackBot, stackScore, type STState } from '@shared/ghosts/stack';

const r1 = (v: number) => Math.round(v * 10) / 10;

export const ballBalance = ghostGame(ballBalanceDef, {
  pubPlayer: (s: BBState) => ({ x: r1(s.x), y: r1(s.y), r: r1(s.r), a: s.alive ? 1 : 0, pts: s.pts }),
  score: (_w, s) => {
    const secs = s.t / BB_HZ;
    return {
      score: s.pts,
      perf: Math.min(1, s.pts / (BB_HZ * 60 * 1.6)),
      highlight: `${secs.toFixed(1)} s on the plate · ${Math.round((s.centre / Math.max(1, s.t)) * 100)}% in the gold ring`,
      bonuses: s.alive ? [{ label: 'Never fell', pts: 40 }] : [],
      record: { key: 'pts', label: 'Best balance score', value: s.pts, better: 'higher', format: 'int' },
    };
  },
  bot: (w, s, tick, rnd, skill) => balanceBot(w, s, tick, skill, rnd),
});

export const physicsRace = ghostGame(hillRaceDef, {
  pubPlayer: (s: HRState) => ({ x: r1(s.x), y: r1(s.y), a: Math.round(s.a * 100) / 100, f: s.flipped > 0 ? 1 : 0, fin: s.finished }),
  score: (_w, s) => {
    const par = 24 * HR_HZ;
    if (s.finished) {
      const secs = s.finished / HR_HZ;
      return {
        score: 100_000 - s.finished,
        perf: Math.min(1, 0.6 + 0.4 * Math.min(1, par / s.finished)),
        highlight: `${secs.toFixed(2)} s · ${s.flips} flip${s.flips === 1 ? '' : 's'} · ${s.perfect} perfect landing${s.perfect === 1 ? '' : 's'}`,
        bonuses: [...(s.flips === 0 ? [{ label: 'No flips', pts: 30 }] : []), ...(s.perfect >= 3 ? [{ label: 'Stunt driver', pts: 20 }] : [])],
        record: { key: 'time', label: 'Fastest hill race', value: Math.round((s.finished / HR_HZ) * 1000), better: 'lower', format: 'ms' },
      };
    }
    return {
      score: Math.round(s.x),
      perf: 0.55 * Math.min(1, s.x / HR_LEN),
      highlight: `${Math.round((s.x / HR_LEN) * 100)}% of the track · ${s.flips} flips`,
    };
  },
  bot: (w, s, _tick, rnd, skill) => hillBot(w, s, skill, rnd),
});

export const stackObjects = ghostGame(stackDef, {
  pubPlayer: (s: STState) => ({ h: s.h, w: Math.round(s.mw), fx: s.fx, fa: s.fxAt }),
  score: (_w, s) => ({
    score: stackScore(s),
    perf: Math.min(1, s.h / 32),
    highlight: `${s.h} blocks high · ${s.perfects} perfect drops`,
    bonuses: s.misses === 0 && s.h > 5 ? [{ label: 'No misses', pts: 30 }] : [],
    record: { key: 'height', label: 'Tallest stack', value: s.h, better: 'higher', format: 'int' },
  }),
  bot: (w, s, _tick, rnd, skill) => stackBot(w, s, skill, rnd),
});
