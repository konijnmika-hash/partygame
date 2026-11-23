import { cat } from './helpers';
const g = cat('drawing');

export const DRAWING = [
  g('draw-guess', 'Draw & Guess', '🖍️', 'One draws, everyone else races to guess.', [
    'Each turn one player picks a secret word and draws it.',
    'Everyone else types guesses — faster correct guesses score more.',
    'The artist scores for every player who cracks it.',
    'Letter hints appear as the timer runs down.',
  ], ['draw', 'type'], 2, 12, 160),
  g('speed-sketch', 'Speed Sketch', '✏️', 'Same prompt. 30 seconds. Gallery vote.', [
    'Everyone draws the same prompt at the same time.',
    'When time is up the gallery opens.',
    'Vote for your favourite drawing — not your own!',
    'Votes become points. Two prompts per game.',
  ], ['draw', 'vote'], 3, 12, 120),
  g('blind-drawing', 'Blind Drawing', '🙈', 'Draw without seeing your own lines.', [
    "The artist's ink is invisible to them — everyone else sees it live!",
    'Guessers tap the right word from the options.',
    'Wrong picks freeze you for a moment.',
    'The artist scores when people guess correctly.',
  ], ['draw', 'tap'], 2, 12, 140),
  g('eyes-closed', 'Draw With Your Eyes Closed', '🫣', 'Trace the shape... blindfolded.', [
    'A shape appears. Memorize it!',
    'The moment you start drawing, the shape vanishes and your ink turns invisible.',
    'Trace it as accurately as you can — accuracy is scored automatically.',
    'Then enjoy the hilarious reveal.',
  ], ['draw'], 2, 16, 75),
  g('guess-doodle', 'Guess the Doodle', '🔎', 'The doodle draws itself. Guess it first!', [
    'A mystery doodle draws itself stroke by stroke.',
    'Tap the answer as soon as you recognize it.',
    'Earlier correct guesses score more.',
    'Wrong guesses freeze you for 2 seconds.',
  ], ['tap'], 2, 16, 90),
  g('drawing-relay', 'Drawing Relay', '🔁', 'Write, draw, describe, draw... chaos!', [
    'Everyone writes a silly prompt.',
    'Prompts pass along: draw what you get, then describe the drawing you get.',
    'Watch every chain mutate at the big reveal.',
    'Vote for the best moment in each chain.',
  ], ['type', 'draw', 'vote'], 3, 12, 240),
  g('fake-artist', 'Fake Artist', '🕵️', 'Everyone knows the word... except one.', [
    'Everyone except the Fake Artist sees the secret word.',
    'Take turns adding ONE stroke to the shared drawing.',
    'After two laps, vote for the Fake Artist.',
    'If caught, the Fake can still steal the win by guessing the word!',
  ], ['draw', 'vote'], 3, 10, 180),
  g('memory-draw', 'Drawing From Memory', '🧠', 'Memorize the doodle, then redraw it.', [
    'A doodle flashes on screen for a few seconds.',
    'Redraw it from memory — position and shape both matter.',
    'Accuracy is scored automatically.',
    'Three doodles, each trickier than the last.',
  ], ['draw'], 2, 16, 90),
  g('pixel-guess', 'Pixel Art Guess', '👾', 'Paint pixels, then guess the pictures.', [
    'Everyone gets a secret word and paints it on a tiny pixel grid.',
    'Then each painting is shown — pick the right word!',
    'Artists score when others guess their art.',
    'Guessers score for fast, correct picks.',
  ], ['tap', 'drag'], 3, 10, 150),
  g('draw-10', 'Draw in 10 Seconds', '⏱️', 'Head-to-head 10-second sketch duels.', [
    'Players pair up for sketch duels.',
    'Both duelists get the same prompt and only 10 seconds.',
    'Everyone else votes for the better sketch.',
    'Win duels to rack up points.',
  ], ['draw', 'vote'], 3, 12, 150),
];
