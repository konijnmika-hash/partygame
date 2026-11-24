import type { ActivityLevel, FoodEntry, MealKey, Pace, Profile, Targets } from './types';

export const ACTIVITY: Record<ActivityLevel, { factor: number; label: string; hint: string; steps: number }> = {
  zittend: { factor: 1.2, label: 'Vooral zittend', hint: 'Kantoorbaan, weinig lopen', steps: 7000 },
  licht: { factor: 1.375, label: 'Licht actief', hint: 'Af en toe wandelen of fietsen', steps: 8000 },
  gemiddeld: { factor: 1.55, label: 'Gemiddeld actief', hint: 'Veel op de been of 3× per week sporten', steps: 9000 },
  actief: { factor: 1.725, label: 'Erg actief', hint: 'Fysiek werk of bijna dagelijks sporten', steps: 10000 },
  zeer: { factor: 1.9, label: 'Topsport', hint: 'Zwaar fysiek werk én dagelijks trainen', steps: 12000 },
};

/** Dagelijks verschil in kcal t.o.v. onderhoud. 1 kg lichaamsvet ≈ 7700 kcal. */
export const PACE: Record<Pace, { kgPerWeek: number; label: string }> = {
  rustig: { kgPerWeek: 0.25, label: 'Rustig' },
  normaal: { kgPerWeek: 0.5, label: 'Normaal' },
  snel: { kgPerWeek: 0.75, label: 'Snel' },
};

const round = (n: number, to: number) => Math.round(n / to) * to;

/** Basaal metabolisme volgens Mifflin-St Jeor. */
export function bmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  const sexOffset = p.sex === 'man' ? 5 : p.sex === 'vrouw' ? -161 : -78;
  return base + sexOffset;
}

export const bmi = (weightKg: number, heightCm: number) => weightKg / (heightCm / 100) ** 2;

/**
 * Geschat vetpercentage uit de zelfinschatting (1-10). Meer spieren bij hetzelfde "dikte-gevoel"
 * betekent iets minder vet. Dit is een ruwe schatting, geen meting.
 */
export function bodyFat(p: Pick<Profile, 'sex' | 'fat' | 'muscle'>) {
  const [lo, step] = p.sex === 'man' ? [7, 3.4] : p.sex === 'vrouw' ? [15, 3.6] : [11, 3.5];
  const bf = lo + (p.fat - 1) * step - (p.muscle - 5) * 0.6;
  return Math.max(p.sex === 'vrouw' ? 12 : 5, Math.min(55, bf));
}

/** Vetvrije massa in kg. */
export const leanMass = (p: Pick<Profile, 'sex' | 'fat' | 'muscle' | 'weightKg'>) => p.weightKg * (1 - bodyFat(p) / 100);

export function calcTargets(p: Profile): Targets {
  // Gemiddelde van Mifflin-St Jeor (lengte/gewicht/leeftijd) en Katch-McArdle (vetvrije massa),
  // met een kleine correctie voor spiermassa: spieren verbruiken meer energie in rust.
  const lbm = leanMass(p);
  const katch = (370 + 21.6 * lbm) * (1 + (p.muscle - 5) * 0.01);
  const b = (bmr(p) + katch) / 2;
  const tdee = b * ACTIVITY[p.activity].factor;
  const daily = (PACE[p.pace].kgPerWeek * 7700) / 7;
  let kcal = tdee + (p.goal === 'afvallen' ? -daily : p.goal === 'aankomen' ? daily * 0.6 : 0);
  const floor = p.sex === 'man' ? 1500 : 1200;
  kcal = Math.max(kcal, floor);
  kcal = round(p.custom?.kcal ?? kcal, 10);

  // Eiwit op basis van vetvrije massa: bij afvallen extra om spieren te behouden
  let perLbm = p.goal === 'afvallen' ? 2.5 : p.goal === 'aankomen' ? 2.3 : 2.0;
  if (p.focus === 'spiermassa' || p.focus === 'kracht') perLbm = Math.max(perLbm, 2.3);
  const protein = Math.round(Math.min(lbm * perLbm, p.weightKg * 2.4));
  const fat = Math.round((kcal * 0.28) / 9);
  const carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4));

  const water = Math.min(4000, Math.max(1500, round(p.weightKg * 35, 250)));
  let steps = ACTIVITY[p.activity].steps + (p.goal === 'afvallen' ? 1000 : 0);
  steps = Math.min(steps, 12000);

  return {
    kcal,
    p: protein,
    c: carbs,
    f: fat,
    waterMl: p.custom?.waterMl ?? water,
    steps: p.custom?.steps ?? steps,
    bmr: Math.round(b),
    tdee: Math.round(tdee),
  };
}

/** Extra water op trainingsdagen. */
export const TRAINING_WATER_BONUS = 500;

export const MEAL_SPLIT: Record<MealKey, [number, number]> = {
  ontbijt: [0.2, 0.3],
  lunch: [0.25, 0.35],
  diner: [0.3, 0.4],
  snacks: [0.05, 0.15],
};

export const mealRange = (meal: MealKey, kcal: number) =>
  MEAL_SPLIT[meal].map((f) => round(kcal * f, 50)) as [number, number];

export interface Nutrients {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export const entryNutrients = (e: FoodEntry): Nutrients => {
  const k = e.grams / 100;
  return { kcal: e.food.kcal * k, p: e.food.p * k, c: e.food.c * k, f: e.food.f * k };
};

export const sumNutrients = (entries: FoodEntry[]): Nutrients =>
  entries.reduce(
    (acc, e) => {
      const n = entryNutrients(e);
      return { kcal: acc.kcal + n.kcal, p: acc.p + n.p, c: acc.c + n.c, f: acc.f + n.f };
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

/** kcal verbrand bij een activiteit: MET × kg × uur */
export const metKcal = (met: number, kg: number, minutes: number) => Math.round(met * kg * (minutes / 60));

/** Gemiddelde staplengte in meters (≈ 0,415 × lengte). */
export const stepsToKm = (steps: number, heightCm = 175) => (steps * heightCm * 0.415) / 100 / 1000;
