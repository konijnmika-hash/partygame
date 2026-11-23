import type { Focus, Goal, Level, Place, Sex } from './types';

export const SEX_OPTIONS: { v: Sex; t: string; em: string }[] = [
  { v: 'vrouw', t: 'Vrouw', em: '👩' },
  { v: 'man', t: 'Man', em: '👨' },
  { v: 'anders', t: 'Anders / zeg ik liever niet', em: '🧑' },
];

export const GOAL_OPTIONS: { v: Goal; t: string; s: string; em: string }[] = [
  { v: 'afvallen', t: 'Afvallen', s: 'Vet verliezen en strakker worden', em: '🔥' },
  { v: 'onderhouden', t: 'Gewicht behouden', s: 'Fit blijven en gezonder eten', em: '⚖️' },
  { v: 'aankomen', t: 'Aankomen', s: 'Spiermassa en gewicht opbouwen', em: '💪' },
];

export const FOCUS_OPTIONS: { v: Focus; t: string; s: string; em: string }[] = [
  { v: 'afvallen', t: 'Vet verbranden', s: 'Hogere herhalingen, korte rust en een cardio-finisher', em: '🔥' },
  { v: 'spiermassa', t: 'Spiermassa', s: '8–12 herhalingen, focus op volume', em: '💪' },
  { v: 'kracht', t: 'Sterker worden', s: 'Zware sets van 5 met lange rust', em: '🏋️' },
  { v: 'fit', t: 'Algemeen fit', s: 'Balans tussen kracht en conditie', em: '🌿' },
];

export const LEVEL_OPTIONS: { v: Level; t: string; s: string }[] = [
  { v: 'beginner', t: 'Beginner', s: 'Minder dan een half jaar ervaring' },
  { v: 'gevorderd', t: 'Gevorderd', s: 'Ik train al een tijd regelmatig' },
];

export const PLACE_OPTIONS: { v: Place; t: string; em: string }[] = [
  { v: 'gym', t: 'In de gym', em: '🏋️' },
  { v: 'thuis', t: 'Thuis', em: '🏠' },
];

export const defaultFocus = (g: Goal): Focus => (g === 'afvallen' ? 'afvallen' : g === 'aankomen' ? 'spiermassa' : 'fit');

/** Spreidt n trainingsdagen netjes over de week (0 = ma). */
export function spreadDays(n: number): number[] {
  const presets: Record<number, number[]> = {
    0: [], 1: [2], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
  };
  return presets[Math.max(0, Math.min(7, n))];
}
