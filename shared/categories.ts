import type { CategoryId } from './types';

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  emoji: string;
  color: string;
  gradient: [string, string];
  blurb: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'drawing', name: 'Draw & Guess', emoji: '🎨', color: '#FF5FA2', gradient: ['#FF7EB6', '#FF4F8B'], blurb: 'Scribble, sketch and guess the masterpiece.' },
  { id: 'reaction', name: 'Reaction', emoji: '⚡', color: '#FFB020', gradient: ['#FFD23F', '#FF9F1C'], blurb: 'Blink and you lose. Fastest fingers win.' },
  { id: 'social', name: 'Party & Social', emoji: '🎭', color: '#9B6BFF', gradient: ['#B18CFF', '#7B4DFF'], blurb: 'Bluff, vote, accuse and roast your friends.' },
  { id: 'physics', name: 'Physics Chaos', emoji: '🌀', color: '#2FD3C7', gradient: ['#4BE3D6', '#1FB5C9'], blurb: 'Wobble, stack, bounce and topple.' },
  { id: 'racing', name: 'Racing & Movement', emoji: '🏁', color: '#FF6B4A', gradient: ['#FF8A5B', '#FF4F45'], blurb: 'Run, jump, dodge and race to the finish.' },
  { id: 'memory', name: 'Memory', emoji: '🧠', color: '#4DA3FF', gradient: ['#6CB8FF', '#3A7BFF'], blurb: 'Remember the pattern. Repeat the madness.' },
  { id: 'puzzle', name: 'Puzzle', emoji: '🧩', color: '#5BD15B', gradient: ['#7EE07A', '#36B85A'], blurb: 'Brains over buttons. Solve it first.' },
  { id: 'team', name: 'Team Up', emoji: '🤝', color: '#FF4D6D', gradient: ['#FF6F8A', '#E8365D'], blurb: 'Cooperate with your team, crush the other.' },
  { id: 'weird', name: 'Weird & Funny', emoji: '🤪', color: '#C04DFF', gradient: ['#D774FF', '#A53CF5'], blurb: 'Absurd, silly and gloriously strange.' },
  { id: 'arcade', name: 'Arcade Brawl', emoji: '👾', color: '#3F6BFF', gradient: ['#5B86FF', '#3250E6'], blurb: 'Original real-time arena mayhem.' },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryInfo>;
