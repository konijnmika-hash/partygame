import type { GameDef } from '../../engine/types';
import { voiceGuess } from './voiceGuess';
import { fakeAuction } from './fakeAuction';
import { ridiculousRanking } from './ridiculousRanking';
import { guessSound } from './guessSound';
import { weirdQuiz } from './weirdQuiz';
import { memeCaption } from './memeCaption';
import { emojiStory } from './emojiStory';
import { nonsenseSentence } from './nonsenseSentence';
import { mysteryObject } from './mysteryObject';
import { sillyChallenge } from './sillyChallenge';

export const WEIRD_GAMES: GameDef[] = [
  voiceGuess, fakeAuction, ridiculousRanking, guessSound, weirdQuiz, memeCaption, emojiStory, nonsenseSentence, mysteryObject, sillyChallenge,
];
