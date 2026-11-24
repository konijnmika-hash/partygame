import { FOODS, type Food } from '../data/foods';
import { RECIPES, type Recipe } from '../data/recipes';
import { MEAL_SPLIT, mealRange, type Nutrients } from './calc';
import { addDays } from './date';
import { MEALS, type DayLog, type MealKey, type Targets } from './types';

const FOOD_BY_NAME = new Map(FOODS.map((f) => [f.name, f]));

/** "Ei (rauw)" -> "Ei": zonder bereidingswijze, voor lijstjes. */
export const plainName = (name: string) => name.replace(/ \((gekookt|gebakken|uitgelekt|bereid|rauw|diepvries|blik)\)/, '');

export interface ResolvedIng {
  food: Food;
  grams: number;
}

export function ingredients(r: Recipe) {
  const items: ResolvedIng[] = [];
  const extras: string[] = [];
  for (const i of r.ing) {
    if (typeof i === 'string') extras.push(i);
    else {
      const food = FOOD_BY_NAME.get(i[0]);
      if (!food) throw new Error(`Onbekend ingrediënt in ${r.id}: ${i[0]}`);
      items.push({ food, grams: i[1] });
    }
  }
  return { items, extras };
}

const cache = new Map<string, Nutrients & { grams: number }>();

/** Voedingswaarden van één standaardportie. */
export function recipeNutrients(r: Recipe) {
  let n = cache.get(r.id);
  if (!n) {
    n = { kcal: 0, p: 0, c: 0, f: 0, grams: 0 };
    for (const { food, grams } of ingredients(r).items) {
      const k = grams / 100;
      n.kcal += food.kcal * k;
      n.p += food.p * k;
      n.c += food.c * k;
      n.f += food.f * k;
      n.grams += grams;
    }
    cache.set(r.id, n);
  }
  return n;
}

export const scaleN = (n: Nutrients, factor: number): Nutrients => ({ kcal: n.kcal * factor, p: n.p * factor, c: n.c * factor, f: n.f * factor });

const MEAT = /kip|ham|rookvlees|salami|gehakt|biefstuk|varken|shoarma|bacon|worst|frikandel|kroket|nugget|zalm|tonijn|kabeljauw|pangasius|garnaal|haring|kibbeling|americain/i;

export type RecipeTag = 'vega' | 'eiwitrijk' | 'snel' | 'mealprep' | 'budget' | 'zoet' | 'comfort';

export const TAG_LABEL: Record<RecipeTag, string> = {
  vega: 'Vega',
  eiwitrijk: 'Eiwitrijk',
  snel: 'Snel',
  mealprep: 'Meal prep',
  budget: 'Budget',
  zoet: 'Zoet',
  comfort: 'Comfortfood',
};

export function recipeTags(r: Recipe): RecipeTag[] {
  const n = recipeNutrients(r);
  const tags: RecipeTag[] = [];
  if (!ingredients(r).items.some((i) => i.food.cat === 'vlees' || MEAT.test(i.food.name))) tags.push('vega');
  if (n.p >= 25 || (n.p >= 12 && (n.p * 4) / n.kcal >= 0.3)) tags.push('eiwitrijk');
  if (r.minutes <= 15) tags.push('snel');
  return [...tags, ...(r.tags ?? [])];
}

/* ---------- Porties en hoeveelheden ---------- */

const FRACTION: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

export function fraction(n: number) {
  const q = Math.round(n * 4) / 4;
  const whole = Math.floor(q);
  const rest = q - whole;
  if (!rest) return String(whole);
  return (whole ? String(whole) : '') + FRACTION[rest];
}

const COUNTABLE = /^(stuk|snee|plak|eetlepel|theelepel|teentje|handje|bakje|glas|blik|bolletje|schep|stengel|struik|moot|filet|partje|schijf|kopje|bol)$/;

/** "2 snee · 70 g" of "150 g" */
export function amountLabel(food: Food, grams: number) {
  const g = grams < 5 ? Math.round(grams * 2) / 2 : Math.round(grams);
  const unit = food.unit === 'ml' ? 'ml' : 'g';
  const base = `${String(g).replace('.', ',')} ${unit}`;
  for (const p of food.portions) {
    if (!COUNTABLE.test(p.label)) continue;
    const n = grams / p.g;
    if (n >= 0.25 && n <= 8 && Math.abs(n * 4 - Math.round(n * 4)) < 0.12) {
      const q = Math.round(n * 4) / 4;
      const label = q > 1 && p.label === 'snee' ? 'sneetjes' : q > 1 && p.label === 'stuk' ? 'stuks' : q > 1 && p.label === 'handje' ? 'handjes' : q > 1 && p.label.endsWith('lepel') ? p.label + 's' : p.label;
      return { amount: `${fraction(q)} ${label}`, grams: base };
    }
  }
  return { amount: base, grams: '' };
}

