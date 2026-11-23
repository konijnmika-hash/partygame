export interface ActivityType {
  id: string;
  name: string;
  emoji: string;
  /** Metabolic equivalent */
  met: number;
}

export const ACTIVITIES: ActivityType[] = [
  { id: 'wandelen', name: 'Wandelen', emoji: '🚶', met: 3.5 },
  { id: 'hardlopen', name: 'Hardlopen', emoji: '🏃', met: 9.8 },
  { id: 'fietsen', name: 'Fietsen', emoji: '🚴', met: 7.5 },
  { id: 'krachttraining', name: 'Krachttraining', emoji: '🏋️', met: 5 },
  { id: 'hiit', name: 'HIIT / bootcamp', emoji: '⚡', met: 8 },
  { id: 'spinning', name: 'Spinning', emoji: '🚲', met: 8.5 },
  { id: 'zwemmen', name: 'Zwemmen', emoji: '🏊', met: 7 },
  { id: 'voetbal', name: 'Voetbal', emoji: '⚽', met: 7 },
  { id: 'padel', name: 'Padel', emoji: '🎾', met: 6 },
  { id: 'tennis', name: 'Tennis', emoji: '🎾', met: 7.3 },
  { id: 'dansen', name: 'Dansen', emoji: '💃', met: 5 },
  { id: 'yoga', name: 'Yoga', emoji: '🧘', met: 2.5 },
  { id: 'boksen', name: 'Boksen', emoji: '🥊', met: 7.8 },
  { id: 'roeien', name: 'Roeien', emoji: '🚣', met: 7 },
];
