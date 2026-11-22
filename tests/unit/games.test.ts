// Every registered minigame must run to completion with bots, produce valid scores and never throw.
import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '@shared/catalog/index';
import { GAME_DEFS } from '../../server/games/index';
import { simulateGame } from '../helpers/simulate';

const ONLY = process.env.GAME ? process.env.GAME.split(',') : null;
const defs = GAME_DEFS.filter((d) => !ONLY || ONLY.includes(d.id));

describe('minigame bot simulations', () => {
  for (const def of defs) {
    const meta = GAME_MAP[def.id];
    const counts = Array.from(new Set([meta.minPlayers, Math.min(meta.maxPlayers, Math.max(meta.minPlayers, 4)), Math.min(meta.maxPlayers, 8)]));
    for (const n of counts) {
      it(`${def.id} with ${n} bots`, () => {
        const r = simulateGame(def, { players: n, seed: 1000 + n });
        expect(r.errors, r.errors.join('\n')).toEqual([]);
        expect(r.ended, `${def.id} did not end within ${r.simulatedMs}ms`).toBe(true);
        expect(r.pubCount).toBeGreaterThan(0);
        const participated = Object.values(r.results!.perfs).filter((p) => p.participated).length;
        expect(participated, 'bots should participate').toBeGreaterThan(0);
        expect(r.maxPubBytes, 'pub payload too large').toBeLessThan(60_000);
      });
    }
    it(`${def.id} on hard difficulty`, () => {
      const r = simulateGame(def, { players: Math.max(meta.minPlayers, 3), difficulty: 'hard', seed: 77 });
      expect(r.errors, r.errors.join('\n')).toEqual([]);
      expect(r.ended).toBe(true);
    });
  }
});
