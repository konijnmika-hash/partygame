// Server-side achievement evaluation. Pure function: given current stats, returns earned ids.
import { CATALOG } from '@shared/catalog/index';

export interface AchievementInput {
  roundsPlayed: number;
  roundsWon: number;
  sessionsWon: number;
  totalPoints: number;
  bestRound: number;
  roundStreak: number;
  distinctGames: number;
  catWins: Record<string, number>;
  bestReactionMs?: number;
  level: number;
  gamesHosted: number;
  friends: number;
  registered: boolean;
  session?: { won: boolean; players: number; rounds: number; comeback: boolean };
}

const TOTAL_GAMES = CATALOG.length;

export function evaluateAchievements(i: AchievementInput): string[] {
  const out: string[] = [];
  const add = (id: string, cond: boolean) => {
    if (cond) out.push(id);
  };
  const cw = (cats: string[]) => cats.reduce((n, c) => n + (i.catWins[c] || 0), 0);
  add('first-round', i.roundsPlayed >= 1);
  add('rounds-10', i.roundsPlayed >= 10);
  add('rounds-100', i.roundsPlayed >= 100);
  add('rounds-500', i.roundsPlayed >= 500);
  add('first-win', i.roundsWon >= 1);
  add('wins-25', i.roundsWon >= 25);
  add('wins-100', i.roundsWon >= 100);
  add('session-win', i.sessionsWon >= 1);
  add('session-wins-10', i.sessionsWon >= 10);
  add('perfect', i.bestRound >= 950);
  add('streak-3', i.roundStreak >= 3);
  add('streak-5', i.roundStreak >= 5);
  add('explorer-10', i.distinctGames >= 10);
  add('explorer-50', i.distinctGames >= 50);
  add('explorer-all', i.distinctGames >= TOTAL_GAMES);
  add('jack-of-all', Object.values(i.catWins).filter((n) => n > 0).length >= 8);
  add('host-5', i.gamesHosted >= 5);
  add('friend-1', i.friends >= 1);
  add('quick-reflex', i.bestReactionMs != null && i.bestReactionMs < 200);
  add('artist', (i.catWins.drawing || 0) >= 1);
  add('survivor', cw(['physics', 'racing', 'arcade']) >= 5);
  add('brainiac', cw(['puzzle', 'memory', 'brain']) >= 10);
  add('social-star', cw(['social', 'mind']) >= 10);
  add('team-player', (i.catWins.team || 0) >= 10);
  add('level-10', i.level >= 10);
  add('level-25', i.level >= 25);
  add('level-50', i.level >= 50);
  add('points-10k', i.totalPoints >= 10_000);
  add('points-100k', i.totalPoints >= 100_000);
  add('register', i.registered);
  if (i.session) {
    add('full-house', i.session.players >= 8);
    add('comeback', i.session.won && i.session.comeback);
    add('marathon', i.session.rounds >= 15);
  }
  return out;
}
