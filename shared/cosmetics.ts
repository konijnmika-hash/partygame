// Cosmetic catalog: everything is earned through play (levels + achievements). No purchases.

export type CosmeticKind = 'color' | 'eyes' | 'mouth' | 'hat' | 'acc' | 'title';

export type Unlock = { type: 'default' } | { type: 'level'; level: number } | { type: 'achievement'; id: string };

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  unlock: Unlock;
  /** colors: css color or gradient stops */
  value?: string;
  gradient?: string[];
}

const D: Unlock = { type: 'default' };
const L = (level: number): Unlock => ({ type: 'level', level });
const A = (id: string): Unlock => ({ type: 'achievement', id });

export const COSMETICS: Cosmetic[] = [
  // colors
  { id: 'c-bubblegum', kind: 'color', name: 'Bubblegum', unlock: D, value: '#FF5FA2' },
  { id: 'c-sky', kind: 'color', name: 'Sky', unlock: D, value: '#4DB8FF' },
  { id: 'c-lime', kind: 'color', name: 'Lime', unlock: D, value: '#7ED957' },
  { id: 'c-sunny', kind: 'color', name: 'Sunny', unlock: D, value: '#FFD23F' },
  { id: 'c-tangerine', kind: 'color', name: 'Tangerine', unlock: D, value: '#FF9F40' },
  { id: 'c-grape', kind: 'color', name: 'Grape', unlock: D, value: '#9B6BFF' },
  { id: 'c-mint', kind: 'color', name: 'Mint', unlock: L(2), value: '#3EE6B8' },
  { id: 'c-coral', kind: 'color', name: 'Coral', unlock: L(3), value: '#FF7A6B' },
  { id: 'c-ocean', kind: 'color', name: 'Ocean', unlock: L(5), value: '#2F7BFF' },
  { id: 'c-lilac', kind: 'color', name: 'Lilac', unlock: L(7), value: '#D49BFF' },
  { id: 'c-cherry', kind: 'color', name: 'Cherry', unlock: L(9), value: '#FF3B5C' },
  { id: 'c-forest', kind: 'color', name: 'Forest', unlock: L(11), value: '#2FBF71' },
  { id: 'c-peach', kind: 'color', name: 'Peach', unlock: L(13), value: '#FFB38A' },
  { id: 'c-midnight', kind: 'color', name: 'Midnight', unlock: L(16), value: '#5050D0' },
  { id: 'c-snow', kind: 'color', name: 'Snow', unlock: L(20), value: '#EEF1FF' },
  { id: 'c-charcoal', kind: 'color', name: 'Charcoal', unlock: L(24), value: '#55566A' },
  { id: 'c-gold', kind: 'color', name: 'Gold', unlock: L(30), value: '#FFC531', gradient: ['#FFE27A', '#FFB300'] },
  { id: 'c-galaxy', kind: 'color', name: 'Galaxy', unlock: L(50), value: '#5B3BD6', gradient: ['#2B1B7A', '#8A4DFF', '#FF5FD2'] },
  { id: 'c-rainbow', kind: 'color', name: 'Rainbow', unlock: A('explorer-50'), value: '#FF5FA2', gradient: ['#FF5F6D', '#FFC371', '#7ED957', '#4DB8FF', '#9B6BFF'] },
  { id: 'c-lava', kind: 'color', name: 'Lava', unlock: A('wins-100'), value: '#FF5A1F', gradient: ['#FFD000', '#FF5A1F', '#C9184A'] },
  { id: 'c-ice', kind: 'color', name: 'Glacier', unlock: A('perfect'), value: '#9BE7FF', gradient: ['#E0FBFF', '#7CD4FF'] },
  // eyes
  { id: 'e-round', kind: 'eyes', name: 'Round', unlock: D },
  { id: 'e-happy', kind: 'eyes', name: 'Happy', unlock: D },
  { id: 'e-wink', kind: 'eyes', name: 'Wink', unlock: D },
  { id: 'e-sleepy', kind: 'eyes', name: 'Sleepy', unlock: L(4) },
  { id: 'e-angry', kind: 'eyes', name: 'Grumpy', unlock: L(6) },
  { id: 'e-star', kind: 'eyes', name: 'Starry', unlock: L(8) },
  { id: 'e-dizzy', kind: 'eyes', name: 'Dizzy', unlock: L(10) },
  { id: 'e-shades', kind: 'eyes', name: 'Shades', unlock: L(12) },
  { id: 'e-cyclops', kind: 'eyes', name: 'Cyclops', unlock: L(15) },
  { id: 'e-sparkle', kind: 'eyes', name: 'Sparkle', unlock: L(18) },
  { id: 'e-robot', kind: 'eyes', name: 'Robot', unlock: L(22) },
  { id: 'e-heart', kind: 'eyes', name: 'Heart Eyes', unlock: A('friend-1') },
  // mouths
  { id: 'm-smile', kind: 'mouth', name: 'Smile', unlock: D },
  { id: 'm-grin', kind: 'mouth', name: 'Grin', unlock: D },
  { id: 'm-open', kind: 'mouth', name: 'Yay', unlock: D },
  { id: 'm-tongue', kind: 'mouth', name: 'Silly', unlock: L(3) },
  { id: 'm-o', kind: 'mouth', name: 'Ooh', unlock: L(5) },
  { id: 'm-fang', kind: 'mouth', name: 'Fang', unlock: L(7) },
  { id: 'm-cat', kind: 'mouth', name: 'Kitty', unlock: L(9) },
  { id: 'm-teeth', kind: 'mouth', name: 'Toothy', unlock: L(11) },
  { id: 'm-zigzag', kind: 'mouth', name: 'Nervous', unlock: L(14) },
  { id: 'm-mustache', kind: 'mouth', name: 'Mustache', unlock: L(17) },
  { id: 'm-smirk', kind: 'mouth', name: 'Smirk', unlock: L(20) },
  { id: 'm-kiss', kind: 'mouth', name: 'Smooch', unlock: A('session-win') },
  // hats
  { id: 'h-none', kind: 'hat', name: 'No Hat', unlock: D },
  { id: 'h-party', kind: 'hat', name: 'Party Hat', unlock: D },
  { id: 'h-beanie', kind: 'hat', name: 'Beanie', unlock: D },
  { id: 'h-propeller', kind: 'hat', name: 'Propeller', unlock: L(2) },
  { id: 'h-cap', kind: 'hat', name: 'Cap', unlock: L(3) },
  { id: 'h-flower', kind: 'hat', name: 'Flower', unlock: L(4) },
  { id: 'h-sprout', kind: 'hat', name: 'Sprout', unlock: L(6) },
  { id: 'h-bunny', kind: 'hat', name: 'Bunny Ears', unlock: L(8) },
  { id: 'h-cat', kind: 'hat', name: 'Cat Ears', unlock: L(10) },
  { id: 'h-chef', kind: 'hat', name: 'Chef', unlock: L(12) },
  { id: 'h-cowboy', kind: 'hat', name: 'Cowboy', unlock: L(14) },
  { id: 'h-tophat', kind: 'hat', name: 'Top Hat', unlock: L(16) },
  { id: 'h-pirate', kind: 'hat', name: 'Pirate', unlock: L(18) },
  { id: 'h-wizard', kind: 'hat', name: 'Wizard', unlock: L(20) },
  { id: 'h-viking', kind: 'hat', name: 'Viking', unlock: L(25) },
  { id: 'h-headphones', kind: 'hat', name: 'Headphones', unlock: L(28) },
  { id: 'h-unicorn', kind: 'hat', name: 'Unicorn', unlock: L(35) },
  { id: 'h-astro', kind: 'hat', name: 'Astronaut', unlock: L(40) },
  { id: 'h-cone', kind: 'hat', name: 'Traffic Cone', unlock: A('rounds-100') },
  { id: 'h-halo', kind: 'hat', name: 'Halo', unlock: A('perfect') },
  { id: 'h-crown', kind: 'hat', name: 'Crown', unlock: A('session-wins-10') },
  // accessories
  { id: 'a-none', kind: 'acc', name: 'Nothing', unlock: D },
  { id: 'a-blush', kind: 'acc', name: 'Blush', unlock: D },
  { id: 'a-bowtie', kind: 'acc', name: 'Bow Tie', unlock: L(2) },
  { id: 'a-glasses', kind: 'acc', name: 'Glasses', unlock: L(5) },
  { id: 'a-scarf', kind: 'acc', name: 'Scarf', unlock: L(7) },
  { id: 'a-monocle', kind: 'acc', name: 'Monocle', unlock: L(9) },
  { id: 'a-bandana', kind: 'acc', name: 'Bandana', unlock: L(13) },
  { id: 'a-necklace', kind: 'acc', name: 'Pearls', unlock: L(15) },
  { id: 'a-mask', kind: 'acc', name: 'Hero Mask', unlock: L(19) },
  { id: 'a-tie', kind: 'acc', name: 'Necktie', unlock: L(23) },
  { id: 'a-wings', kind: 'acc', name: 'Wings', unlock: L(45) },
  { id: 'a-badge', kind: 'acc', name: 'Star Badge', unlock: A('first-win') },
  { id: 'a-medal', kind: 'acc', name: 'Gold Medal', unlock: A('session-win') },
  // titles
  { id: 't-rookie', kind: 'title', name: 'Rookie', unlock: D },
  { id: 't-partygoer', kind: 'title', name: 'Party Goer', unlock: L(2) },
  { id: 't-bloopster', kind: 'title', name: 'Bloopster', unlock: L(5) },
  { id: 't-chaos', kind: 'title', name: 'Chaos Agent', unlock: L(10) },
  { id: 't-veteran', kind: 'title', name: 'Veteran', unlock: L(20) },
  { id: 't-legend', kind: 'title', name: 'Living Legend', unlock: L(40) },
  { id: 't-mythic', kind: 'title', name: 'Mythic Bloop', unlock: L(75) },
  { id: 't-champion', kind: 'title', name: 'Champion', unlock: A('session-win') },
  { id: 't-dynasty', kind: 'title', name: 'Dynasty', unlock: A('session-wins-10') },
  { id: 't-perfectionist', kind: 'title', name: 'Perfectionist', unlock: A('perfect') },
  { id: 't-speedy', kind: 'title', name: 'Lightning Fingers', unlock: A('quick-reflex') },
  { id: 't-artist', kind: 'title', name: 'Doodle Master', unlock: A('artist') },
  { id: 't-brain', kind: 'title', name: 'Brainiac', unlock: A('brainiac') },
  { id: 't-social', kind: 'title', name: 'Social Star', unlock: A('social-star') },
  { id: 't-teamplayer', kind: 'title', name: 'Team Player', unlock: A('team-player') },
  { id: 't-explorer', kind: 'title', name: 'Explorer', unlock: A('explorer-50') },
  { id: 't-completionist', kind: 'title', name: 'Completionist', unlock: A('explorer-all') },
  { id: 't-host', kind: 'title', name: 'Host with the Most', unlock: A('host-5') },
  { id: 't-survivor', kind: 'title', name: 'Survivor', unlock: A('survivor') },
  { id: 't-comeback', kind: 'title', name: 'Comeback Kid', unlock: A('comeback') },
  { id: 't-butterfly', kind: 'title', name: 'Social Butterfly', unlock: A('friend-1') },
  { id: 't-marathon', kind: 'title', name: 'Marathoner', unlock: A('marathon') },
  { id: 't-official', kind: 'title', name: 'Official Bloop', unlock: A('register') },
  { id: 't-onfire', kind: 'title', name: 'On Fire', unlock: A('streak-5') },
];

export const COSMETIC_MAP: Record<string, Cosmetic> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

export const DEFAULT_AVATAR = { color: 'c-bubblegum', eyes: 'e-round', mouth: 'm-smile', hat: 'h-party', acc: 'a-blush' };

export function defaultUnlocks(): string[] {
  return COSMETICS.filter((c) => c.unlock.type === 'default').map((c) => c.id);
}

export function unlocksForLevel(level: number): string[] {
  return COSMETICS.filter((c) => c.unlock.type === 'level' && c.unlock.level <= level).map((c) => c.id);
}

export function unlocksForAchievement(id: string): string[] {
  return COSMETICS.filter((c) => c.unlock.type === 'achievement' && c.unlock.id === id).map((c) => c.id);
}

export function colorValue(id: string): string {
  return COSMETIC_MAP[id]?.value || '#FF5FA2';
}

export function unlockLabel(u: Unlock, achievementName?: (id: string) => string): string {
  if (u.type === 'default') return 'Starter';
  if (u.type === 'level') return `Reach level ${u.level}`;
  return `Achievement: ${achievementName ? achievementName(u.id) : u.id}`;
}
