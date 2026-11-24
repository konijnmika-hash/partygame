import { describe, expect, it } from 'vitest';
import { FOODS, searchFoods } from '../src/data/foods';
import { ALL_EQUIP, EXERCISES } from '../src/data/exercises';
import { bmr, bodyFat, calcTargets, entryNutrients, mealRange } from '../src/lib/calc';
import { coachFeed } from '../src/lib/coach';
import { emptyDay } from '../src/lib/store';
import { addDays, weekday } from '../src/lib/date';
import { fromOff } from '../src/lib/openfoodfacts';
import type { Profile } from '../src/lib/types';
import { buildPlan, workoutKcal } from '../src/lib/workout';

const base: Profile = {
  name: 'Test', sex: 'man', age: 30, heightCm: 180, weightKg: 80, goalWeightKg: 75, activity: 'gemiddeld', goal: 'afvallen',
  pace: 'normaal', trainDays: [0, 2, 4], focus: 'spiermassa', experience: 'gemiddeld', place: 'gym', createdAt: '',
  equipment: [...ALL_EQUIP], excluded: [], swaps: {}, fat: 5, muscle: 5,
};

describe('calories', () => {
  it('uses Mifflin-St Jeor', () => {
    expect(bmr(base)).toBe(10 * 80 + 6.25 * 180 - 5 * 30 + 5); // 1780
    expect(bmr({ ...base, sex: 'vrouw' })).toBe(1780 - 166);
  });
  it('blends Mifflin-St Jeor with lean mass and applies a 0.5 kg/week deficit', () => {
    const t = calcTargets(base);
    const lbm = 80 * (1 - bodyFat(base) / 100);
    const b = (1780 + 370 + 21.6 * lbm) / 2;
    expect(t.bmr).toBe(Math.round(b));
    expect(t.kcal).toBe(Math.round((b * 1.55 - 550) / 10) * 10);
  });
  it('uses the fat and muscle scales', () => {
    expect(bodyFat({ sex: 'man', fat: 1, muscle: 5 })).toBe(7);
    expect(bodyFat({ sex: 'man', fat: 10, muscle: 5 })).toBeCloseTo(37.6);
    expect(bodyFat({ sex: 'vrouw', fat: 5, muscle: 5 })).toBeGreaterThan(bodyFat({ sex: 'man', fat: 5, muscle: 5 }));
    // meer spieren = meer verbranding en meer eiwit
    const lean = calcTargets({ ...base, fat: 3, muscle: 9 });
    const soft = calcTargets({ ...base, fat: 8, muscle: 2 });
    expect(lean.bmr).toBeGreaterThan(soft.bmr);
    expect(lean.p).toBeGreaterThan(soft.p);
  });
  it('macros add up to the calorie target', () => {
    const t = calcTargets(base);
    expect(Math.abs(t.p * 4 + t.c * 4 + t.f * 9 - t.kcal)).toBeLessThan(15);
    expect(t.p).toBeGreaterThan(130);
    expect(t.p).toBeLessThan(80 * 2.4);
  });
  it('never goes below a safe floor', () => {
    const t = calcTargets({ ...base, sex: 'vrouw', weightKg: 45, heightCm: 150, age: 60, activity: 'zittend', pace: 'snel' });
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
  });
  it('respects custom targets', () => {
    const t = calcTargets({ ...base, custom: { kcal: 2222, steps: 15000 } });
    expect(t.kcal).toBe(2220);
    expect(t.steps).toBe(15000);
  });
  it('splits meals sensibly', () => {
    expect(mealRange('ontbijt', 2000)).toEqual([400, 600]);
  });
});

describe('food database', () => {
  it('has many foods with unique ids and consistent energy', () => {
    expect(FOODS.length).toBeGreaterThan(200);
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    for (const f of FOODS) {
      const est = f.p * 4 + f.c * 4 + f.f * 9;
      // Alcohol en vezels geven wat afwijking; grote fouten vangen we wel
      if (!/bier|wijn/i.test(f.name)) expect(Math.abs(est - f.kcal), f.name).toBeLessThan(Math.max(25, f.kcal * 0.2));
    }
  });
  it('finds foods forgivingly', () => {
    expect(searchFoods('kip', FOODS)[0].name).toMatch(/^Kip/);
    expect(searchFoods('huttenkase', FOODS)[0].name).toBe('Hüttenkäse');
  });
  it('calculates portion nutrients', () => {
    const oats = FOODS.find((f) => f.name === 'Havermout')!;
    expect(entryNutrients({ id: 'x', food: oats, grams: 40, label: '' }).kcal).toBeCloseTo(148);
  });
  it('parses Open Food Facts products', () => {
    const f = fromOff({ code: '1', product_name: 'Skyr', brands: 'Arla, Foo', nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: '0.2' }, serving_quantity: 150, quantity: '450 g' });
    expect(f).toMatchObject({ name: 'Skyr', brand: 'Arla', kcal: 63, p: 11, f: 0.2 });
    expect(f!.portions.map((p) => p.g)).toEqual([150, 450]);
    expect(fromOff({ product_name: 'Zonder waarden' })).toBeNull();
    expect(fromOff({ product_name: 'kJ only', nutriments: { energy_100g: 418.4 } })!.kcal).toBe(100);
  });
});

