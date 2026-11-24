import { EXERCISES, canDo, type Equip, type Exercise } from '../data/exercises';
import type { Experience, Focus, Profile } from './types';

export interface PlannedExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSec: number;
  /** sleutel van de plek in het schema, voor wisselen */
  slotKey: string;
  /** andere oefeningen die op deze plek passen (en die je kunt doen) */
  alternatives: Exercise[];
}

export interface WorkoutDay {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  weekday: number;
  exercises: PlannedExercise[];
  cardio?: { label: string; minutes: number };
  estMinutes: number;
}

interface Template {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  /** per plek: kandidaten van zwaar/technisch naar makkelijk */
  slots: string[][];
}

// Kandidatenlijsten die vaak terugkomen
const C = {
  chest: ['bench', 'dbbench', 'chestpress', 'pushup', 'kneepushup'],
  chest2: ['inclinebench', 'inclinedb', 'declinepushup', 'pushup', 'kneepushup'],
  chest3: ['cablefly', 'dips', 'chestpress', 'declinepushup', 'kneepushup'],
  shoulder: ['ohp', 'dbohp', 'machinepress', 'pikepushup'],
  lateral: ['lateral', 'cablelateral'],
  rearDelt: ['facepull', 'reversefly', 'superman'],
  vpull: ['pullup', 'pulldown', 'tablerow'],
  hpull: ['row', 'cablerow', 'dbrow', 'tablerow', 'bottlerow', 'superman'],
  hpull2: ['dbrow', 'cablerow', 'row', 'bottlerow', 'tablerow', 'superman'],
  bicep: ['barbellcurl', 'curl', 'cablecurl', 'backpackcurl'],
  bicep2: ['hammer', 'cablecurl', 'curl', 'backpackcurl'],
  tricep: ['pushdown', 'ohtriceps', 'chairdip'],
  tricep2: ['skullcrusher', 'ohtriceps', 'dips', 'chairdip'],
  squat: ['squat', 'legpress', 'gobletsquat', 'bwsquat'],
  squat2: ['legpress', 'gobletsquat', 'squat', 'bwsquat'],
  hinge: ['rdl', 'dbrdl', 'hipthrust', 'slrdl', 'glutebridge'],
  hinge2: ['deadlift', 'rdl', 'dbrdl', 'slrdl', 'glutebridge'],
  glute: ['hipthrust', 'glutebridge'],
  single: ['bulgarian', 'lunge', 'chairsplit', 'bwlunge'],
  hams: ['legcurl', 'glutebridge', 'slrdl'],
  quads: ['legext', 'wallsit'],
  calf: ['calf'],
  core: ['hangingknee', 'cablecrunch', 'deadbug', 'crunch', 'plank'],
  core2: ['plank', 'sideplank', 'deadbug'],
  cond: ['mountain', 'burpee'],
};

const T = (id: string, name: string, subtitle: string, emoji: string, slots: string[][]): Template => ({ id, name, subtitle, emoji, slots });

