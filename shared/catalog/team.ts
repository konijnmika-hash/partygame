import { cat } from './helpers';
const g = cat('team');
const t = { teams: true } as const;

export const TEAM = [
  g('team-drawing', 'Team Drawing', '🖼️', 'Draw together on one canvas. Win the vote.', [
    'Each team draws the same prompt together on a shared team canvas.',
    'Everyone on the team can draw at the same time.',
    'Then everyone rates the other teams\u2019 drawings from 1 to 5 stars.',
    'Two prompts. Best average rating wins.',
  ], ['draw', 'vote'], 4, 12, 160, t),
  g('team-trivia', 'Team Trivia', '🛎️', 'Buzz in for your team. Steal on a miss.', [
    'A question appears — anyone can buzz in.',
    'The buzzer answers for their team.',
    'Wrong answer? The other team gets a chance to steal.',
    'Most team points after ten questions wins.',
  ], ['tap'], 2, 16, 90, t),
  g('coop-puzzle', 'Cooperative Puzzle', '🧩', 'Assemble the picture as a team.', [
    'Each team gets the same scrambled picture.',
    'Tap two pieces to swap them — teammates can work together.',
    'Pieces in the right spot lock in place.',
    'First team to finish wins.',
  ], ['tap', 'drag'], 2, 12, 75, t),
  g('relay-challenge', 'Relay Challenge', '🏃', 'Pass the baton through quick mini-tasks.', [
    'Teammates take turns completing a quick mini-task.',
    'Finish your leg to pass the baton to the next teammate.',
    'Tasks: mash, math, aim and more.',
    'First team to finish every leg wins.',
  ], ['tap'], 2, 12, 50, t),
  g('shared-maze', 'Shared Maze', '🕹️', 'Each teammate controls a different direction.', [
    'Your team controls ONE Bloop in a maze.',
    'Each teammate only controls some of the directions!',
    'Coordinate to reach the exit.',
    'First team out wins.',
  ], ['tap', 'keys'], 2, 12, 60, t),
  g('team-reaction', 'Team Reaction', '⚡', 'React together, in sync.', [
    'When the signal appears, tap!',
    "If it shows a player's colour, only that player should tap.",
    'Team score = speed + sync bonus when you tap together.',
    'Eight signals.',
  ], ['tap'], 2, 16, 75, t),
  g('team-word', 'Team Word Game', '🗝️', 'Give one-word clues. Teammates guess.', [
    'One teammate sees a secret word and types a one-word clue.',
    'Their teammates type guesses.',
    'Correct guess? Next word! The clue-giver rotates.',
    'Most words guessed in time wins.',
  ], ['type'], 4, 12, 110, t),
  g('two-player-construction', 'Two Player Construction', '🧱', 'One sees the blueprint. The other builds.', [
    'Pairs team up: an Architect and a Builder.',
    'Only the Architect sees the blueprint.',
    'The Architect pings cells and sends quick hints; the Builder places blocks.',
    'Accuracy and speed win.',
  ], ['tap'], 2, 12, 100, t),
  g('team-memory', 'Team Memory', '🧩', 'Each teammate sees part of the pattern.', [
    'A pattern flashes — but each teammate only sees part of it!',
    'Rebuild the full pattern together on your team board.',
    'Accuracy earns points for the whole team.',
    'Patterns grow each level.',
  ], ['tap'], 2, 12, 70, t),
  g('team-survival', 'Team Survival', '🔥', 'Survive together. Revive your friends.', [
    'Monsters roam the arena — touching one knocks you down.',
    'Stand next to a downed teammate to revive them.',
    'Team score is the total time your team survives.',
    'Stick together!',
  ], ['joystick', 'keys'], 2, 12, 75, { realtime: 'arena', teams: true }),
  g('blob-soccer', 'Blob Soccer', '⚽', 'Bump the ball into the goal.', [
    'Two teams, one ball, two goals.',
    'Bump the ball with your body; dash for a power kick.',
    'Most goals in two minutes wins.',
    'Tie? Golden goal!',
  ], ['joystick', 'keys'], 2, 12, 120, { realtime: 'arena', teams: true, original: true }),
  g('tug-of-war', 'Tug of War', '🪢', 'Mash in rhythm to out-pull the other team.', [
    'Tap as fast as you can to pull the rope.',
    'Tapping on the beat gives a power pull!',
    'Pull the rope past your line to win.',
    'Best of three pulls.',
  ], ['tap'], 2, 16, 60, { teams: true, original: true }),
];
