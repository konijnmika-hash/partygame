import type { GameDef } from '../../engine/types';
import { quickMath } from './quickMath';
import { wordScramble } from './wordScramble';
import { anagramRace } from './anagramRace';
import { triviaBattle } from './triviaBattle';
import { puzzleRush } from './puzzleRush';
import { numberHunt } from './numberHunt';
import { logicChallenge } from './logicChallenge';
import { spotDifference } from './spotDifference';
import { riddleRace } from './riddleRace';
import { mysteryBox } from './mysteryBox';

export const PUZZLE_GAMES: GameDef[] = [
  quickMath, wordScramble, anagramRace, triviaBattle, puzzleRush, numberHunt, logicChallenge, spotDifference, riddleRace, mysteryBox,
];
