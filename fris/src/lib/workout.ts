import { EXERCISES, type Exercise } from '../data/exercises';
import type { Focus, Level, Place, Profile } from './types';

export interface PlannedExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSec: number;
}

export interface WorkoutDay {
  /** stabiele id, bijv. "push" */
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  weekday: number;
  exercises: PlannedExercise[];
  cardio?: { label: string; minutes: number };
  estMinutes: number;
}

type Slot = [gym: string, home: string | null];

interface Template {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  slots: Slot[];
}

const T: Record<string, Template> = {
  fbA: {
    id: 'fullbody-a', name: 'Full body A', subtitle: 'Hele lichaam', emoji: '⚡',
    slots: [['squat', 'gobletsquat'], ['bench', 'pushup'], ['row', 'tablerow'], ['rdl', 'glutebridge'], ['lateral', 'pikepushup'], ['plank', 'plank']],
  },
  fbB: {
    id: 'fullbody-b', name: 'Full body B', subtitle: 'Hele lichaam', emoji: '🔥',
    slots: [['deadlift', 'slrdl'], ['ohp', 'pikepushup'], ['pulldown', 'tablerow'], ['lunge', 'bwlunge'], ['curl', 'backpackcurl'], ['deadbug', 'deadbug']],
  },
  fbC: {
    id: 'fullbody-c', name: 'Full body C', subtitle: 'Hele lichaam', emoji: '🌿',
    slots: [['legpress', 'bwsquat'], ['inclinedb', 'declinepushup'], ['dbrow', 'superman'], ['hipthrust', 'glutebridge'], ['pushdown', 'chairdip'], ['sideplank', 'sideplank']],
  },
  push: {
    id: 'push', name: 'Push', subtitle: 'Borst · schouders · triceps', emoji: '💪',
    slots: [['bench', 'pushup'], ['inclinedb', 'declinepushup'], ['ohp', 'pikepushup'], ['lateral', 'lateral'], ['pushdown', 'chairdip'], ['ohtriceps', 'ohtriceps']],
  },
  pull: {
    id: 'pull', name: 'Pull', subtitle: 'Rug · biceps', emoji: '🧗',
    slots: [['pulldown', 'tablerow'], ['row', 'dbrow'], ['cablerow', 'superman'], ['facepull', null], ['curl', 'backpackcurl'], ['hammer', null]],
  },
  legs: {
    id: 'legs', name: 'Benen', subtitle: 'Benen · billen · core', emoji: '🦵',
    slots: [['squat', 'gobletsquat'], ['rdl', 'slrdl'], ['bulgarian', 'chairsplit'], ['legcurl', 'glutebridge'], ['calf', 'singlecalf'], ['hangingknee', 'plank']],
  },
  pushB: {
    id: 'push-b', name: 'Push B', subtitle: 'Schouders · borst · triceps', emoji: '💥',
    slots: [['ohp', 'pikepushup'], ['inclinedb', 'pushup'], ['bench', 'declinepushup'], ['lateral', 'lateral'], ['ohtriceps', 'chairdip'], ['cablecrunch', 'deadbug']],
  },
  pullB: {
    id: 'pull-b', name: 'Pull B', subtitle: 'Rug · biceps', emoji: '🪢',
    slots: [['pullup', 'tablerow'], ['cablerow', 'dbrow'], ['dbrow', 'superman'], ['facepull', null], ['hammer', 'backpackcurl'], ['curl', null]],
  },
  legsB: {
    id: 'legs-b', name: 'Benen B', subtitle: 'Billen · hamstrings', emoji: '🍑',
    slots: [['deadlift', 'glutebridge'], ['legpress', 'chairsplit'], ['hipthrust', 'slrdl'], ['legext', 'wallsit'], ['calf', 'singlecalf'], ['plank', 'mountain']],
  },
  upperA: {
    id: 'upper-a', name: 'Bovenlichaam A', subtitle: 'Borst · rug · armen', emoji: '💪',
    slots: [['bench', 'pushup'], ['row', 'tablerow'], ['ohp', 'pikepushup'], ['pulldown', 'dbrow'], ['curl', 'backpackcurl'], ['pushdown', 'chairdip']],
  },
  upperB: {
    id: 'upper-b', name: 'Bovenlichaam B', subtitle: 'Schouders · rug · armen', emoji: '🧗',
    slots: [['inclinedb', 'declinepushup'], ['cablerow', 'tablerow'], ['lateral', 'lateral'], ['pullup', 'superman'], ['hammer', 'backpackcurl'], ['ohtriceps', 'chairdip']],
  },
  lowerA: {
    id: 'lower-a', name: 'Onderlichaam A', subtitle: 'Benen · core', emoji: '🦵',
    slots: [['squat', 'gobletsquat'], ['rdl', 'slrdl'], ['lunge', 'bwlunge'], ['legext', 'wallsit'], ['calf', 'singlecalf'], ['plank', 'plank']],
  },
  lowerB: {
    id: 'lower-b', name: 'Onderlichaam B', subtitle: 'Billen · hamstrings', emoji: '🍑',
    slots: [['deadlift', 'glutebridge'], ['legpress', 'chairsplit'], ['hipthrust', 'bwsquat'], ['legcurl', 'slrdl'], ['calf', 'singlecalf'], ['cablecrunch', 'deadbug']],
  },
  recovery: {
    id: 'herstel', name: 'Actief herstel', subtitle: 'Mobiliteit · core', emoji: '🧘',
    slots: [['deadbug', 'deadbug'], ['sideplank', 'sideplank'], ['glutebridge', 'glutebridge'], ['superman', 'superman']],
  },
};

