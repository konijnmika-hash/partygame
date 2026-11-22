import { cat } from './helpers';
const g = cat('puzzle');

export const PUZZLE = [
  g('quick-math', 'Quick Math', '➗', 'Solve as many sums as you can.', [
    'Math problems appear one after another.',
    'Type the answer on the number pad.',
    'Streaks multiply your score.',
    'They get harder as you go!',
  ], ['numpad'], 2, 16, 50),
  g('word-scramble', 'Word Scramble', '🔤', 'Unscramble the word before anyone else.', [
    'A scrambled word appears.',
    'Tap the letters in the right order to unscramble it.',
    'First to solve scores the most.',
    'Eight words.',
  ], ['tap', 'type'], 2, 16, 100),
  g('anagram-race', 'Anagram Race', '🅰️', 'Make as many words as you can from 7 letters.', [
    'You get seven letters.',
    'Make as many words (3+ letters) as you can.',
    'Longer words score more.',
    'Words nobody else found earn a bonus!',
  ], ['tap', 'type'], 2, 16, 80),
  g('trivia-battle', 'Trivia Battle', '❓', 'Fast fingers, big brains.', [
    'Answer multiple-choice trivia questions.',
    'Faster correct answers score more.',
    'Answer streaks earn bonus points.',
    'Ten questions across all topics.',
  ], ['tap'], 2, 16, 130),
  g('puzzle-rush', 'Puzzle Rush', '🧩', 'Slide the tiles into order. Race!', [
    'Slide tiles into the empty space.',
    'Put the numbers in order, 1 to 8.',
    'Everyone gets the same scramble.',
    'Fastest solve wins.',
  ], ['tap', 'swipe'], 2, 16, 120),
  g('number-hunt', 'Number Hunt', '🔢', 'Tap 1 to 25 in order. Fast!', [
    'Numbers are scattered on a grid.',
    'Tap them in order starting from 1.',
    'Wrong taps freeze you briefly.',
    'Two boards — the second one moves around!',
  ], ['tap'], 2, 16, 80),
  g('logic-challenge', 'Logic Challenge', '🧮', 'What comes next? Crack the pattern.', [
    'Number, shape and letter patterns appear.',
    'Pick what comes next.',
    'Fast correct answers score more.',
    'Ten brain-twisters.',
  ], ['tap'], 2, 16, 110),
  g('spot-difference', 'Spot the Difference', '👀', 'Five differences. Find them first.', [
    'Two scenes appear side by side.',
    'Tap the differences in the right-hand scene.',
    'Each difference found earns points — wrong taps cost time.',
    'Three scenes.',
  ], ['tap'], 2, 16, 100),
  g('riddle-race', 'Riddle Race', '🦉', 'Solve riddles before the hints give it away.', [
    'A riddle appears.',
    'Type your answer — letter hints reveal over time.',
    'Earlier correct answers score more.',
    'Six riddles.',
  ], ['type'], 2, 16, 150),
  g('mystery-box', 'Mystery Box', '🎁', 'Clues reveal the mystery item. Guess early!', [
    'A mystery box hides an object.',
    'Clues are revealed one by one.',
    'Guess whenever you like — earlier correct guesses score more.',
    'You only get ONE guess per box!',
  ], ['tap'], 2, 16, 120),
];
