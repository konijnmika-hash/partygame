import { cat } from './helpers';
const g = cat('mind', true);

export const MIND = [
  g('lowest-unique', 'Lowest Unique', '1️⃣', 'Pick the lowest number nobody else picks.', [
    'Secretly pick a number from 1 to 20.',
    'The LOWEST number picked by only ONE player wins the round.',
    'Duplicates cancel each other out!',
    'Eight rounds of mind games.',
  ], ['tap'], 3, 16, 110),
  g('chicken-out', 'Chicken Out', '🐔', 'The pot grows. Bail before it bursts.', [
    'A pot of points grows every second.',
    'Tap BAIL to bank the current pot.',
    'If the balloon pops before you bail, you get nothing!',
    'Five balloons.',
  ], ['tap'], 2, 16, 100),
  g('rps-royale', 'Rock Paper Royale', '✊', 'Rock paper scissors... against everyone.', [
    'Everyone throws rock, paper or scissors at once.',
    'You score one point for every player you beat.',
    'Watch what others threw — patterns matter!',
    'Seven throws.',
  ], ['tap'], 2, 16, 80),
  g('land-grab', 'Land Grab', '🏰', 'Claim land secretly. Clashes cancel.', [
    'Each turn, secretly pick a tile next to your land.',
    'If two players pick the same tile, nobody gets it!',
    'Gold tiles are worth extra.',
    'Most land after ten turns wins.',
  ], ['tap'], 2, 8, 120),
  g('dots-boxes', 'Dots & Boxes', '⬛', 'Draw lines. Close boxes. Go again.', [
    'Take turns drawing one line between dots.',
    'Close a box to claim it and take another turn.',
    'Do not hand your rivals easy boxes!',
    'Most boxes wins.',
  ], ['tap'], 2, 6, 150),
  g('minority-rules', 'Minority Rules', '🙋', 'Pick the option fewer people pick.', [
    'Two options appear.',
    'Pick the one you think FEWER players will choose.',
    'The minority scores!',
    'Eight dilemmas.',
  ], ['tap'], 3, 16, 100),
  g('mind-sync', 'Mind Sync', '🔗', 'Answer the same as everyone else.', [
    'A prompt appears: "Name a fruit".',
    'Type the answer you think others will also write.',
    'Score for every player who matched you.',
    'Seven prompts.',
  ], ['type'], 3, 16, 130),
  g('hot-seat', 'Hot Seat', '🪑', 'Predict what the player in the hot seat picks.', [
    'One player is in the hot seat each round.',
    'They secretly answer a this-or-that question about themselves.',
    'Everyone else predicts their answer.',
    'Score for correct predictions — and for being predictable.',
  ], ['tap'], 3, 12, 140),
  g('mind-meld', 'Mind Meld', '📡', 'One clue. Find the spot on the spectrum.', [
    'The psychic sees a secret spot on a spectrum, like COLD ↔ HOT.',
    'They give a one-word clue.',
    'Everyone else drags the dial to where they think the spot is.',
    'Closer guesses score more; the psychic rotates.',
  ], ['type', 'drag'], 3, 12, 170),
  g('higher-lower', 'Higher or Lower', '⬆️', 'Is the next one higher or lower?', [
    'Two things are compared by a hidden number.',
    'Guess whether the second is HIGHER or LOWER.',
    'Build a streak of correct calls.',
    'Twelve comparisons.',
  ], ['tap'], 2, 16, 100),
  g('guesstimate', 'Guesstimate', '🤔', 'Closest estimate wins.', [
    'An estimation question appears.',
    'Type your best guess.',
    'Closest guess scores most — wild guesses still might win!',
    'Seven questions.',
  ], ['numpad'], 2, 16, 120),
  g('blingo', 'Blingo', '🅱️', 'Emoji bingo with fake calls.', [
    'Everyone has a 4×4 emoji card.',
    'Emoji are called one by one — tap to mark them.',
    'Some calls are FAKE (crossed out) — do not mark those!',
    'Get a line and hit BLINGO! False calls cost you.',
  ], ['tap'], 2, 16, 100),
  g('stonks', 'Stonks', '📈', 'Buy low. Sell high. Read the news.', [
    'A stock price wiggles in real time.',
    'Buy and sell shares with your 1000 coins.',
    'News headlines hint where the price will go.',
    'Richest at the closing bell wins.',
  ], ['tap'], 2, 16, 70),
];
