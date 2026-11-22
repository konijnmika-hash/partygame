import { cat } from './helpers';
const g = cat('social');

export const SOCIAL = [
  g('two-truths', 'Two Truths and a Lie', '🤥', 'Spot the lie. Tell a better one.', [
    'Write two true facts and one lie about yourself.',
    "Everyone's statements are revealed in turn.",
    'Vote for which statement is the lie.',
    'Score for spotting lies — and for fooling everyone.',
  ], ['type', 'vote'], 3, 12, 200),
  g('most-likely', 'Who Is Most Likely To?', '👉', 'Point fingers. Match the majority.', [
    'A prompt appears: "Who is most likely to..."',
    'Vote for the player who fits best.',
    'Score if you vote with the majority.',
    'Six prompts of friendly roasting.',
  ], ['vote'], 3, 16, 120),
  g('secret-impostor', 'Secret Impostor', '🎭', 'One of you got a different question.', [
    'Everyone answers a question — but the Impostor got a different one!',
    'Answers are revealed side by side.',
    'Vote for who you think the Impostor is.',
    'The Impostor scores big by blending in.',
  ], ['type', 'vote'], 3, 12, 180),
  g('odd-one-out', 'Odd One Out', '🧦', 'Which one does not belong? Think like the crowd.', [
    'Four things appear. Pick the one that does not belong.',
    "There's no right answer — only the crowd's answer!",
    'Score for every player who picked the same as you.',
    'Eight sets of hot debate.',
  ], ['tap'], 3, 16, 100),
  g('who-said-it', 'Guess Who Said It', '💬', 'Anonymous answers. Guess the author.', [
    'Everyone answers a personal prompt anonymously.',
    'Answers are revealed one at a time.',
    'Guess which player wrote each one.',
    'Score for correct guesses — and for being unreadable.',
  ], ['type', 'tap'], 3, 12, 180),
  g('secret-word', 'Secret Word', '🤫', 'Prove you know the word... without giving it away.', [
    'Everyone sees the secret word except the Spy.',
    'Each player gives a one-word clue related to it.',
    'Vote for the Spy after two rounds of clues.',
    'A caught Spy can still win by guessing the word!',
  ], ['type', 'vote'], 3, 10, 180),
  g('bluff-challenge', 'Bluffing Challenge', '🃏', 'True or false? Believe them... or not.', [
    'Each player secretly sees a wild statement and whether it is TRUE or FALSE.',
    'They present it — and may lie about the truth!',
    'Everyone else votes Believe or Doubt.',
    'Score for reading the truth, and for fooling the table.',
  ], ['tap', 'vote'], 3, 12, 160),
  g('fake-answer', 'Vote the Fake Answer', '🦄', 'Write fake answers. Find the real one.', [
    'A bizarre fact appears with a blank.',
    'Write a fake answer convincing enough to fool everyone.',
    'All answers appear together — pick the REAL one.',
    'Score for finding the truth and for every player your lie fools.',
  ], ['type', 'vote'], 3, 10, 200),
  g('hidden-role', 'Hidden Role: Night Heist', '🌙', 'Thieves among us. Catch them by dawn.', [
    'Secret roles: Thieves, a Detective and Guards.',
    'At night the Thieves pick a victim; the Detective investigates someone.',
    'By day, everyone discusses and votes someone out.',
    'Guards win by catching every Thief; Thieves win by outnumbering the Guards.',
  ], ['vote'], 4, 12, 260),
  g('group-prediction', 'Group Prediction', '🔮', 'How many of us...? Predict the crowd.', [
    'A yes/no question appears: "Have you ever...?"',
    'Answer honestly and secretly.',
    'Then predict how many players said YES.',
    'Exact predictions score big.',
  ], ['tap'], 3, 16, 130),
];
