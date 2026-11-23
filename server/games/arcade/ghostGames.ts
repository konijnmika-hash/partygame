// Arcade games built on client-predicted deterministic sims.
import { ghostGame } from '../../engine/ghost';
import { hoverDef, hoverBot, gflipDef, gflipBot, hopperDef, hopperBot, type HHState, type GFState, type RHState } from '@shared/ghosts/arcade';

const r1 = (v: number) => Math.round(v * 10) / 10;

export const hoverHop = ghostGame(hoverDef, {
  pubPlayer: (s: HHState) => ({ x: r1(s.x), y: r1(s.y), p: s.passed, o: s.stun ? 1 : 0 }),
  score: (_w, s) => ({
    score: s.passed * 1000 + Math.round(s.x / 10),
    perf: Math.min(1, s.passed / 40),
    highlight: `${s.passed} gap${s.passed === 1 ? '' : 's'} cleared · ${s.crashes} bonk${s.crashes === 1 ? '' : 's'}`,
    bonuses: s.crashes === 0 && s.passed > 0 ? [{ label: 'Never crashed', pts: 40 }] : [],
    record: { key: 'gaps', label: 'Most Hover Hop gaps', value: s.passed, better: 'higher', format: 'int' },
  }),
  bot: (w, s, tick, rnd, skill, prev) => hoverBot(w, s, tick, skill, rnd, prev),
});

export const gravityFlip = ghostGame(gflipDef, {
  pubPlayer: (s: GFState) => ({ x: r1(s.x), y: r1(s.y), g: s.g, o: s.stun ? 1 : 0 }),
  score: (_w, s) => {
    const m = Math.round(s.x / 50);
    return {
      score: m,
      perf: Math.min(1, m / 480),
      highlight: `${m} m · ${s.flips} flips · ${s.crashes} spike${s.crashes === 1 ? '' : 's'} hit`,
      bonuses: s.crashes === 0 && m > 0 ? [{ label: 'Flawless run', pts: 40 }] : [],
      record: { key: 'dist', label: 'Longest Gravity Flip run', value: m, better: 'higher', format: 'int' },
    };
  },
  bot: (w, s, tick, rnd, skill) => gflipBot(w, s, tick, skill, rnd),
});

export const roadHopper = ghostGame(hopperDef, {
  pubPlayer: (s: RHState) => ({ c: r1(s.col), r: s.row, x: s.crossings, d: s.dead > 0 ? 1 : 0 }),
  score: (w, s) => ({
    score: s.crossings * 100 + s.best,
    perf: Math.min(1, (s.crossings + s.best / w.lanes.length) / 12),
    highlight: `${s.crossings} crossing${s.crossings === 1 ? '' : 's'} · ${s.deaths} splat${s.deaths === 1 ? '' : 's'}`,
    bonuses: s.deaths === 0 && s.crossings > 0 ? [{ label: 'Not a scratch', pts: 40 }] : [],
    record: { key: 'cross', label: 'Most road crossings', value: s.crossings, better: 'higher', format: 'int' },
  }),
  bot: (w, s, tick, rnd, skill, prev) => hopperBot(w, s, tick, skill, rnd, prev),
});
