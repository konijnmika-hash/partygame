import type { Equip } from '../data/exercises';
import type { Food } from '../data/foods';

export type Sex = 'man' | 'vrouw' | 'anders';
export type ActivityLevel = 'zittend' | 'licht' | 'gemiddeld' | 'actief' | 'zeer';
export type Goal = 'afvallen' | 'onderhouden' | 'aankomen';
export type Pace = 'rustig' | 'normaal' | 'snel';
export type Focus = 'afvallen' | 'spiermassa' | 'kracht' | 'fit';
export type Experience = 'nieuw' | 'beginner' | 'gemiddeld' | 'ervaren';
export type Place = 'gym' | 'thuis';
export type MealKey = 'ontbijt' | 'lunch' | 'diner' | 'snacks';

export const MEALS: MealKey[] = ['ontbijt', 'lunch', 'diner', 'snacks'];

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalWeightKg: number;
  /** gewicht bij de start, voor de voortgang */
  startWeightKg?: number;
  activity: ActivityLevel;
  goal: Goal;
  pace: Pace;
  /** 0 = maandag ... 6 = zondag */
  trainDays: number[];
  focus: Focus;
  experience: Experience;
  place: Place;
  /** apparatuur die je kunt gebruiken */
  equipment: Equip[];
  /** oefeningen die je niet kunt of wilt doen */
  excluded: string[];
  /** zelf gekozen vervangers per plek in het schema */
  swaps: Record<string, string>;
  /** zelfinschatting 1-10: hoeveel vet (1 = heel slank, 10 = veel overgewicht) */
  fat: number;
  /** zelfinschatting 1-10: hoeveel spieren (1 = weinig, 10 = bodybuilder) */
  muscle: number;
  /** Handmatig overschreven doelen (Premium) */
  custom?: { kcal?: number; waterMl?: number; steps?: number };
  createdAt: string;
}

export interface Targets {
  kcal: number;
  p: number;
  c: number;
  f: number;
  waterMl: number;
  steps: number;
  bmr: number;
  tdee: number;
}

export interface FoodEntry {
  id: string;
  food: Food;
  grams: number;
  /** bijv. "2 × snee" of "150 g" */
  label: string;
}

export interface ActivityEntry {
  id: string;
  name: string;
  emoji: string;
  minutes: number;
  kcal: number;
  /** id van de trainingsdag als dit een schema-training was */
  workout?: string;
}

export interface DayLog {
  meals: Record<MealKey, FoodEntry[]>;
  waterMl: number;
  steps: number;
  activities: ActivityEntry[];
  /** id's van afgeronde trainingsdagen (bijv. "push") */
  workoutsDone: string[];
}

export interface WeightEntry {
  date: string;
  kg: number;
}