export const PORTION_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** De portie (0,5× tot 2×) waarmee een recept het dichtst bij je doel voor die maaltijd komt. */
export function portionFor(r: Recipe, targetKcal: number) {
  const kcal = recipeNutrients(r).kcal;
  const max = r.meal === 'snacks' ? 1.5 : 2;
  let best = 1;
  for (const f of PORTION_STEPS) {
    if (f > max) continue;
    if (Math.abs(kcal * f - targetKcal) < Math.abs(kcal * best - targetKcal)) best = f;
  }
  return best;
}

export const portionText = (f: number) => `${fraction(f)} ${f > 1 ? 'porties' : 'portie'}`;

/** Gemiddeld doel voor een maaltijd. */
export const mealTarget = (meal: MealKey, kcal: number) => {
  const [lo, hi] = mealRange(meal, kcal);
  return (lo + hi) / 2;
};

const mid = (m: MealKey) => (MEAL_SPLIT[m][0] + MEAL_SPLIT[m][1]) / 2;

/**
 * Hoeveel kcal en eiwit er nog over is voor deze maaltijd: wat je vandaag nog over hebt, verdeeld
 * over de maaltijden die nog leeg zijn. Zo past een voorstel ook als je ontbijt groter was.
 */
export function roomFor(meal: MealKey, t: Targets, day: DayLog | undefined, eaten: Nutrients) {
  const base = mealTarget(meal, t.kcal);
  if (!day || eaten.kcal === 0) return { kcal: base, p: t.p * mid(meal) * 1.15, adjusted: false };
  const open = MEALS.filter((m) => m === meal || day.meals[m].length === 0);
  const share = mid(meal) / open.reduce((s, m) => s + mid(m), 0);
  const leftK = Math.max(0, t.kcal - eaten.kcal);
  const leftP = Math.max(0, t.p - eaten.p);
  const hi = mealRange(meal, t.kcal)[1];
  const kcal = Math.max(base * 0.45, Math.min(hi * 1.1, leftK * share));
  return { kcal, p: leftP * share, adjusted: Math.abs(kcal - base) > 60 };
}

/* ---------- Voorstellen ---------- */

export interface Prefs {
  vega: boolean;
}

