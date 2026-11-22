import { cat } from './helpers';
const g = cat('memory');

export const MEMORY = [
  g('pattern-memory', 'Pattern Memory', '🔲', 'Remember the lit tiles. Tap them back.', [
    'Tiles light up for a moment.',
    'Tap all the tiles that were lit.',
    'Each level adds more tiles and a bigger grid.',
    'Three mistakes and you are out.',
  ], ['tap'], 2, 16, 90),
  g('simon-says', 'Simon Says', '🗣️', 'Only obey when Simon says!', [
    'Simon gives commands: tap a colour, swipe, hold...',
    'Only obey commands that start with "Simon says"!',
    'Commands chain together and get longer.',
    'Mess up and you lose a life.',
  ], ['tap', 'swipe'], 2, 16, 100),
  g('sequence-challenge', 'Sequence Challenge', '🎹', 'Repeat the growing light-and-sound sequence.', [
    'Four pads flash a sequence with sounds.',
    'Repeat the sequence in order.',
    'One more step gets added every round.',
    'One mistake and you are out. Longest sequence wins.',
  ], ['tap'], 2, 16, 120),
  g('memory-tiles', 'Memory Tiles', '🃏', 'Flip pairs on a shared board.', [
    'Players take turns flipping two cards.',
    'Find a matching pair to score and go again.',
    'Everyone sees every flip — remember them!',
    'Most pairs when the board is cleared wins.',
  ], ['tap'], 2, 6, 150),
  g('match-objects', 'Match the Objects', '🍒', 'Peek, memorize, then match every pair.', [
    'All cards are revealed for three seconds.',
    'Then they flip — match every pair as fast as you can.',
    'Mistakes add a time penalty.',
    'Three boards, each bigger than the last.',
  ], ['tap'], 2, 16, 80),
  g('remember-room', 'Remember the Room', '🛋️', 'Study the room. Answer the questions.', [
    'A room full of objects appears for a few seconds.',
    'Then answer questions about what you saw.',
    'What colour was the lamp? How many cats?',
    'Fast correct answers score most.',
  ], ['tap'], 2, 16, 100),
  g('sound-memory', 'Sound Memory', '🔊', 'Match pairs of sounds. Ears on!', [
    'Every card hides a sound.',
    'Tap two cards to hear them — find matching sounds.',
    'Turn your sound on for this one!',
    'Fastest to match all pairs wins.',
  ], ['tap'], 2, 16, 90, { needsSound: true }),
  g('flash-memory', 'Flash Memory', '📸', 'Digits flash. Type them back.', [
    'A number flashes on screen for a moment.',
    'Type it back exactly.',
    'Each correct answer adds another digit.',
    'Three mistakes and you are out.',
  ], ['numpad'], 2, 16, 90),
  g('memory-race', 'Memory Race', '🏃‍♂️', 'Memorize the safe path, then race across.', [
    'A safe path across the board flashes briefly.',
    'Race across by stepping on neighbouring tiles.',
    'Step on a trap tile and you go back to the start — and everyone sees it!',
    'First to cross wins.',
  ], ['tap', 'swipe', 'keys'], 2, 12, 90),
  g('hidden-objects', 'Hidden Objects', '🔍', 'Remember the list. Find them all.', [
    'A list of objects to find flashes briefly — remember it!',
    'Then find and tap them in the busy scene.',
    'Wrong taps cost time.',
    'First to find them all wins.',
  ], ['tap'], 2, 16, 90),
];
