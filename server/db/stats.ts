import type { UserStats } from '@shared/types';
import type { DB } from './database';

export interface StatsRow {
  user_id: string;
  rounds_played: number;
  rounds_won: number;
  sessions_played: number;
  sessions_won: number;
  total_points: number;
  lb_points: number;
  best_round: number;
  perfect_rounds: number;
  round_streak: number;
  best_round_streak: number;
  session_streak: number;
  best_session_streak: number;
  games_hosted: number;
  extra: string;
}

export interface StatsExtra {
  catWins?: Record<string, number>;
  bestReactionMs?: number;
  [k: string]: unknown;
}

export interface GameStatRow {
  game_id: string;
  plays: number;
  wins: number;
  total_points: number;
  best_points: number;
  last_played: number;
}

export interface RecordRow {
  game_id: string;
  key: string;
  label: string;
  value: number;
  better: 'lower' | 'higher';
  format: string | null;
  at: number;
}

export class StatsRepo {
  private s;
  constructor(private db: DB) {
    this.s = {
      get: db.prepare(`SELECT * FROM user_stats WHERE user_id = ?`),
      ensure: db.prepare(`INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)`),
      round: db.prepare(`UPDATE user_stats SET rounds_played = rounds_played + 1, rounds_won = rounds_won + @won,
        total_points = total_points + @points, lb_points = lb_points + @lb, best_round = MAX(best_round, @points),
        perfect_rounds = perfect_rounds + @perfect, round_streak = @streak, best_round_streak = MAX(best_round_streak, @streak),
        extra = @extra WHERE user_id = @id`),
      session: db.prepare(`UPDATE user_stats SET sessions_played = sessions_played + 1, sessions_won = sessions_won + @won,
        session_streak = @streak, best_session_streak = MAX(best_session_streak, @streak) WHERE user_id = @id`),
      hosted: db.prepare(`UPDATE user_stats SET games_hosted = games_hosted + 1 WHERE user_id = ?`),
      gameUpsert: db.prepare(`INSERT INTO game_stats (user_id, game_id, plays, wins, total_points, best_points, last_played)
        VALUES (@id, @game, 1, @won, @points, @points, @now)
        ON CONFLICT(user_id, game_id) DO UPDATE SET plays = plays + 1, wins = wins + @won, total_points = total_points + @points,
        best_points = MAX(best_points, @points), last_played = @now`),
      games: db.prepare(`SELECT game_id, plays, wins, total_points, best_points, last_played FROM game_stats WHERE user_id = ?`),
      distinct: db.prepare(`SELECT COUNT(*) AS n FROM game_stats WHERE user_id = ?`),
      rec: db.prepare(`SELECT * FROM personal_records WHERE user_id = ? AND game_id = ? AND key = ?`),
      recUpsert: db.prepare(`INSERT INTO personal_records (user_id, game_id, key, label, value, better, format, at)
        VALUES (@id, @game, @key, @label, @value, @better, @format, @now)
        ON CONFLICT(user_id, game_id, key) DO UPDATE SET value = @value, label = @label, at = @now`),
      records: db.prepare(`SELECT game_id, key, label, value, better, format, at FROM personal_records WHERE user_id = ?`),
      score: db.prepare(`INSERT OR IGNORE INTO score_entries (user_id, session_id, round_index, game_id, points, lb_points, rank, players, won, created_at)
        VALUES (@id, @session, @round, @game, @points, @lb, @rank, @players, @won, @now)`),
    };
  }

  get(id: string): StatsRow {
    this.s.ensure.run(id);
    return this.s.get.get(id) as StatsRow;
  }

  extra(row: StatsRow): StatsExtra {
    try {
      return JSON.parse(row.extra || '{}');
    } catch {
      return {};
    }
  }

  /** Returns false when this exact round was already recorded (duplicate scoring protection). */
  insertScore(e: { id: string; session: string; round: number; game: string; points: number; lb: number; rank: number; players: number; won: boolean }): boolean {
    return this.s.score.run({ ...e, won: e.won ? 1 : 0, now: Date.now() }).changes > 0;
  }

  applyRound(id: string, points: number, lb: number, won: boolean, streak: number, extra: StatsExtra): void {
    this.s.round.run({ id, won: won ? 1 : 0, points, lb, perfect: points >= 950 ? 1 : 0, streak, extra: JSON.stringify(extra) });
  }

  applySession(id: string, won: boolean, streak: number): void {
    this.s.session.run({ id, won: won ? 1 : 0, streak });
  }

  addHosted(id: string): void {
    this.s.ensure.run(id);
    this.s.hosted.run(id);
  }

  applyGame(id: string, game: string, points: number, won: boolean): void {
    this.s.gameUpsert.run({ id, game, won: won ? 1 : 0, points, now: Date.now() });
  }

  gameStats(id: string): GameStatRow[] {
    return this.s.games.all(id) as GameStatRow[];
  }

  distinctGames(id: string): number {
    return (this.s.distinct.get(id) as { n: number }).n;
  }

  /** Returns true if this is a new personal record. */
  submitRecord(id: string, game: string, key: string, label: string, value: number, better: 'lower' | 'higher', format?: string): boolean {
    if (!Number.isFinite(value)) return false;
    const cur = this.s.rec.get(id, game, key) as RecordRow | undefined;
    const isBetter = !cur || (better === 'lower' ? value < cur.value : value > cur.value);
    if (isBetter) this.s.recUpsert.run({ id, game, key, label, value, better, format: format ?? null, now: Date.now() });
    return isBetter && !!cur;
  }

  records(id: string): RecordRow[] {
    return this.s.records.all(id) as RecordRow[];
  }
}

export function toUserStats(r: StatsRow, distinct: number): UserStats {
  return {
    roundsPlayed: r.rounds_played,
    roundsWon: r.rounds_won,
    sessionsPlayed: r.sessions_played,
    sessionsWon: r.sessions_won,
    totalPoints: r.total_points,
    bestRound: r.best_round,
    perfectRounds: r.perfect_rounds,
    roundStreak: r.round_streak,
    bestRoundStreak: r.best_round_streak,
    sessionStreak: r.session_streak,
    bestSessionStreak: r.best_session_streak,
    gamesHosted: r.games_hosted,
    distinctGames: distinct,
  };
}
