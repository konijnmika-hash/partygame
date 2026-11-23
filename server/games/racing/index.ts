import type { GameDef } from '../../engine/types';
import { kartRace } from './kartRace';
import { speedRun, obstacleSprint, platformRace, jumpChallenge } from './ghostGames';
import { dodgeObjects } from './dodgeObjects';
import { collectCoins } from './collectCoins';
import { mazeRace } from './mazeRace';
import { bombDodge } from './bombDodge';
import { survivalRun } from './survivalRun';

export const RACING_GAMES: GameDef[] = [
  kartRace, speedRun, obstacleSprint, platformRace, jumpChallenge, dodgeObjects, collectCoins, mazeRace, bombDodge, survivalRun,
];
