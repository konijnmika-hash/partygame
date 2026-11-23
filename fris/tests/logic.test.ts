import { describe, expect, it } from 'vitest';
import { FOODS, searchFoods } from '../src/data/foods';
import { bmr, calcTargets, entryNutrients, mealRange } from '../src/lib/calc';
import { addDays, weekday } from '../src/lib/date';
import { fromOff } from '../src/lib/openfoodfacts';
import type { Profile } from '../src/lib/types';
import { buildPlan, workoutKcal } from '../src/lib/workout';

const base: Profile = {
  name: 'Test', sex: 'man', age: 30, heightCm: 180, weightKg: 80, goalWeightKg: 75, activity: 'gemiddeld', goal: 'afvallen',
  pace: 'normaal', trainDays: [0, 2, 4], focus: 'spiermassa', level: 'gevorderd', place: 'gym', createdAt: '',
};

describe('calories', () => {
  it('uses Mifflin-St Jeor', () => {
    expect(bmr(base)).toBe(10 * 80 + 6.25 * 180 - 5 * 30 + 5); // 1780
    expect(bmr({ ...base, sex: 'vrouw' })).toBe(1780 - 166);
  });
  it('applies activity and a 0.5 kg/week deficit', () => {
    const t = calcTargets(base);
    expect(t.tdee).toBe(Math.round(1780 * 1.55));
    expect(t.kcal).toBe(Math.round((1780 * 1.55 - 550) / 10) * 10);
  });
  it('macros add up to the calorie target', () => {
    const t = calcTargets(base);
    expect(Math.abs(t.p * 4 + t.c * 4 + t.f * 9 - t.kcal)).toBeLessThan(15);
    expect(t.p).toBe(160); // 2 g/kg while cutting
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
  it('makes one workout per chosen day', () => {
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
  it('uses push/pull/legs for advanced 3-day and full body for beginners', () => {
    expect(buildPlan(base).map((d) => d.id)).toEqual(['push', 'pull', 'legs']);
    expect(buildPlan({ ...base, level: 'beginner' }).map((d) => d.id)).toEqual(['fullbody-a', 'fullbody-b', 'fullbody-c']);
  });
  it('adapts reps to the goal and location', () => {
    const strength = buildPlan({ ...base, focus: 'kracht' })[0];
    expect(strength.exercises[0]).toMatchObject({ sets: 5, reps: '5' });
    const fatloss = buildPlan({ ...base, focus: 'afvallen' })[0];
    expect(fatloss.cardio?.minutes).toBe(15);
    const home = buildPlan({ ...base, place: 'thuis' })[0];
    expect(home.exercises.map((e) => e.exercise.id)).toContain('pushup');
    expect(workoutKcal(fatloss, 80)).toBeGreaterThan(150);
  });
});

describe('dates', () => {
  it('handles weekdays and month boundaries', () => {
    expect(weekday('2026-11-23')).toBe(0); // maandag
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });
});
