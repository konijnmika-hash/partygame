import { cat } from './helpers';
const g = cat('physics');

export const PHYSICS = [
  g('wobbly-tower', 'Wobbly Tower', '🏗️', 'Take turns stacking. Do not topple it!', [
    'Players take turns dropping a swinging block onto ONE shared tower.',
    'Misaligned blocks shift the balance of the whole tower.',
    'Whoever topples the tower loses big.',
    'Precise drops earn bonus points.',
  ], ['tap'], 2, 8, 90),
  g('ball-balance', 'Ball Balance', '⚖️', 'Tilt your plate. Keep the ball on it.', [
    'Tilt your plate with the joystick, arrow keys or by tilting your phone.',
    'Keep your ball on the shrinking plate.',
    'Watch out for gusts of wind!',
    'Survive the longest — the golden centre ring scores double.',
  ], ['joystick', 'keys', 'tilt'], 2, 16, 60, { realtime: 'ghost' }),
  g('physics-race', 'Mini Physics Race', '🚙', 'Gas it up the hills — without flipping.', [
    'Hold GAS to drive over a bumpy hill track.',
    'Too much gas on a slope and your car does a wheelie... and flips!',
    'In the air, GAS tilts you back and BRAKE tilts you forward — land on your wheels.',
    'Flipping costs you precious seconds. Reach the finish flag first.',
  ], ['hold', 'keys'], 2, 16, 40, { realtime: 'ghost', orientation: 'landscape' }),
  g('stack-objects', 'Stack the Objects', '📦', 'Tap to drop. Build the tallest stack.', [
    'A block slides back and forth above your stack.',
    'Tap to drop it — overhanging parts get sliced off.',
    'Perfect drops keep your block full size.',
    'Tallest stack when time runs out wins.',
  ], ['tap'], 2, 16, 60),
  g('bouncy-arena', 'Bouncy Arena', '🥊', 'Bump everyone off the platform.', [
    'Move with the joystick or WASD/arrows.',
    'Press DASH to launch into rivals.',
    'Knock everyone off the platform — stay on yourself!',
    'Three rounds. The platform shrinks.',
  ], ['joystick', 'keys'], 2, 12, 90, { realtime: 'arena' }),
  g('push-button', 'Push the Button', '🔘', 'Stand on the button. Shove others off.', [
    'A giant button sits in the arena.',
    'Stand on it to charge up your points.',
    'Dash into rivals to shove them off.',
    'The button moves around — keep up!',
  ], ['joystick', 'keys'], 2, 12, 60, { realtime: 'arena' }),
  g('obstacle-course', 'Tiny Obstacle Course', '🚧', 'Spinning bars, sliding walls, finish line.', [
    'Race from the start pad to the finish line.',
    'Spinning bars and sliding walls knock you back.',
    'Bumpers bounce you around; blue pads boost you forward.',
    'Finish order decides the winner.',
  ], ['joystick', 'keys'], 2, 12, 45, { realtime: 'arena' }),
  g('falling-platforms', 'Falling Platforms', '🧱', 'Tiles crumble after you step. Keep moving!', [
    'Every tile you stand on cracks — worn-out tiles fall a moment later.',
    'Keep moving over fresh tiles and plan your path.',
    'Jump to hop over gaps. Bump rivals into the holes!',
    'Last Bloop standing wins.',
  ], ['joystick', 'keys'], 2, 12, 50, { realtime: 'arena' }),
  g('balloon-survival', 'Balloon Survival', '🎈', 'Protect your balloons. Pop theirs.', [
    'You carry three balloons.',
    'Darts fly across the arena — dodge them!',
    'Dash into rivals to pop their balloons.',
    'Last Bloop with balloons wins.',
  ], ['joystick', 'keys'], 2, 12, 60, { realtime: 'arena' }),
  g('physics-puzzle', 'Physics Puzzle Race', '🧲', 'Place ramps to guide the ball home.', [
    'A ball needs to reach the goal.',
    'Tap the board to place a ramp, drag to move it, rotate it, then press GO.',
    'Physics does the rest — tweak and retry!',
    'First to solve each puzzle scores most.',
  ], ['drag', 'tap'], 2, 16, 140),
];