export interface Suggestion {
  recipe: Recipe;
  factor: number;
  n: Nutrients;
  score: number;
  why: string;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Recepten die je recent gelogd hebt, zodat de coach afwisselt. */
export function recentlyEaten(days: Record<string, DayLog>, date: string, back = 3) {
  const ids = new Set<string>();
  for (let i = 0; i <= back; i++) {
    const d = days[addDays(date, -i)];
    if (!d) continue;
    for (const m of MEALS) for (const e of d.meals[m]) if (e.food.id.startsWith('recipe-')) ids.add(e.food.id.slice(7));
  }
  return ids;
}

export function suggest(
  meal: MealKey,
  room: { kcal: number; p: number },
  opts: { prefs: Prefs; favorites?: string[]; recent?: Set<string>; seed?: string; pool?: Recipe[] },
): Suggestion[] {
  const pool = (opts.pool ?? RECIPES).filter((r) => r.meal === meal && (!opts.prefs.vega || recipeTags(r).includes('vega')));
  return pool
    .map((recipe) => {
      const factor = portionFor(recipe, room.kcal);
      const n = scaleN(recipeNutrients(recipe), factor);
      const kcalFit = 1 - Math.min(1, Math.abs(n.kcal - room.kcal) / room.kcal);
      const pFit = room.p > 0 ? Math.min(1, n.p / room.p) : 0.5;
      let score = kcalFit * 50 + pFit * 35;
      if (opts.favorites?.includes(recipe.id)) score += 8;
      if (opts.recent?.has(recipe.id)) score -= 20;
      score += hash(recipe.id + (opts.seed ?? '')) * 14;
      const why =
        room.p > 0 && n.p >= room.p * 0.8
          ? `${Math.round(n.p)} g eiwit: precies wat je nog nodig hebt`
          : kcalFit > 0.9
            ? `Past precies in je ${Math.round(room.kcal / 10) * 10} kcal`
            : `${Math.round(n.kcal)} kcal · ${Math.round(n.p)} g eiwit`;
      return { recipe, factor, n, score, why };
    })
    .sort((a, b) => b.score - a.score);
}

export interface DayMenu {
  items: Record<MealKey, Suggestion>;
  total: Nutrients;
}

/** Een dagmenu (één recept per maaltijd) dat zo dicht mogelijk bij je calorie- en eiwitdoel komt. */
export function dayMenu(t: Targets, prefs: Prefs, seed: string, favorites: string[] = []): DayMenu | null {
  const cands = MEALS.map((m) => suggest(m, { kcal: mealTarget(m, t.kcal), p: t.p * mid(m) }, { prefs, favorites, seed }).slice(0, 5));
  if (cands.some((c) => c.length === 0)) return null;
  let best: { cost: number; pick: Suggestion[] } | null = null;
  const pick: Suggestion[] = [];
  const walk = (i: number) => {
    if (i === MEALS.length) {
      const tot = pick.reduce((s, x) => ({ kcal: s.kcal + x.n.kcal, p: s.p + x.n.p }), { kcal: 0, p: 0 });
      const cost = Math.abs(tot.kcal - t.kcal) / t.kcal + (Math.max(0, t.p - tot.p) / t.p) * 1.5 + (Math.max(0, tot.p - t.p * 1.25) / t.p) * 0.6 - pick.reduce((s, x) => s + x.score, 0) / 4000;
      if (!best || cost < best.cost) best = { cost, pick: [...pick] };
      return;
    }
    for (const c of cands[i]) {
      pick.push(c);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  const chosen = (best as { cost: number; pick: Suggestion[] } | null)?.pick;
  if (!chosen) return null;
  const items = Object.fromEntries(MEALS.map((m, i) => [m, chosen[i]])) as Record<MealKey, Suggestion>;
  const total = chosen.reduce((s, x) => ({ kcal: s.kcal + x.n.kcal, p: s.p + x.n.p, c: s.c + x.n.c, f: s.f + x.n.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  return { items, total };
}

/* ---------- Loggen ---------- */

/** Een recept als één product in je dagboek, met waarden per 100 g. */
export function recipeFood(r: Recipe): Food {
  const n = recipeNutrients(r);
  const per = 100 / n.grams;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    id: 'recipe-' + r.id,
    name: r.name,
    cat: 'recept',
    kcal: Math.round(n.kcal * per),
    p: round1(n.p * per),
    c: round1(n.c * per),
    f: round1(n.f * per),
    unit: 'g',
    portions: [{ label: 'portie', g: Math.round(n.grams) }],
    source: 'recipe',
  };
}

export const RECIPE_FOODS = RECIPES.map(recipeFood);

/* ---------- Boodschappen ---------- */

export interface ShopItem {
  /** unieke sleutel van deze regel */
  key: string;
  /** product-id (of x-... voor kruiden) */
  id: string;
  name: string;
  /** gram of ml; ontbreekt bij kruiden en extra's */
  grams?: number;
  unit?: 'g' | 'ml';
  done: boolean;
  /** voor welke recepten */
  from: string[];
}

export function mergeShopping(list: ShopItem[], r: Recipe, factor: number): ShopItem[] {
  const out = list.map((i) => ({ ...i, from: [...i.from] }));
  const { items, extras } = ingredients(r);
  const add = (id: string, name: string, grams?: number, unit?: 'g' | 'ml') => {
    const existing = out.find((i) => i.id === id && !i.done);
    if (existing) {
      if (grams !== undefined) existing.grams = (existing.grams ?? 0) + grams;
      if (!existing.from.includes(r.name)) existing.from.push(r.name);
    } else out.push({ key: `${id}:${Math.random().toString(36).slice(2, 8)}`, id, name, grams, unit, done: false, from: [r.name] });
  };
  for (const { food, grams } of items) add(food.id, plainName(food.name), grams * factor, food.unit);
  for (const e of extras) add('x-' + e.toLowerCase(), e[0].toUpperCase() + e.slice(1));
  return out;
}
