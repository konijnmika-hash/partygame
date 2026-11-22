import { cat } from './helpers';
const g = cat('reaction');

export const REACTION = [
  g('lightning-reflex', 'Lightning Reflex', '⚡', 'Wait for green... TAP!', [
    'Wait while the screen is red.',
    'The instant it turns green, tap as fast as you can!',
    'Tapping early is a false start.',
    'Five rounds — your average reaction time counts.',
  ], ['tap'], 2, 16, 50),
  g('fake-button', 'Fake Button', '🔴', 'Only tap the REAL button.', [
    'Buttons flash with different labels and colours.',
    'Tap ONLY when the real green GO button appears.',
    'Decoys cost points. Hesitation costs speed.',
    'Fifteen flashes of pure paranoia.',
  ], ['tap'], 2, 16, 60),
  g('color-reaction', 'Color Reaction', '🌈', 'Tap the INK colour, not the word.', [
    'A colour word appears painted in a different ink.',
    'Tap the button that matches the INK colour.',
    'Speed and accuracy both count.',
    'It keeps getting faster!',
  ], ['tap'], 2, 16, 60),
  g('reaction-duel', 'Reaction Duel', '🤠', 'Quick-draw showdown tournament.', [
    'Players face off in head-to-head duels.',
    'Wait for DRAW! — beware of fakes like DRAT! or DRAGON!',
    'First valid tap wins the duel; tapping early loses it.',
    'Winners advance through the bracket.',
  ], ['tap'], 2, 16, 120),
  g('stop-5', 'Stop at Exactly 5 Seconds', '⏲️', 'Stop the clock at exactly the target.', [
    'A timer starts — then it disappears!',
    'Tap STOP when you think the target time is reached.',
    'The closer you are, the more points.',
    'Three targets. No peeking.',
  ], ['tap'], 2, 16, 60),
  g('catch-falling', 'Catch the Falling Object', '🍎', 'Catch the fruit, dodge the bombs.', [
    'Fruit rains from the sky — move left and right to catch it.',
    'Golden fruit is worth extra.',
    'Bombs stun you and cost points.',
    'Bump rival baskets out of the way!',
  ], ['joystick', 'keys'], 2, 12, 60, { realtime: 'arena', orientation: 'landscape' }),
  g('quick-click', 'Quick Click', '🎯', 'Targets pop up — first tap claims it.', [
    'Targets pop up all over the board.',
    'Be the first to tap a target to claim it.',
    'Tiny targets are worth more.',
    "Don't tap the skulls!",
  ], ['tap'], 2, 16, 45),
  g('tap-symbol', 'Tap the Correct Symbol', '🔣', 'Find the matching symbol in the crowd.', [
    'A target symbol appears at the top.',
    'Find and tap the same symbol in the grid.',
    'Wrong taps freeze you for a second.',
    'Twelve rounds, bigger grids.',
  ], ['tap'], 2, 16, 70),
  g('reflex-maze', 'Reflex Maze', '🌀', 'Steer through the maze at full speed.', [
    'Your Bloop zooms through a twisting corridor.',
    'Swipe or press the arrow just before each turn.',
    'Hit a wall and you lose a life.',
    'It speeds up — go the distance!',
  ], ['swipe', 'keys'], 2, 16, 60, { realtime: 'ghost' }),
  g('reaction-roulette', 'Reaction Roulette', '🎰', 'Spin the wheel of random reflex tests.', [
    'The wheel picks a surprise reflex challenge.',
    'Every challenge has its own rule — read fast!',
    'Points for speed and accuracy on every spin.',
    'Eight spins of chaos.',
  ], ['tap'], 2, 16, 100),
];