describe('workout plans', () => {
  it('makes one workout per chosen day without duplicates', () => {
    for (let n = 1; n <= 7; n++) {
      const days = Array.from({ length: n }, (_, i) => i);
      const plan = buildPlan({ ...base, trainDays: days });
      expect(plan).toHaveLength(n);
      expect(plan.map((p) => p.weekday)).toEqual(days);
      for (const d of plan) {
        expect(d.exercises.length).toBeGreaterThanOrEqual(4);
        expect(new Set(d.exercises.map((e) => e.exercise.id)).size).toBe(d.exercises.length);
      }
    }
  });
  it('uses full body for 1-2 days and muscle groups from 3 days', () => {
    expect(buildPlan({ ...base, trainDays: [0, 3] }).map((d) => d.id)).toEqual(['fullbody-a', 'fullbody-b']);
    expect(buildPlan(base).map((d) => d.id)).toEqual(['push', 'pull', 'legs']);
    expect(buildPlan({ ...base, trainDays: [0, 1, 3, 4] }).map((d) => d.id)).toEqual(['borst-triceps', 'rug-biceps', 'legs', 'schouders-armen']);
    expect(buildPlan({ ...base, trainDays: [0, 1, 2, 3, 4] }).map((d) => d.id)).toEqual(['borst', 'rug', 'legs', 'schouders', 'armen']);
  });
  it('only picks exercises you have equipment for', () => {
    const home = buildPlan({ ...base, place: 'thuis', equipment: [] });
    for (const d of home) for (const e of d.exercises) expect(e.exercise.equip, e.exercise.id).toEqual([]);
    const noBarbell = buildPlan({ ...base, equipment: ALL_EQUIP.filter((q) => q !== 'stang') });
    for (const d of noBarbell) for (const e of d.exercises) expect(e.exercise.equip).not.toContain('stang');
  });
  it('matches difficulty to experience', () => {
    const newbie = buildPlan({ ...base, experience: 'nieuw' });
    for (const d of newbie) {
      expect(d.exercises.length).toBeLessThanOrEqual(4);
      for (const e of d.exercises) expect(e.exercise.diff, e.exercise.id).toBe(1);
    }
    const pro = buildPlan({ ...base, experience: 'ervaren' });
    expect(pro[0].exercises[0].exercise.id).toBe('bench');
    expect(pro[0].exercises[0].sets).toBe(4);
  });
  it('respects excluded exercises and swaps', () => {
    const ex = buildPlan({ ...base, experience: 'ervaren', excluded: ['bench'] });
    expect(ex.flatMap((d) => d.exercises.map((e) => e.exercise.id))).not.toContain('bench');
    const first = buildPlan({ ...base, experience: 'ervaren' })[0].exercises[0];
    const alt = first.alternatives[0].id;
    const swapped = buildPlan({ ...base, experience: 'ervaren', swaps: { [first.slotKey]: alt } })[0].exercises[0];
    expect(swapped.exercise.id).toBe(alt);
  });
  it('has steps and an animation for every exercise', () => {
    for (const e of Object.values(EXERCISES)) {
      expect(e.steps.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.anim.a.anchor).toBe(e.anim.b.anchor);
    }
  });
  it('adapts reps to the goal', () => {
    const strength = buildPlan({ ...base, focus: 'kracht' })[0];
    expect(strength.exercises[0].reps).toBe('5');
    const fatloss = buildPlan({ ...base, focus: 'afvallen' })[0];
    expect(fatloss.cardio?.minutes).toBe(15);
    expect(workoutKcal(fatloss, 80)).toBeGreaterThan(150);
  });
});

describe('coach', () => {
  const t = calcTargets(base);
  const ctx = (o: object) => ({ profile: base, t, day: emptyDay(), days: {}, date: '2026-11-24', today: '2026-11-24', hour: 9, waterTarget: 3000, weights: [], ...o });
  it('plans the morning and nudges when behind', () => {
    expect(coachFeed(ctx({ hour: 8 })).some((m) => m.id === 'plan')).toBe(true);
    const evening = coachFeed(ctx({ hour: 18 }));
    expect(evening[0].tone).toBe('nudge');
    expect(evening.some((m) => m.id === 'water')).toBe(true);
  });
  it('does not add burned calories to what you can eat', () => {
    const oats = FOODS.find((f) => f.name === 'Havermout')!;
    const grams = ((t.kcal * 1.15) / oats.kcal) * 100;
    const day = { ...emptyDay(), activities: [{ id: 'a', name: 'Hardlopen', emoji: '🏃', minutes: 60, kcal: 800 }], meals: { ...emptyDay().meals, ontbijt: [{ id: 'e', food: oats, grams, label: '' }] } };
    expect(coachFeed(ctx({ hour: 20, day })).some((m) => m.id === 'kcal-over')).toBe(true);
  });
  it('cheers when goals are reached', () => {
    const day = { ...emptyDay(), waterMl: 3200, steps: 12000 };
    const feed = coachFeed(ctx({ hour: 20, day }));
    expect(feed.some((m) => m.id === 'water-done')).toBe(true);
    expect(feed.some((m) => m.id === 'steps-done')).toBe(true);
  });
});

describe('dates', () => {
  it('handles weekdays and month boundaries', () => {
    expect(weekday('2026-11-23')).toBe(0); // maandag
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});
