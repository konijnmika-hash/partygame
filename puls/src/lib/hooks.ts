import { useMemo } from 'react';
import { calcTargets, sumNutrients, TRAINING_WATER_BONUS } from './calc';
import { weekday } from './date';
import { emptyDay, useStore } from './store';
import { MEALS, type DayLog, type MealKey } from './types';
import { roomFor } from './recipes';
import { buildPlan } from './workout';

const EMPTY = emptyDay();

export function useDay(date: string): DayLog {
  return useStore((s) => s.days[date]) ?? EMPTY;
}

export function useTargets() {
  const profile = useStore((s) => s.profile);
  return useMemo(() => (profile ? calcTargets(profile) : null), [profile]);
}

export function usePlan() {
  const profile = useStore((s) => s.profile);
  return useMemo(
    () => (profile ? buildPlan(profile) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.trainDays.join(), profile?.focus, profile?.experience, profile?.place, profile?.equipment?.join(), profile?.excluded?.join(), JSON.stringify(profile?.swaps)],
  );
}

export function dayTotals(day: DayLog) {
  const all = MEALS.flatMap((m) => day.meals[m]);
  const eaten = sumNutrients(all);
  const burned = day.activities.reduce((s, a) => s + a.kcal, 0);
  return { eaten, burned, count: all.length };
}

export function useWaterTarget(date: string) {
  const t = useTargets();
  const profile = useStore((s) => s.profile);
  if (!t || !profile) return 2000;
  const trains = profile.trainDays.includes(weekday(date));
  return t.waterMl + (trains && !profile.custom?.waterMl ? TRAINING_WATER_BONUS : 0);
}

/** Hoeveel ruimte (kcal en eiwit) er nog is voor een maaltijd op een dag. */
export function useMealRoom(meal: MealKey, date: string) {
  const t = useTargets();
  const day = useStore((s) => s.days[date]);
  return useMemo(() => (t ? roomFor(meal, t, day, day ? dayTotals(day).eaten : { kcal: 0, p: 0, c: 0, f: 0 }) : null), [t, day, meal]);
}
