import { create } from 'zustand';
import { dateKey } from './date';
import type { MealKey } from './types';

export type Tab = 'vandaag' | 'training' | 'voortgang' | 'profiel';

export type SheetState =
  | { type: 'addFood'; meal: MealKey }
  | { type: 'editEntry'; meal: MealKey; entryId: string }
  | { type: 'steps' }
  | { type: 'activity' }
  | { type: 'weight' }
  | { type: 'quick' }
  | { type: 'premium'; reason?: string }
  | { type: 'planEdit' }
  | { type: 'profileEdit' }
  | { type: 'goals' }
  | { type: 'connect' }
  | { type: 'exercise'; id: string; slotKey?: string }
  | { type: 'inbox' };

interface UI {
  tab: Tab;
  date: string;
  sheet: SheetState | null;
  /** id van de trainingsdag die nu loopt */
  session: string | null;
  setTab: (t: Tab) => void;
  setDate: (d: string) => void;
  open: (s: SheetState) => void;
  close: () => void;
  startSession: (id: string | null) => void;
}

export const useUI = create<UI>((set) => ({
  tab: 'vandaag',
  date: dateKey(),
  sheet: null,
  session: null,
  setTab: (tab) => {
    set({ tab });
    window.scrollTo({ top: 0 });
  },
  setDate: (date) => set({ date }),
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
  startSession: (session) => set({ session, sheet: null }),
}));

export const mealForNow = (h = new Date().getHours()): MealKey =>
  h < 11 ? 'ontbijt' : h < 15 ? 'lunch' : h >= 17 && h < 21 ? 'diner' : 'snacks';
