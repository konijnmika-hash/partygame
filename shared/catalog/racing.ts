import { cat } from './helpers';
const g = cat('racing');

export const RACING = [
  g('kart-race', 'Tiny Kart Race', '🏎️', 'Three laps of bumper-to-bumper chaos.', [
    'Steer with the joystick or arrows — your kart accelerates automatically.',
    'Hit boost pads, avoid the oil slicks.',
    'Driving on grass slows you down.',
    'First to finish three laps wins.',
  ], ['joystick', 'keys'], 2, 12, 60, { realtime: 'arena' }),
  g('speed-run', 'Speed Run', '🏃', 'Platform sprint to the flag.', [
    'Run and jump through the level to the flag.',
    'Spikes send you back to the last checkpoint.',
    'Everyone runs the same level — see their ghosts!',
    'Fastest finish wins.',
  ], ['joystick', 'keys', 'tap'], 2, 16, 70, { realtime: 'ghost', orientation: 'landscape' }),
  g('obstacle-sprint', 'Obstacle Sprint', '🏃‍♀️', 'Auto-run. Jump hurdles. Slide under bars.', [
    'Your Bloop runs automatically.',
    'Tap / swipe up to jump hurdles.',
    'Swipe down to slide under bars.',
    'Three hits and you are out. Go the distance!',
  ], ['swipe', 'tap', 'keys'], 2, 16, 60, { realtime: 'ghost', orientation: 'landscape' }),
  g('platform-race', 'Platform Race', '🪜', 'Bounce upward. Climb the highest.', [
    'You bounce automatically on every platform.',
    'Steer left and right to land on the next one.',
    'Springs launch you sky high.',
    'Highest climb in 60 seconds wins.',
  ], ['joystick', 'keys', 'tilt'], 2, 16, 60, { realtime: 'ghost' }),
  g('jump-challenge', 'Jump Challenge', '🪢', 'Jump the rope. It only gets faster.', [
    'A giant rope swings around.',
    'Tap JUMP to clear it as it passes under you.',
    'Speed changes and double ropes appear.',
    'Clear it at the top of your jump for bonus points. Three misses and you are out.',
  ], ['tap', 'keys'], 2, 16, 60, { realtime: 'ghost' }),
  g('dodge-objects', 'Dodge the Objects', '☄️', 'Meteors, lasers and chaos. Dodge it all.', [
    'Meteors fall where the shadows appear.',
    'Lasers sweep across the arena.',
    'Three hits and you are out.',
    'Survive the longest!',
  ], ['joystick', 'keys'], 2, 12, 60, { realtime: 'arena' }),
  g('collect-coins', 'Collect the Coins', '🪙', 'Grab the coins. Bump rivals to make them drop.', [
    'Coins pop up all over the arena — grab them!',
    'Gems are worth five coins.',
    'Dash into rivals to knock coins out of them.',
    'Most coins at the buzzer wins.',
  ], ['joystick', 'keys'], 2, 12, 50, { realtime: 'arena' }),
  g('maze-race', 'Maze Race', '🗺️', 'Race through the maze to the exit.', [
    'Everyone gets the same maze.',
    'Swipe, use arrows or tap a neighbouring cell to move.',
    'Reach the exit first.',
    'Three mazes, each bigger than the last.',
  ], ['swipe', 'keys', 'tap'], 2, 16, 75),
  g('bomb-dodge', 'Bomb Dodge', '💣', 'Pass the bomb before it blows!', [
    'One Bloop holds a ticking bomb.',
    'Touch another Bloop to pass it on.',
    'When it explodes, the holder is out.',
    'Last Bloop standing wins.',
  ], ['joystick', 'keys'], 3, 12, 60, { realtime: 'arena' }),
  g('survival-run', 'Survival Run', '🌋', 'Outrun the lava. Do not fall behind.', [
    'The lava wall chases you forward.',
    'Dodge boulders and squeeze through gaps.',
    'Fall behind the lava and you are toast.',
    'Survive the longest to win.',
  ], ['joystick', 'keys'], 2, 12, 75, { realtime: 'arena' }),
];
