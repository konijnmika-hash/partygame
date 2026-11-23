import { cat } from './helpers';
const g = cat('arcade', true);
const A = { realtime: 'arena' } as const;

export const ARCADE = [
  g('paint-war', 'Paint Wars', '🖌️', 'Paint the most floor with your colour.', [
    'Your Bloop leaves a trail of your colour.',
    'Paint as much of the floor as you can.',
    'Paint over rivals to steal their turf.',
    'Most coverage at the buzzer wins.',
  ], ['joystick', 'keys'], 2, 8, 50, A),
  g('neon-trails', 'Neon Trails', '🏍️', 'Leave a light trail. Do not crash.', [
    'You leave a solid neon wall behind you.',
    'Turn left and right to avoid every wall.',
    'Trap your rivals!',
    'Last rider alive wins each round. Three rounds.',
  ], ['swipe', 'keys', 'tap'], 2, 8, 90, A),
  g('hungry-blobs', 'Hungry Blobs', '🍩', 'Eat pellets. Grow. Gobble smaller Bloops.', [
    'Eat pellets to grow bigger.',
    'Bigger Bloops can swallow smaller ones!',
    'Bigger also means slower. Eaten? You respawn small.',
    'Biggest mass at the end wins.',
  ], ['joystick', 'keys'], 2, 12, 75, A),
  g('zombie-tag', 'Zombie Tag', '🧟', 'One zombie. It spreads.', [
    'One Bloop starts as a zombie.',
    'Zombies tag humans to infect them.',
    'Humans score for every second survived; zombies score per infection.',
    'Last human standing wins big.',
  ], ['joystick', 'keys'], 3, 12, 75, A),
  g('snowball-fight', 'Snowball Fight', '❄️', 'Grab snow. Aim. Splat!', [
    'Pick up snowballs from snow piles.',
    'Aim with movement and press THROW.',
    'Each hit scores and freezes the target briefly.',
    'Most hits wins.',
  ], ['joystick', 'keys'], 2, 12, 70, A),
  g('sheep-herder', 'Sheep Herder', '🐑', 'Herd the sheep into your pen.', [
    'Sheep run away from nearby Bloops.',
    'Herd them into YOUR coloured pen.',
    'Sheep in your pen at the end count.',
    'Steal sheep from rival pens!',
  ], ['joystick', 'keys'], 2, 4, 75, A),
  g('space-blaster', 'Space Blaster', '🚀', 'Blast asteroids. Drift through space.', [
    'Thrust with the joystick; your ship auto-fires forward.',
    'Big asteroids split into smaller ones.',
    'Crashing into an asteroid stuns you.',
    'Most points from asteroids wins.',
  ], ['joystick', 'keys'], 2, 8, 70, A),
  g('paddle-royale', 'Paddle Royale', '🏓', 'Defend your goal. Last paddle wins.', [
    'Each player defends one side of the arena with a paddle.',
    'Balls bounce everywhere — block them!',
    'Every ball that passes you costs a life.',
    'Last paddle standing wins.',
  ], ['joystick', 'keys', 'drag'], 2, 6, 90, A),
  g('blend-in', 'Blend In', '🫥', 'Hide among the crowd. Find the real players.', [
    'You look exactly like the wandering crowd of Bloops.',
    'Collect gems... but move like a crowd Bloop or you will be spotted!',
    'Tap STRIKE near a Bloop you think is a player.',
    'Hit a player to score; hit a crowd Bloop and you are stunned.',
  ], ['joystick', 'keys'], 2, 8, 90, A),
  g('road-hopper', 'Road Hopper', '🐥', 'Hop across traffic to the other side.', [
    'Hop forward across busy roads and rivers.',
    'Ride logs over the water; avoid the cars.',
    'Get hit and you restart the crossing.',
    'Most crossings in time wins.',
  ], ['swipe', 'keys', 'tap'], 2, 16, 70, { realtime: 'ghost' }),
  g('hover-hop', 'Hover Hop', '🐝', 'Tap to flap through the gaps.', [
    'Tap to flap upward; gravity pulls you down.',
    'Fly through the gaps between the pillars.',
    'Bonk a pillar and you are dazed for a moment, then try that gap again.',
    'Most gaps cleared in 60 seconds wins.',
  ], ['tap', 'keys'], 2, 16, 60, { realtime: 'ghost', orientation: 'landscape' }),
  g('gravity-flip', 'Gravity Flip', '🙃', 'Tap to flip gravity. Dodge the spikes.', [
    'You run automatically.',
    'Tap to flip between the floor and the ceiling.',
    'Avoid the spikes on both sides: touching them freezes you for a second.',
    'Farthest run in 60 seconds wins.',
  ], ['tap', 'keys'], 2, 16, 60, { realtime: 'ghost', orientation: 'landscape' }),
  g('crown-chase', 'Crown Chase', '👑', 'Grab the crown. Keep it away.', [
    'Grab the crown and hold on to it.',
    'You score every second you wear it.',
    'Dash into the crown holder to steal it.',
    'Most crown time wins.',
  ], ['joystick', 'keys'], 2, 12, 60, A),
];
