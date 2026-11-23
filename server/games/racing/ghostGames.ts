// Racing games built on client-predicted deterministic sims.
import { ghostGame } from '../../engine/ghost';
import { platformerDef, platformerBot, PF_HZ, PF_T, type PFState } from '@shared/ghosts/platformer';
import { sprintDef, sprintBot, type SPState } from '@shared/ghosts/sprint';
import { climbDef, climbBot, type CLState } from '@shared/ghosts/climb';
import { ropeDef, ropeBot, RP_HZ, type RPState } from '@shared/ghosts/rope';

const r1 = (v: number) => Math.round(v * 10) / 10;

export const speedRun = ghostGame(platformerDef, {
  pubPlayer: (s: PFState) => ({ x: r1(s.x), y: r1(s.y), d: s.dead > 0 ? 1 : 0, f: s.finished, fc: s.face }),
  score: (w, s) => {
    if (s.finished) {
      const secs = s.finished / PF_HZ;
      return {
        score: 100_000 - s.finished,
        perf: Math.min(1, 0.6 + 0.4 * Math.min(1, (w.cols * PF_T) / 330 / secs)),
        highlight: `Finished in ${secs.toFixed(2)} s · ${s.deaths} death${s.deaths === 1 ? '' : 's'}`,
        bonuses: s.deaths === 0 ? [{ label: 'Deathless run', pts: 40 }] : [],
        record: { key: 'time', label: 'Fastest speed run', value: Math.round(secs * 1000), better: 'lower', format: 'ms' },
      };
    }
    const prog = Math.min(1, s.x / w.goalX);
    return { score: Math.round(prog * 1000), perf: prog * 0.55, highlight: `${Math.round(prog * 100)}% of the level · ${s.deaths} deaths` };
  },
  bot: (w, s, tick, rnd, skill, prev) => platformerBot(w, s, tick, skill, rnd, prev),
});

export const obstacleSprint = ghostGame(sprintDef, {
  pubPlayer: (s: SPState) => ({ x: r1(s.x), y: r1(s.y), sl: s.slide > 0 ? 1 : 0, l: s.lives, o: s.out ? 1 : 0 }),
  score: (_w, s) => {
    const m = Math.round(s.x / 50);
    return {
      score: m * 10 + s.lives,
      perf: Math.min(1, s.x / 50 / 600),
      highlight: `${m} m · ${s.cleared} obstacles cleared · ${s.hits} hit${s.hits === 1 ? '' : 's'}`,
      bonuses: s.hits === 0 ? [{ label: 'Untouched', pts: 40 }] : [],
      record: { key: 'dist', label: 'Longest sprint', value: m, better: 'higher', format: 'int' },
    };
  },
  bot: (w, s, tick, rnd, skill) => sprintBot(w, s, tick, skill, rnd),
});

export const platformRace = ghostGame(climbDef, {
  pubPlayer: (s: CLState) => ({ x: r1(s.x), y: r1(s.y), b: Math.round(s.best), r: s.rescue > 0 ? 1 : 0, fc: s.face }),
  score: (_w, s) => {
    const m = Math.round(s.best / 50);
    return {
      score: Math.round(s.best),
      perf: Math.min(1, m / 300),
      highlight: `Climbed ${m} m · ${s.springs} spring${s.springs === 1 ? '' : 's'} · ${s.falls} fall${s.falls === 1 ? '' : 's'}`,
      bonuses: s.falls === 0 ? [{ label: 'Never fell', pts: 30 }] : [],
      record: { key: 'height', label: 'Highest climb', value: m, better: 'higher', format: 'int' },
    };
  },
  bot: (w, s, tick, rnd, skill) => climbBot(w, s, tick, skill, rnd),
});

export const jumpChallenge = ghostGame(ropeDef, {
  pubPlayer: (s: RPState) => ({ y: r1(s.y), l: s.lives, c: s.cleared, o: s.out ? 1 : 0 }),
  score: (_w, s, sim) => {
    const secs = (s.out || sim.tick) / RP_HZ;
    return {
      score: s.cleared * 10 + s.perfect * 3 + s.lives,
      perf: Math.min(1, (s.cleared + s.perfect * 0.3) / 70),
      highlight: `${s.cleared} jumps (${s.perfect} perfect) · best streak ${s.best} · ${s.out ? `out after ${secs.toFixed(0)} s` : `${s.lives} ${s.lives === 1 ? 'life' : 'lives'} left`}`,
      bonuses: s.misses === 0 ? [{ label: 'Never tripped', pts: 40 }] : [],
      record: { key: 'jumps', label: 'Most rope jumps', value: s.cleared, better: 'higher', format: 'int' },
    };
  },
  bot: (w, s, tick, rnd, skill) => ropeBot(w, s, tick, skill, rnd),
});