export function splitFor(days: number, level: Level): Template[] {
  switch (days) {
    case 0:
      return [];
    case 1:
      return [T.fbA];
    case 2:
      return [T.fbA, T.fbB];
    case 3:
      return level === 'beginner' ? [T.fbA, T.fbB, T.fbC] : [T.push, T.pull, T.legs];
    case 4:
      return [T.upperA, T.lowerA, T.upperB, T.lowerB];
    case 5:
      return [T.push, T.pull, T.legs, T.upperB, T.lowerB];
    case 6:
      return [T.push, T.pull, T.legs, T.pushB, T.pullB, T.legsB];
    default:
      return [T.push, T.pull, T.legs, T.pushB, T.pullB, T.legsB, T.recovery];
  }
}

export const SPLIT_NAME = (days: number, level: Level) =>
  days <= 2 || (days === 3 && level === 'beginner')
    ? 'Full body'
    : days === 4
      ? 'Boven / onder'
      : days === 5
        ? 'Push · pull · benen + boven/onder'
        : 'Push · pull · benen';

function scheme(e: Exercise, focus: Focus, level: Level): { sets: number; reps: string; restSec: number } {
  if (e.timed) return { sets: 3, reps: level === 'beginner' ? '20–30 sec' : '30–45 sec', restSec: 45 };
  let s: { sets: number; reps: string; restSec: number };
  switch (focus) {
    case 'kracht':
      s = e.compound ? { sets: 5, reps: '5', restSec: 150 } : { sets: 3, reps: '8–10', restSec: 90 };
      if (!e.weighted) s = { sets: 4, reps: '8–12 langzaam', restSec: 90 };
      break;
    case 'spiermassa':
      s = e.compound ? { sets: 4, reps: '8–10', restSec: 120 } : { sets: 3, reps: '10–12', restSec: 75 };
      break;
    case 'afvallen':
      s = e.compound ? { sets: 3, reps: '12–15', restSec: 60 } : { sets: 3, reps: '15', restSec: 45 };
      break;
    default:
      s = e.compound ? { sets: 3, reps: '10–12', restSec: 75 } : { sets: 3, reps: '12–15', restSec: 60 };
  }
  if (level === 'beginner') s = { ...s, sets: Math.min(s.sets, 3) };
  return s;
}

export function buildPlan(p: Pick<Profile, 'trainDays' | 'focus' | 'level' | 'place'>): WorkoutDay[] {
  const days = [...p.trainDays].sort((a, b) => a - b);
  const templates = splitFor(days.length, p.level);
  return templates.map((t, i) => buildDay(t, days[i], p.focus, p.level, p.place));
}

function buildDay(t: Template, weekday: number, focus: Focus, level: Level, place: Place): WorkoutDay {
  const seen = new Set<string>();
  let ids = t.slots
    .map(([gym, home]) => (place === 'gym' ? gym : home))
    .filter((id): id is string => !!id && !seen.has(id) && !!seen.add(id));
  if (level === 'beginner' && ids.length > 5) ids = [...ids.slice(0, 4), ids[ids.length - 1]];

  const exercises = ids.map((id) => {
    const exercise = EXERCISES[id];
    return { exercise, ...scheme(exercise, focus, level) };
  });
  const cardio =
    t.id === 'herstel'
      ? { label: 'Rustige wandeling of fietstocht', minutes: 30 }
      : focus === 'afvallen'
        ? { label: place === 'gym' ? 'Intervallen op fiets of loopband' : 'Intervallen: 30 sec hard, 30 sec rustig', minutes: 15 }
        : focus === 'fit'
          ? { label: 'Cardio naar keuze', minutes: 10 }
          : undefined;
  const work = exercises.reduce((sum, e) => sum + e.sets * (45 + e.restSec), 0) / 60;
  const estMinutes = Math.round((5 + work + (cardio?.minutes ?? 0)) / 5) * 5;
  return { id: t.id, name: t.name, subtitle: t.subtitle, emoji: t.emoji, weekday, exercises, cardio, estMinutes };
}

/** Geschatte verbranding van een training (krachttraining MET 5, cardio MET 8). */
export function workoutKcal(day: WorkoutDay, kg: number, fraction = 1) {
  const cardioMin = day.cardio?.minutes ?? 0;
  const strengthMin = Math.max(0, day.estMinutes - cardioMin);
  return Math.round((5 * kg * (strengthMin / 60) + 8 * kg * (cardioMin / 60)) * fraction);
}