const FB_A = T('fullbody-a', 'Full body A', 'Hele lichaam', '⚡', [C.squat, C.chest, C.hpull, C.hinge, C.shoulder, C.core2, C.bicep]);
const FB_B = T('fullbody-b', 'Full body B', 'Hele lichaam', '🔥', [C.hinge2, C.chest2, C.vpull, C.single, C.lateral, C.core, C.tricep]);
const PUSH = T('push', 'Borst, schouders & triceps', 'Push-dag', '💪', [C.chest, C.chest2, C.shoulder, C.lateral, C.tricep, C.tricep2, C.chest3]);
const PULL = T('pull', 'Rug & biceps', 'Pull-dag', '🧗', [C.vpull, C.hpull, C.hpull2, C.rearDelt, C.bicep, C.bicep2, C.core]);
const LEGS = T('legs', 'Benen & billen', 'Beendag', '🦵', [C.squat, C.hinge, C.single, C.hams, C.quads, C.calf, C.core2]);
const CHEST_TRI = T('borst-triceps', 'Borst & triceps', 'Spiergroepdag', '💪', [C.chest, C.chest2, C.chest3, C.tricep, C.tricep2, ['chairdip', 'kneepushup'], C.core2]);
const BACK_BI = T('rug-biceps', 'Rug & biceps', 'Spiergroepdag', '🧗', [C.vpull, C.hpull, C.hpull2, C.rearDelt, C.bicep, C.bicep2, C.core]);
const SHOULDERS_ARMS = T('schouders-armen', 'Schouders & armen', 'Spiergroepdag', '🏋️', [C.shoulder, C.lateral, C.rearDelt, C.bicep, C.tricep, C.bicep2, C.tricep2]);
const CHEST = T('borst', 'Borst', 'Spiergroepdag', '💪', [C.chest, C.chest2, C.chest3, ['chestpress', 'pushup', 'kneepushup'], ['dips', 'declinepushup', 'pushup'], C.core2]);
const BACK = T('rug', 'Rug', 'Spiergroepdag', '🧗', [C.vpull, C.hpull, C.hpull2, ['pulldown', 'tablerow', 'superman'], C.rearDelt, ['superman', 'reversefly'], C.core2]);
const SHOULDERS = T('schouders', 'Schouders', 'Spiergroepdag', '🏋️', [C.shoulder, C.lateral, C.rearDelt, ['cablelateral', 'lateral'], ['dbohp', 'machinepress', 'pikepushup'], C.cond]);
const ARMS = T('armen', 'Armen & core', 'Spiergroepdag', '💥', [C.bicep, C.tricep2, C.bicep2, C.tricep, ['cablecurl', 'backpackcurl'], C.core]);
const PUSH_B = T('push-b', 'Schouders, borst & triceps', 'Push-dag B', '💥', [C.shoulder, C.chest2, C.chest3, C.lateral, C.tricep2, C.tricep, C.core2]);
const PULL_B = T('pull-b', 'Rug & biceps B', 'Pull-dag B', '🪢', [C.hpull2, C.vpull, C.hpull, C.rearDelt, C.bicep2, C.bicep, C.core]);
const LEGS_B = T('legs-b', 'Billen & hamstrings', 'Beendag B', '🍑', [C.hinge2, C.squat2, C.glute, C.single, C.hams, C.calf, C.cond]);
const RECOVERY = T('herstel', 'Actief herstel', 'Mobiliteit & core', '🧘', [['deadbug'], ['sideplank'], ['glutebridge'], ['superman']]);

/** Welke dagen je krijgt bij hoeveel trainingen per week. */
export function splitFor(days: number): Template[] {
  switch (days) {
    case 0: return [];
    case 1: return [FB_A];
    case 2: return [FB_A, FB_B];
    case 3: return [PUSH, PULL, LEGS];
    case 4: return [CHEST_TRI, BACK_BI, LEGS, SHOULDERS_ARMS];
    case 5: return [CHEST, BACK, LEGS, SHOULDERS, ARMS];
    case 6: return [PUSH, PULL, LEGS, PUSH_B, PULL_B, LEGS_B];
    default: return [PUSH, PULL, LEGS, PUSH_B, PULL_B, LEGS_B, RECOVERY];
  }
}

export const SPLIT_NAME = (days: number) =>
  days <= 2 ? 'Full body' : days === 3 ? 'Push · pull · benen' : days === 4 ? 'Spiergroepen (4 dagen)' : days === 5 ? 'Eén spiergroep per dag' : 'Push · pull · benen 2×';

export const EXPERIENCE: Record<Experience, { t: string; s: string; maxDiff: 1 | 2 | 3; maxEx: number; extraSet: boolean }> = {
  nieuw: { t: 'Nog nooit getraind', s: 'Ik wil het rustig leren', maxDiff: 1, maxEx: 4, extraSet: false },
  beginner: { t: 'Minder dan 1 jaar', s: 'Ik ken de basis', maxDiff: 2, maxEx: 5, extraSet: false },
  gemiddeld: { t: '1 tot 3 jaar', s: 'Ik train regelmatig', maxDiff: 3, maxEx: 6, extraSet: false },
  ervaren: { t: 'Meer dan 3 jaar', s: 'Zware compound lifts zijn geen probleem', maxDiff: 3, maxEx: 7, extraSet: true },
};

