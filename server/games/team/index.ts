import type { GameDef } from '../../engine/types';
import { teamDrawing } from './teamDrawing';
import { teamTrivia } from './teamTrivia';
import { coopPuzzle } from './coopPuzzle';
import { relayChallenge } from './relayChallenge';
import { sharedMaze } from './sharedMaze';
import { teamReaction } from './teamReaction';
import { teamWord } from './teamWord';
import { construction } from './construction';
import { teamMemory } from './teamMemory';
import { teamSurvival } from './teamSurvival';
import { blobSoccer } from './blobSoccer';
import { tugOfWar } from './tugOfWar';

export const TEAM_GAMES: GameDef[] = [
  teamDrawing, teamTrivia, coopPuzzle, relayChallenge, sharedMaze, teamReaction, teamWord, construction, teamMemory, teamSurvival, blobSoccer, tugOfWar,
];
