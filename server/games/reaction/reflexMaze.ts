import { ghostGame } from '../../engine/ghost';
import { reflexMazeDef, DX, DY, rmPos, type RMState } from '@shared/ghosts/reflexMaze';
import type { GInput } from '@shared/ghost';

export const reflexMaze = ghostGame(reflexMazeDef, {
  pubPlayer: (s: RMState, sim) => {
    const p = rmPos(sim.world, s);
    return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, l: s.lives, dist: Math.round(s.dist * 10) / 10 };
  },
  score: (_w, s, sim) => {
    const score = s.dist + s.lives * 4;
    return {
      score,
      perf: Math.min(1, s.dist / 230),
      highlight: `${Math.round(s.dist)} m · ${s.turns} turns · ${s.crashes} crashes`,
      bonuses: s.crashes === 0 && sim.doneAt != null ? [{ label: 'Flawless run', pts: 50 }] : [],
      record: { key: 'dist', label: 'Longest run', value: Math.round(s.dist), better: 'higher', format: 'int' },
    };
  },
  bot: (w, s, _tick, rnd, skill): GInput => {
    const len = w.lens[s.seg];
    const nextDir = w.dirs[s.seg + 1];
    if (len - s.d < 1.2 && s.queued !== nextDir) {
      const dir = rnd() < skill + 0.08 ? nextDir : Math.floor(rnd() * 4);
      return [DX[dir] * 8, DY[dir] * 8, 0];
    }
    return [0, 0, 0];
  },
});
