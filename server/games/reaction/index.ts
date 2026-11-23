import type { GameDef } from '../../engine/types';
import { lightningReflex } from './lightningReflex';
import { fakeButton } from './fakeButton';
import { colorReaction } from './colorReaction';
import { reactionDuel } from './reactionDuel';
import { stop5 } from './stop5';
import { catchFalling } from './catchFalling';
import { quickClick } from './quickClick';
import { tapSymbol } from './tapSymbol';
import { reflexMaze } from './reflexMaze';
import { reactionRoulette } from './reactionRoulette';

export const REACTION_GAMES: GameDef[] = [
  lightningReflex, fakeButton, colorReaction, reactionDuel, stop5, catchFalling, quickClick, tapSymbol, reflexMaze, reactionRoulette,
];
