// Ghost simulations must be deterministic and rewind-safe: the server re-simulates every player
// from late-arriving inputs and must land on exactly the state the client predicted.
import { describe, expect, it } from 'vitest';
import { GhostSim, type GhostDef, type GInput } from '@shared/ghost';
import { createRng } from '@shared/rng';
import { reflexMazeDef } from '@shared/ghosts/reflexMaze';
import { ballBalanceDef } from '@shared/ghosts/ballBalance';
import { hillRaceDef } from '@shared/ghosts/hillRace';
import { stackDef } from '@shared/ghosts/stack';
import { sprintDef } from '@shared/ghosts/sprint';
import { climbDef } from '@shared/ghosts/climb';
import { ropeDef } from '@shared/ghosts/rope';
import { platformerDef } from '@shared/ghosts/platformer';
import { hoverDef, gflipDef, hopperDef } from '@shared/ghosts/arcade';
import { generateLevel, simulate, validRamp } from '@shared/physicsPuzzle';

const DEFS: GhostDef<any, any>[] = [reflexMazeDef, ballBalanceDef, hillRaceDef, stackDef, sprintDef, climbDef, ropeDef, platformerDef, hoverDef, gflipDef, hopperDef];

function randomInputs(seed: number, ticks: number): { k: number; i: GInput }[] {
  const rng = createRng(seed);
  const out: { k: number; i: GInput }[] = [];
  for (let k = 0; k < ticks; k += rng.int(1, 9)) out.push({ k, i: [rng.int(-8, 8), rng.int(-8, 8), rng.int(0, 3)] });
  return out;
}

describe('ghost simulations', () => {
  for (const def of DEFS) {
    it(`${def.id}: same inputs give the same state`, () => {
      const world = def.world(424242, 'normal');
      const inputs = randomInputs(7, 600);
      const run = () => {
        const sim = new GhostSim(def, world, 0, 4, 90);
        for (const { k, i } of inputs) {
          sim.advanceTo(k);
          sim.applyInput(k, i);
        }
        sim.advanceTo(600);
        return JSON.stringify(sim.state);
      };
      expect(run()).toEqual(run());
    });

    it(`${def.id}: late inputs rewind to the same result`, () => {
      const world = def.world(99, 'hard');
      const inputs = randomInputs(11, 500);
      const direct = new GhostSim(def, world, 1, 3, 90);
      for (const { k, i } of inputs) {
        direct.advanceTo(k);
        direct.applyInput(k, i);
      }
      direct.advanceTo(500);
      // the server sees each input up to ~20 ticks late and rewinds
      const late = new GhostSim(def, world, 1, 3, 90);
      for (const { k, i } of inputs) {
        late.advanceTo(k + 20);
        late.applyInput(k, i);
      }
      const end = Math.max(late.tick, 500);
      late.advanceTo(end);
      direct.advanceTo(end);
      expect(late.tick).toBe(direct.tick);
      expect(JSON.stringify(late.state)).toEqual(JSON.stringify(direct.state));
    });
  }
});

describe('physics puzzle', () => {
  it('generated levels are solvable, non-trivial and deterministic', () => {
    for (let seed = 1; seed <= 25; seed++) {
      for (const ramps of [1, 2, 3]) {
        const a = generateLevel(createRng(seed * 13 + ramps), ramps);
        const b = generateLevel(createRng(seed * 13 + ramps), ramps);
        expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
        expect(a.solution.length).toBe(ramps);
        expect(a.solution.every(validRamp)).toBe(true);
        expect(simulate(a.level, a.solution).ok).toBe(true);
        expect(simulate(a.level, []).ok).toBe(false);
      }
    }
  });

  it('rejects malformed ramps', () => {
    expect(validRamp([100, 200, 3])).toBe(true);
    expect(validRamp([100.5, 200, 3])).toBe(false);
    expect(validRamp([100, 200, 9])).toBe(false);
    expect(validRamp([5, 200, 0])).toBe(false);
    expect(validRamp([100, 200])).toBe(false);
    expect(validRamp('nope')).toBe(false);
  });
});
