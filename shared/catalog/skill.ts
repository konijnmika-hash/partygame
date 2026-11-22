import { cat } from './helpers';
const g = cat('skill', true);

export const SKILL = [
  g('parachute-drop', 'Parachute Drop', '🪂', 'Steer your fall. Pop the chute. Hit the bullseye.', [
    'Skydive toward the target below — steer left and right.',
    'Tap to open your parachute. Too late? SPLAT.',
    'Land as close to the bullseye as possible.',
    'Three jumps, windier each time.',
  ], ['joystick', 'keys', 'tap'], 2, 16, 70, { realtime: 'ghost' }),
  g('marble-mayhem', 'Marble Mayhem', '🎱', 'Nudge your marble down the peg board.', [
    'Your marble bounces down a board full of pegs.',
    'Nudge it left or right — but nudges need to recharge.',
    'Stars along the way give bonus points.',
    'Fastest to the bottom wins.',
  ], ['tap', 'keys'], 2, 16, 60, { realtime: 'ghost' }),
  g('steady-hand', 'Steady Hand', '✋', 'Guide the dot through the wiggly tunnel.', [
    'Drag your dot along the winding tunnel.',
    'Touching the walls costs a life and sends you back a bit.',
    'The tunnel gets narrower.',
    'Furthest progress wins.',
  ], ['drag'], 2, 16, 60),
  g('fishing-frenzy', 'Fishing Frenzy', '🎣', 'Cast, wait, strike, reel!', [
    'Hold and release to cast — power decides the distance.',
    'When the bobber dips, tap fast to hook the fish!',
    'Keep the tension in the green zone while reeling.',
    'Biggest catch value wins.',
  ], ['hold', 'tap'], 2, 16, 75),
  g('mini-golf', 'Mini Golf', '⛳', 'Drag to aim. Fewest strokes wins.', [
    'Drag back from the ball to aim and set power.',
    'Bank off walls and avoid the water.',
    'Everyone plays the same hole at once.',
    'Three holes. Fewest strokes wins.',
  ], ['drag'], 2, 16, 120),
  g('blob-bowling', 'Blob Bowling', '🎳', 'Swipe to bowl. Strike!', [
    'Pick your aim, curve and power.',
    'Knock down as many pins as possible.',
    'Strikes and spares earn bonus points.',
    'Three frames.',
  ], ['drag', 'tap'], 2, 16, 90),
  g('cannon-clash', 'Cannon Clash', '💥', 'Angle, power, wind. Fire!', [
    'Set your cannon angle and power.',
    'Account for the wind!',
    'Hit the floating targets — closer to the centre scores more.',
    'Six shots.',
  ], ['drag', 'tap'], 2, 16, 90),
  g('chain-reaction', 'Chain Reaction', '🎆', 'One tap. Maximum explosions.', [
    'Dots drift around the screen.',
    'Tap ONCE to set off an explosion.',
    'Dots caught in a blast explode too — chain them!',
    'Biggest chains win. Four levels.',
  ], ['tap'], 2, 16, 70),
  g('spell-caster', 'Spell Caster', '🪄', 'Draw the runes to zap monsters.', [
    'Monsters march toward your tower, each with a rune above it.',
    'Draw that rune shape to zap them.',
    'Rune shapes: line, V, caret, circle, zigzag...',
    'Most monsters zapped wins.',
  ], ['draw'], 2, 16, 70),
  g('rhythm-rush', 'Rhythm Rush', '🥁', 'Tap the notes on the beat.', [
    'Notes slide down three lanes in time with the music.',
    'Tap the lane when the note hits the line.',
    'Perfect timing earns more; combos multiply.',
    'Sound on for the best experience!',
  ], ['tap', 'keys'], 2, 16, 60, { needsSound: true }),
  g('beat-keeper', 'Beat Keeper', '🎼', 'Keep the beat after the music stops.', [
    'A beat plays — tap along with it.',
    'Then the beat goes silent. Keep tapping at the same tempo!',
    'Most consistent timing wins.',
    'Four tempos.',
  ], ['tap'], 2, 16, 80),
  g('color-match', 'Color Mixer', '🧪', 'Mix the exact target colour.', [
    'A target colour appears.',
    'Mix it with the hue, brightness and saturation sliders.',
    'Lock in before time runs out.',
    'Closest match wins each round.',
  ], ['drag'], 2, 16, 80),
  g('fair-slice', 'Fair Slice', '🍕', 'Cut it exactly in half.', [
    'A weird shape appears.',
    'Swipe one straight line to cut it into two equal halves.',
    'Closer to 50/50 scores more.',
    'Five shapes.',
  ], ['swipe', 'draw'], 2, 16, 70),
  g('shape-master', 'Shape Master', '⭕', 'Draw the perfect circle, square and more.', [
    'Draw the requested shape freehand.',
    'Circles, squares, triangles, straight lines and stars.',
    'Shapes are scored for precision.',
    'Five shapes.',
  ], ['draw'], 2, 16, 70),
  g('angle-ace', 'Angle Ace', '📐', 'Estimate angles, lengths and centres.', [
    'Set the needle to a target angle, find the middle, double a length...',
    'No rulers allowed!',
    'Closest estimates score most.',
    'Eight challenges.',
  ], ['drag', 'tap'], 2, 16, 80),
];
