import { cat } from './helpers';
const g = cat('brain', true);

export const BRAIN = [
  g('code-cracker', 'Code Cracker', '🔐', 'Crack the secret gem code.', [
    'A secret code of four coloured gems is hidden.',
    'Guess a code: ● means right gem, right spot; ○ means right gem, wrong spot.',
    'Crack it in as few guesses as possible.',
    'Fewest guesses (then fastest) wins.',
  ], ['tap'], 2, 16, 120),
  g('pipe-panic', 'Pipe Panic', '🚰', 'Rotate the pipes. Let it flow!', [
    'Tap pipe tiles to rotate them.',
    'Connect the water source to the drain.',
    'Everyone gets the same board.',
    'Fastest connection wins. Three boards.',
  ], ['tap'], 2, 16, 110),
  g('lights-out', 'Lights Out', '💡', 'Switch every light off.', [
    'Tapping a light toggles it AND its neighbours.',
    'Turn every light off.',
    'Fewer taps earn a bonus.',
    'Three puzzles.',
  ], ['tap'], 2, 16, 110),
  g('merge-mania', 'Merge Mania', '🔢', 'Slide and merge to the biggest tile.', [
    'Swipe to slide all the tiles.',
    'Matching tiles merge and double.',
    'Get the biggest tile and score before time is up.',
    'Run out of moves? Game over for you.',
  ], ['swipe', 'keys'], 2, 16, 90),
  g('gem-swap', 'Gem Swap', '💎', 'Swap gems. Match three. Cascade!', [
    'Swap two neighbouring gems to make a line of three or more.',
    'Matched gems vanish and new ones fall.',
    'Cascades and big matches score more.',
    'Highest score in 75 seconds wins.',
  ], ['tap', 'swipe'], 2, 16, 80),
  g('mine-dash', 'Mine Dash', '⛏️', 'Clear the minefield first.', [
    'Tap to reveal tiles; numbers count neighbouring mines.',
    'Long-press or switch to flag mode to mark mines.',
    'Hit a mine and you lose 10 seconds.',
    'First to clear the board wins.',
  ], ['tap', 'hold'], 2, 16, 120),
  g('color-flood', 'Color Flood', '🌊', 'Flood the board in as few moves as possible.', [
    'Pick a colour to flood from the top-left corner.',
    'Your flooded area grows by absorbing matching neighbours.',
    'Fill the whole board with one colour.',
    'Fewest moves wins. Three boards.',
  ], ['tap'], 2, 16, 100),
  g('odd-color', 'Odd Color Out', '🟩', 'One tile is a slightly different shade.', [
    'Find the single tile with a slightly different colour.',
    'Each level the grid grows and the difference shrinks.',
    'Wrong taps freeze you briefly.',
    'Highest level in 45 seconds wins.',
  ], ['tap'], 2, 16, 50),
  g('crowd-count', 'Crowd Count', '🐤', 'How many were there? Estimate!', [
    'A crowd of moving critters appears for a few seconds.',
    'Estimate how many there were (sometimes just one kind!).',
    'Closest estimates score most.',
    'Six crowds.',
  ], ['numpad'], 2, 16, 90),
  g('hot-cold', 'Hot & Cold', '🌡️', 'Find the hidden spot. Warmer... warmer!', [
    'A secret spot is hidden on the map.',
    'Tap anywhere — you will learn how hot or cold you are.',
    'Find the spot in as few taps as possible.',
    'Four maps.',
  ], ['tap'], 2, 16, 100),
  g('word-bomb', 'Word Bomb', '🧨', 'Type a word with the letters before it blows!', [
    'On your turn, type a word containing the letters shown.',
    'The bomb has a hidden fuse — be quick!',
    'If it explodes on your turn you lose a life.',
    'Last Bloop with lives wins.',
  ], ['type'], 2, 12, 150),
  g('letter-drop', 'Letter Drop', '🔠', 'Guess letters to reveal the phrase first.', [
    'Everyone tries to solve the same hidden phrase.',
    'Pick letters to reveal them on YOUR board.',
    'Wrong letters cost you a life — six lives.',
    'Solve it fastest to win.',
  ], ['tap', 'type'], 2, 16, 120),
  g('category-blitz', 'Category Blitz', '📝', 'One letter, five categories, go!', [
    'You get a letter and five categories.',
    'Write an answer for each that starts with the letter.',
    'Everyone votes to approve or reject answers.',
    'Unique answers score double!',
  ], ['type', 'vote'], 2, 12, 180),
  g('type-racer', 'Type Racer', '⌨️', 'Type the sentence. Fastest fingers win.', [
    'A silly sentence appears.',
    'Type it exactly, as fast as you can.',
    'Typos must be fixed before you continue.',
    'Three sentences.',
  ], ['type'], 2, 16, 90),
  g('order-up', 'Order Up!', '🍔', 'Build the burgers in the right order.', [
    'Customers order stacked burgers.',
    'Tap ingredients in the exact order shown.',
    'Wrong ingredient? Start that burger over.',
    'Most completed orders wins.',
  ], ['tap'], 2, 16, 75),
  g('sorting-frenzy', 'Sorting Frenzy', '🗂️', 'Swipe left or right to sort. Fast!', [
    'Items appear one at a time.',
    'Swipe (or press arrows) to sort them into the right group.',
    'Speed builds combos; mistakes break them.',
    'The rules change every 10 items!',
  ], ['swipe', 'keys', 'tap'], 2, 16, 60),
  g('shell-game', 'Shell Shuffle', '🥤', 'Follow the ball under the cups.', [
    'A ball hides under one of the cups.',
    'Watch the cups shuffle... faster and faster.',
    'Tap the cup hiding the ball.',
    'Seven rounds.',
  ], ['tap'], 2, 16, 90),
];
