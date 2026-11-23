// Dictionary (word-list, MIT) for validating word games, plus curated common words for prompts.
import fs from 'node:fs';
import wordListPath from 'word-list';
import { containsProfanity } from '@shared/validation';

let dict: Set<string> | null = null;
let byLen: Map<number, string[]> | null = null;

/** All dictionary words (lowercase a-z, 2..10 letters). Loaded once, lazily. */
export function dictionary(): Set<string> {
  if (dict) return dict;
  const raw = fs.readFileSync(wordListPath, 'utf8');
  const set = new Set<string>();
  const lens = new Map<number, string[]>();
  for (const w of raw.split('\n')) {
    if (w.length < 2 || w.length > 10 || !/^[a-z]+$/.test(w)) continue;
    set.add(w);
    let arr = lens.get(w.length);
    if (!arr) lens.set(w.length, (arr = []));
    arr.push(w);
  }
  // a few everyday words some lists miss
  for (const w of ['ok', 'okay', 'emoji', 'selfie', 'wifi', 'pizza']) set.add(w);
  dict = set;
  byLen = lens;
  return set;
}

export function isWord(w: string): boolean {
  return dictionary().has(w.toLowerCase());
}

export function wordsOfLength(n: number): string[] {
  dictionary();
  return byLen!.get(n) ?? [];
}

function letterCounts(w: string): number[] {
  const c = new Array(26).fill(0);
  for (let i = 0; i < w.length; i++) c[w.charCodeAt(i) - 97]++;
  return c;
}

/** Can `word` be made from the multiset of letters in `letters`? */
export function canMake(word: string, letters: string): boolean {
  const have = letterCounts(letters);
  for (let i = 0; i < word.length; i++) {
    const k = word.charCodeAt(i) - 97;
    if (k < 0 || k > 25 || --have[k] < 0) return false;
  }
  return true;
}

/** Every dictionary word (3+ letters) buildable from the letters. */
export function subWords(letters: string, min = 3): string[] {
  const out: string[] = [];
  for (let n = min; n <= letters.length; n++) for (const w of wordsOfLength(n)) if (canMake(w, letters) && !containsProfanity(w)) out.push(w);
  return out;
}

/** Common, friendly words for scrambles/hangman-style prompts (5-8 letters). */
export const COMMON_WORDS = [
  'apple', 'beach', 'bread', 'brick', 'cloud', 'dance', 'dream', 'eagle', 'earth', 'flame', 'fruit', 'ghost', 'giant', 'grape', 'happy',
  'heart', 'honey', 'horse', 'house', 'jelly', 'juice', 'knife', 'lemon', 'light', 'magic', 'mango', 'money', 'music', 'night', 'ocean',
  'party', 'peach', 'piano', 'pizza', 'plant', 'queen', 'radio', 'river', 'robot', 'salad', 'sheep', 'shark', 'smile', 'snake', 'space',
  'storm', 'sugar', 'sunny', 'table', 'tiger', 'toast', 'train', 'truck', 'water', 'whale', 'world', 'zebra', 'banana', 'basket', 'bottle',
  'bubble', 'butter', 'camera', 'candle', 'carrot', 'castle', 'cookie', 'dragon', 'flower', 'forest', 'garden', 'guitar', 'hammer', 'island',
  'jungle', 'kitten', 'ladder', 'monkey', 'orange', 'parrot', 'pencil', 'pepper', 'pirate', 'planet', 'pocket', 'puzzle', 'rabbit', 'rocket',
  'school', 'shadow', 'silver', 'spider', 'summer', 'sunset', 'turtle', 'wizard', 'window', 'winter', 'balloon', 'blanket', 'chicken',
  'dolphin', 'giraffe', 'library', 'monster', 'octopus', 'penguin', 'popcorn', 'rainbow', 'sandwich', 'treasure', 'unicorn', 'volcano',
  'pancake', 'diamond', 'kitchen', 'mountain', 'dinosaur', 'elephant', 'firework', 'football', 'hospital', 'notebook', 'princess',
  'scissors', 'sunflower', 'umbrella', 'waterfall', 'airplane', 'backpack', 'bathroom', 'birthday', 'cupcake', 'doughnut', 'goldfish',
  'jellyfish', 'lollipop', 'mushroom', 'pumpkin', 'squirrel', 'teacher', 'tornado', 'trumpet', 'vampire', 'blizzard', 'cucumber',
];

/** 7-letter seed words that contain many sub-words (for Anagram Race). */
export const ANAGRAM_SEEDS = [
  'planets', 'strange', 'garden', 'masters', 'painter', 'stream', 'teacher', 'reading', 'parents', 'stained', 'traders', 'heaters',
  'pirates', 'trainer', 'scatter', 'serpent', 'charmed', 'rainbow', 'smarter', 'listen', 'mothers', 'wonders', 'crusted', 'slanted',
  'partner', 'heroics', 'monster', 'salmons', 'roaster', 'parties', 'trouble', 'kindest', 'shatter', 'storage', 'trading', 'reptile',
].filter((w) => w.length === 7);