function scheme(e: Exercise, focus: Focus, exp: Experience): { sets: number; reps: string; restSec: number } {
  const x = EXPERIENCE[exp];
  if (e.timed) return { sets: 3, reps: exp === 'nieuw' ? '20 sec' : exp === 'beginner' ? '30 sec' : '45 sec', restSec: 45 };
  let s: { sets: number; reps: string; restSec: number };
  switch (focus) {
    case 'kracht':
      s = e.compound ? { sets: 4, reps: '5', restSec: 150 } : { sets: 3, reps: '8–10', restSec: 90 };
      if (!e.weighted) s = { sets: 3, reps: '8–12 langzaam', restSec: 90 };
      break;
    case 'spiermassa':
      s = e.compound ? { sets: 3, reps: '8–10', restSec: 120 } : { sets: 3, reps: '10–12', restSec: 75 };
      break;
    case 'afvallen':
      s = e.compound ? { sets: 3, reps: '12–15', restSec: 60 } : { sets: 3, reps: '15', restSec: 45 };
      break;
    default:
      s = e.compound ? { sets: 3, reps: '10–12', restSec: 75 } : { sets: 3, reps: '12–15', restSec: 60 };
  }
  if (x.extraSet && e.compound) s = { ...s, sets: s.sets + 1 };
  if (exp === 'nieuw') s = { ...s, sets: 2, reps: e.weighted ? '10–12' : s.reps, restSec: Math.max(s.restSec, 75) };
  return s;
}

type PlanInput = Pick<Profile, 'trainDays' | 'focus' | 'experience' | 'place' | 'equipment' | 'excluded' | 'swaps'>;

export function buildPlan(p: PlanInput): WorkoutDay[] {
  const days = [...p.trainDays].sort((a, b) => a - b);
  return splitFor(days.length).map((t, i) => buildDay(t, days[i], p));
}

function buildDay(t: Template, weekday: number, p: PlanInput): WorkoutDay {
  const x = EXPERIENCE[p.experience];
  const equip: Equip[] = p.equipment;
  const ok = (id: string) => {
    const e = EXERCISES[id];
    return !!e && canDo(e, equip) && !p.excluded.includes(id);
  };
  const used = new Set<string>();
  const chosen = new Map<number, { id: string; usable: string[] }>();
  const pick = (allowHarder: boolean) => {
    t.slots.forEach((cands, i) => {
      if (chosen.has(i) || chosen.size >= x.maxEx) return;
      const slotKey = `${t.id}:${i}`;
      const usable = cands.filter((id) => ok(id) && !used.has(id));
      const swap = p.swaps[slotKey];
      const fitting = usable.filter((id) => EXERCISES[id].diff <= x.maxDiff);
      const easiest = [...usable].sort((a, b) => EXERCISES[a].diff - EXERCISES[b].diff)[0];
      const choice = swap && usable.includes(swap) ? swap : fitting[0] ?? (allowHarder ? easiest : undefined);
      if (!choice) return;
      used.add(choice);
      chosen.set(i, { id: choice, usable });
    });
  };
  pick(false);
  // te weinig oefeningen die bij je niveau passen? Vul aan met de makkelijkste die overblijven.
  if (chosen.size < Math.min(4, x.maxEx)) pick(true);
  const picked: PlannedExercise[] = [...chosen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([i, { id, usable }]) => {
      const exercise = EXERCISES[id];
      return { exercise, ...scheme(exercise, p.focus, p.experience), slotKey: `${t.id}:${i}`, alternatives: usable.filter((u) => u !== id).map((u) => EXERCISES[u]) };
    });
  // alternatieven mogen niet al elders op deze dag staan
  for (const pe of picked) pe.alternatives = pe.alternatives.filter((a) => !used.has(a.id));

  const cardio =
    t.id === 'herstel'
      ? { label: 'Rustige wandeling of fietstocht', minutes: 30 }
      : p.focus === 'afvallen'
        ? { label: p.place === 'gym' ? 'Intervallen op fiets of loopband' : 'Intervallen: 30 sec hard, 30 sec rustig', minutes: 15 }
        : p.focus === 'fit'
          ? { label: 'Cardio naar keuze', minutes: 10 }
          : undefined;
  const work = picked.reduce((sum, e) => sum + e.sets * (45 + e.restSec), 0) / 60;
  const estMinutes = Math.round((5 + work + (cardio?.minutes ?? 0)) / 5) * 5;
  return { id: t.id, name: t.name, subtitle: t.subtitle, emoji: t.emoji, weekday, exercises: picked, cardio, estMinutes };
}

export function workoutKcal(day: WorkoutDay, kg: number, fraction = 1) {
  const cardioMin = day.cardio?.minutes ?? 0;
  const strengthMin = Math.max(0, day.estMinutes - cardioMin);
  return Math.round((5 * kg * (strengthMin / 60) + 8 * kg * (cardioMin / 60)) * fraction);
}
