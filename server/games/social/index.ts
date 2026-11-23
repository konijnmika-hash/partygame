import type { GameDef } from '../../engine/types';
import { twoTruths } from './twoTruths';
import { mostLikely } from './mostLikely';
import { secretImpostor } from './secretImpostor';
import { oddOneOut } from './oddOneOut';
import { whoSaidIt } from './whoSaidIt';
import { secretWord } from './secretWord';
import { bluffChallenge } from './bluffChallenge';
import { fakeAnswer } from './fakeAnswer';
import { hiddenRole } from './hiddenRole';
import { groupPrediction } from './groupPrediction';

export const SOCIAL_GAMES: GameDef[] = [
  twoTruths, mostLikely, secretImpostor, oddOneOut, whoSaidIt, secretWord, bluffChallenge, fakeAnswer, hiddenRole, groupPrediction,
];
