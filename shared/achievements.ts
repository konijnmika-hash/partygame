// Achievement definitions (display data). Unlock checks run on the server in progression/achievements.ts.

export interface AchievementDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  xp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-round', name: 'First Bloop', emoji: '🐣', description: 'Play your very first round.', xp: 50 },
  { id: 'rounds-10', name: 'Warming Up', emoji: '🔥', description: 'Play 10 rounds.', xp: 75 },
  { id: 'rounds-100', name: 'Party Regular', emoji: '🎉', description: 'Play 100 rounds.', xp: 250 },
  { id: 'rounds-500', name: 'Party Legend', emoji: '🏛️', description: 'Play 500 rounds.', xp: 600 },
  { id: 'first-win', name: 'Winner Winner', emoji: '🥇', description: 'Finish 1st in a round.', xp: 75 },
  { id: 'wins-25', name: 'Podium Hog', emoji: '🐷', description: 'Win 25 rounds.', xp: 200 },
  { id: 'wins-100', name: 'Unstoppable', emoji: '🚀', description: 'Win 100 rounds.', xp: 500 },
  { id: 'session-win', name: 'Champion', emoji: '🏆', description: 'Win a whole party session.', xp: 150 },
  { id: 'session-wins-10', name: 'Dynasty', emoji: '👑', description: 'Win 10 party sessions.', xp: 500 },
  { id: 'perfect', name: 'Perfection', emoji: '💎', description: 'Score 950+ points in a single round.', xp: 200 },
  { id: 'streak-3', name: 'Hat Trick', emoji: '🎩', description: 'Win 3 rounds in a row.', xp: 150 },
  { id: 'streak-5', name: 'On Fire', emoji: '☄️', description: 'Win 5 rounds in a row.', xp: 300 },
  { id: 'explorer-10', name: 'Curious Bloop', emoji: '🔍', description: 'Play 10 different minigames.', xp: 100 },
  { id: 'explorer-50', name: 'Explorer', emoji: '🧭', description: 'Play 50 different minigames.', xp: 300 },
  { id: 'explorer-all', name: 'Completionist', emoji: '🌈', description: 'Play every single minigame.', xp: 1000 },
  { id: 'jack-of-all', name: 'Jack of All Trades', emoji: '🃏', description: 'Win a round in 8 different categories.', xp: 300 },
  { id: 'host-5', name: 'Host with the Most', emoji: '🎤', description: 'Host 5 party sessions.', xp: 150 },
  { id: 'friend-1', name: 'Social Butterfly', emoji: '🦋', description: 'Make your first friend.', xp: 75 },
  { id: 'full-house', name: 'Full House', emoji: '🏠', description: 'Play a session with 8 or more players.', xp: 150 },
  { id: 'comeback', name: 'Comeback Kid', emoji: '🔄', description: 'Win a session after being last at halftime.', xp: 300 },
  { id: 'quick-reflex', name: 'Lightning Fingers', emoji: '⚡', description: 'React in under 200 ms.', xp: 150 },
  { id: 'artist', name: 'Doodle Master', emoji: '🖌️', description: 'Win a drawing round.', xp: 150 },
  { id: 'survivor', name: 'Survivor', emoji: '🛡️', description: 'Win 5 arena or racing rounds.', xp: 200 },
  { id: 'brainiac', name: 'Brainiac', emoji: '🧠', description: 'Win 10 puzzle or memory rounds.', xp: 250 },
  { id: 'social-star', name: 'Social Star', emoji: '🌟', description: 'Win 10 party & social or weird & funny rounds.', xp: 250 },
  { id: 'team-player', name: 'Team Player', emoji: '🤝', description: 'Win 10 team rounds.', xp: 250 },
  { id: 'level-10', name: 'Double Digits', emoji: '🔟', description: 'Reach level 10.', xp: 100 },
  { id: 'level-25', name: 'Seasoned', emoji: '🧂', description: 'Reach level 25.', xp: 250 },
  { id: 'level-50', name: 'Half Century', emoji: '🎖️', description: 'Reach level 50.', xp: 500 },
  { id: 'points-10k', name: 'Point Collector', emoji: '💰', description: 'Earn 10,000 total points.', xp: 150 },
  { id: 'points-100k', name: 'Point Tycoon', emoji: '🏦', description: 'Earn 100,000 total points.', xp: 500 },
  { id: 'marathon', name: 'Marathoner', emoji: '🏃', description: 'Finish a session with 15+ rounds.', xp: 200 },
  { id: 'register', name: 'Official Bloop', emoji: '🪪', description: 'Secure your account with a password.', xp: 100 },
  { id: 'customizer', name: 'Fashionista', emoji: '👗', description: 'Customize your Bloop.', xp: 50 },
];

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
