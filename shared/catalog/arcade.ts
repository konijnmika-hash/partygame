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
  ], ['swipe', 'keys', 'tap'], 2, 8, 50, A),
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
  ], ['joystick', 'keys'], 3, 12, 60, A),
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
  g('storm-royale', 'Storm Royale', '🌀', 'Drop in, loot up, build, survive the storm.', [
    'Everyone parachutes onto the island. Loot chests 🧰 to upgrade your blaster: grey, green, blue, purple, gold!',
    'Hold FIRE to shoot where you are moving. Tap BUILD to throw up a wooden wall for cover.',
    'The purple storm shrinks: stay inside the circle or it drains your health.',
    'Last Bloop standing wins. Eliminations score extra.',
  ], ['joystick', 'keys'], 2, 12, 95, A),
  g('knockout-clash', 'Knockout Clash', '🥊', 'Rack up damage %. Launch rivals off the stage.', [
    'Hit rivals to raise their damage %: the higher it is, the further they fly.',
    'HIT to attack, hold up + HIT for an uppercut, run + HIT on the ground for a big smash.',
    'JUMP (twice in the air) to get back to the stage when you are knocked off.',
    'Fly past the screen edge and you lose a stock. Three stocks; last one standing wins.',
  ], ['joystick', 'keys'], 2, 8, 100, { ...A, orientation: 'landscape' }),
  g('pipe-panic', 'Pipe Panic', '🐢', 'Bonk the ledge, flip the critter, kick it away.', [
    'Critters crawl out of the pipes and walk down the ledges.',
    'Jump and bonk the ledge right under a critter to flip it on its back.',
    'Run into a flipped critter to kick it away for points. Upright ones bump you!',
    'Hit the POW block to flip every critter at once. Grab the coins too.',
  ], ['joystick', 'keys'], 1, 8, 80, { ...A, orientation: 'landscape' }),
  g('boom-blocks', 'Boom Blocks', '💣', 'Drop bombs, blast crates, trap your rivals.', [
    'Drop a BOMB: it blasts in a cross after two seconds.',
    'Blow up crates to find power-ups: 💣 more bombs, 🔥 bigger blasts, 👟 faster shoes.',
    'Bombs set each other off. Do not stand in the flames!',
    'Three hearts each. Last Bloop standing wins.',
  ], ['joystick', 'keys'], 2, 8, 110, A),
  g('dot-muncher', 'Dot Muncher', '🟡', 'Munch dots, dodge ghosts, eat them back.', [
    'Steer through the maze and munch the dots.',
    'Ghosts chase you: get caught and you lose points.',
    'Eat a big power pellet and the ghosts turn blue... now YOU can eat them, and other Bloops too!',
    'The maze refills when it is cleared. Most points wins.',
  ], ['joystick', 'keys', 'swipe'], 1, 8, 80, A),
  g('ricochet-tanks', 'Ricochet Tanks', '🛞', 'Bank shots off the walls. Mind your own bullets.', [
    'Drive your toy tank with the stick; a small push turns the turret without driving.',
    'FIRE shots that bounce off walls twice. Shots that collide cancel each other out.',
    'Careful: a bounced shot can hit you too! Drop a MINE to guard a corridor.',
    'Most kills wins. You respawn after every hit.',
  ], ['joystick', 'keys'], 2, 8, 80, A),
];
