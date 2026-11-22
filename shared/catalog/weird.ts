import { cat } from './helpers';
const g = cat('weird');

export const WEIRD = [
  g('voice-guess', 'Weird Voice Guessing', '🎙️', 'Say it in a silly voice. Guess the character.', [
    'You get a secret character and a phrase to say.',
    'Record yourself saying it in that voice — or use the voice synthesizer!',
    'Everyone listens and guesses which character it was.',
    'Score for guessing right and for being recognised.',
  ], ['mic', 'tap'], 3, 10, 200, { mic: 'optional', needsSound: true }),
  g('fake-auction', 'Fake Auction', '🔨', 'Bid on mystery junk. Some of it is treasure.', [
    'Ridiculous items go up for auction one by one.',
    'Some players get secret appraisal tips...',
    'Bid with your 1000 coins — highest bid when the hammer falls wins.',
    'Item values are revealed at the end. Richest Bloop wins.',
  ], ['tap'], 2, 12, 160),
  g('ridiculous-ranking', 'Ridiculous Ranking', '📊', 'Rank absurd things. Match the group.', [
    'Rank four items by a ridiculous criteria.',
    'Drag them into order.',
    "Score by how close your ranking is to the group's average.",
    'Five rankings.',
  ], ['drag'], 3, 16, 130),
  g('guess-sound', 'Guess the Sound', '🎵', 'Name the tune from a weird instrument.', [
    'A famous tune plays note by note on a weird instrument.',
    'Tap the title as soon as you recognise it.',
    'Earlier correct guesses score more.',
    'Turn your sound on!',
  ], ['tap'], 2, 16, 120, { needsSound: true }),
  g('weird-quiz', 'Weird Quiz', '🦑', 'Strange-but-true questions. Wager your confidence.', [
    'Bizarre questions with real answers.',
    'Pick an answer and wager 1-3 confidence chips.',
    'Right answers win your wager; wrong ones lose it.',
    'Eight questions.',
  ], ['tap'], 2, 16, 150),
  g('meme-caption', 'Meme Caption Contest', '😹', 'Caption the scene. Funniest wins.', [
    'A ridiculous scene appears.',
    'Write the funniest caption you can.',
    'Vote for your favourite caption (not your own).',
    'Three scenes.',
  ], ['type', 'vote'], 3, 12, 170),
  g('emoji-story', 'Emoji Story', '📖', 'Tell a story using only emoji.', [
    'You get a secret story title.',
    'Tell it using only emoji (up to six).',
    'Others guess which title each emoji story represents.',
    'Score for correct guesses and for clear storytelling.',
  ], ['tap', 'vote'], 3, 12, 170),
  g('nonsense-sentence', 'Nonsense Sentence', '🗯️', 'Fill the blank with your silliest card.', [
    'A sentence with a blank appears.',
    'Play the funniest word card from your hand.',
    'Everyone votes for the best completion.',
    'Five sentences.',
  ], ['tap', 'vote'], 3, 12, 150),
  g('mystery-object', 'Mystery Object', '🔬', 'Extreme zoom. What is it?', [
    'An object is shown extremely zoomed in.',
    'It slowly zooms out.',
    'Tap the answer as soon as you know.',
    'One guess per object — earlier is better.',
  ], ['tap'], 2, 16, 100),
  g('silly-challenge', 'Silly Challenge', '🤸', 'Rub, mash, freeze and spin.', [
    'A series of silly physical challenges.',
    'Mash, rub the screen, hold perfectly still, spin in circles...',
    'Each challenge is ranked separately.',
    'Six challenges.',
  ], ['tap', 'swipe', 'hold'], 2, 16, 100),
];
