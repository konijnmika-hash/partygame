import type { GameDef } from '../../engine/types';
import { patternMemory } from './patternMemory';
import { simonSays } from './simonSays';
import { sequenceChallenge } from './sequenceChallenge';
import { memoryTiles } from './memoryTiles';
import { matchObjects } from './matchObjects';
import { rememberRoom } from './rememberRoom';
import { soundMemory } from './soundMemory';
import { flashMemory } from './flashMemory';
import { memoryRace } from './memoryRace';
import { hiddenObjects } from './hiddenObjects';

export const MEMORY_GAMES: GameDef[] = [
  patternMemory, simonSays, sequenceChallenge, memoryTiles, matchObjects, rememberRoom, soundMemory, flashMemory, memoryRace, hiddenObjects,
];
