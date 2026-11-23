import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Food } from '../data/foods';
import { dateKey } from './date';
import type { ActivityEntry, DayLog, FoodEntry, MealKey, Profile, WeightEntry } from './types';

export const emptyDay = (): DayLog => ({
  meals: { ontbijt: [], lunch: [], diner: [], snacks: [] },
  waterMl: 0,
  steps: 0,
  activities: [],
  workoutsDone: [],
});

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface State {
  profile: Profile | null;
  days: Record<string, DayLog>;
  weights: WeightEntry[];
  recent: Food[];
  favorites: string[];
  customFoods: Food[];
  /** laatst gebruikte gewicht per oefening */
  lifts: Record<string, number>;
  premium: boolean;
  glassMl: number;
  addBurned: boolean;
  stepsSource: 'handmatig' | 'health';

  setProfile: (p: Profile) => void;
  updateProfile: (p: Partial<Profile>) => void;
  addFood: (date: string, meal: MealKey, food: Food, grams: number, label: string) => void;
  updateEntry: (date: string, meal: MealKey, id: string, grams: number, label: string) => void;
  removeEntry: (date: string, meal: MealKey, id: string) => void;
  copyMeal: (from: string, to: string, meal: MealKey) => void;
  setWater: (date: string, ml: number) => void;
  setSteps: (date: string, steps: number) => void;
  addActivity: (date: string, a: Omit<ActivityEntry, 'id'>) => void;
  removeActivity: (date: string, id: string) => void;
  completeWorkout: (date: string, workoutId: string, a: Omit<ActivityEntry, 'id'>, lifts: Record<string, number>) => void;
  logWeight: (date: string, kg: number) => void;
  toggleFavorite: (id: string) => void;
  addCustomFood: (f: Food) => void;
  setPremium: (v: boolean) => void;
  setSettings: (s: Partial<Pick<State, 'glassMl' | 'addBurned' | 'stepsSource'>>) => void;
  reset: () => void;
}

const initial = {
  profile: null,
  days: {},
  weights: [],
  recent: [],
  favorites: [],
  customFoods: [],
  lifts: {},
  premium: false,
  glassMl: 250,
  addBurned: true,
  stepsSource: 'handmatig' as const,
};

export const useStore = create<State>()(
  persist(
    (set) => {
      const updateDay = (date: string, fn: (d: DayLog) => DayLog) =>
        set((s) => ({ days: { ...s.days, [date]: fn(s.days[date] ?? emptyDay()) } }));

      return {
        ...initial,

        setProfile: (profile) =>
          set((s) => ({
            profile,
            weights: s.weights.length ? s.weights : [{ date: dateKey(), kg: profile.weightKg }],
          })),
        updateProfile: (p) => set((s) => (s.profile ? { profile: { ...s.profile, ...p } } : {})),

        addFood: (date, meal, food, grams, label) => {
          const entry: FoodEntry = { id: uid(), food, grams, label };
          updateDay(date, (d) => ({ ...d, meals: { ...d.meals, [meal]: [...d.meals[meal], entry] } }));
          set((s) => ({ recent: [food, ...s.recent.filter((r) => r.id !== food.id)].slice(0, 30) }));
        },
        updateEntry: (date, meal, id, grams, label) =>
          updateDay(date, (d) => ({
            ...d,
            meals: { ...d.meals, [meal]: d.meals[meal].map((e) => (e.id === id ? { ...e, grams, label } : e)) },
          })),
        removeEntry: (date, meal, id) =>
          updateDay(date, (d) => ({ ...d, meals: { ...d.meals, [meal]: d.meals[meal].filter((e) => e.id !== id) } })),
        copyMeal: (from, to, meal) =>
          set((s) => {
            const src = s.days[from]?.meals[meal] ?? [];
            const d = s.days[to] ?? emptyDay();
            const copies = src.map((e) => ({ ...e, id: uid() }));
            return { days: { ...s.days, [to]: { ...d, meals: { ...d.meals, [meal]: [...d.meals[meal], ...copies] } } } };
          }),

        setWater: (date, ml) => updateDay(date, (d) => ({ ...d, waterMl: Math.max(0, Math.min(8000, ml)) })),
        setSteps: (date, steps) => updateDay(date, (d) => ({ ...d, steps: Math.max(0, Math.round(steps)) })),

        addActivity: (date, a) => updateDay(date, (d) => ({ ...d, activities: [...d.activities, { ...a, id: uid() }] })),
        removeActivity: (date, id) =>
          updateDay(date, (d) => {
            const removed = d.activities.find((a) => a.id === id);
            return {
              ...d,
              activities: d.activities.filter((a) => a.id !== id),
              workoutsDone: removed?.workout ? d.workoutsDone.filter((w) => w !== removed.workout) : d.workoutsDone,
            };
          }),
        completeWorkout: (date, workoutId, a, lifts) => {
          updateDay(date, (d) => ({
            ...d,
            activities: [...d.activities, { ...a, id: uid(), workout: workoutId }],
            workoutsDone: [...new Set([...d.workoutsDone, workoutId])],
          }));
          set((s) => ({ lifts: { ...s.lifts, ...lifts } }));
        },

        logWeight: (date, kg) =>
          set((s) => {
            const weights = [...s.weights.filter((w) => w.date !== date), { date, kg }].sort((a, b) =>
              a.date.localeCompare(b.date),
            );
            const latest = weights[weights.length - 1];
            return { weights, profile: s.profile ? { ...s.profile, weightKg: latest.kg } : s.profile };
          }),

        toggleFavorite: (id) =>
          set((s) => ({
            favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
          })),
        addCustomFood: (f) => set((s) => ({ customFoods: [f, ...s.customFoods] })),
        setPremium: (premium) => set({ premium }),
        setSettings: (st) => set(st),
        reset: () => set({ ...initial }),
      };
    },
    { name: 'fris-v1' },
  ),
);

export const newId = uid;
