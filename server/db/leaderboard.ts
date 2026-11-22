import type { LeaderboardRow, LeaderboardScope } from '@shared/types';
import type { DB } from './database';
import { parseAvatar } from './users';

export function startOfDayUTC(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function startOfWeekUTC(now = Date.now()): number {
  const d = new Date(startOfDayUTC(now));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return d.getTime() - dow * 86400_000;
}

interface Raw {
  id: string;
  username: string;
  avatar: string;
  level: number;
  title: string;
  points: number;
  wins: number;
  rounds: number;
}

export class LeaderboardRepo {
  private s;
  constructor(private db: DB) {
    this.s = {
      period: db.prepare(`SELECT u.id, u.username, u.avatar, u.level, u.title, SUM(e.lb_points) AS points, SUM(e.won) AS wins, COUNT(*) AS rounds
        FROM score_entries e JOIN users u ON u.id = e.user_id
        WHERE e.created_at >= ? GROUP BY e.user_id ORDER BY points DESC, wins DESC, u.id LIMIT ?`),
      periodMe: db.prepare(`SELECT SUM(lb_points) AS points, SUM(won) AS wins, COUNT(*) AS rounds FROM score_entries WHERE user_id = ? AND created_at >= ?`),
      periodRank: db.prepare(`SELECT COUNT(*) + 1 AS r FROM (SELECT SUM(lb_points) AS p FROM score_entries WHERE created_at >= ? GROUP BY user_id HAVING p > ?)`),
      all: db.prepare(`SELECT u.id, u.username, u.avatar, u.level, u.title, s.lb_points AS points, s.rounds_won AS wins, s.rounds_played AS rounds
        FROM user_stats s JOIN users u ON u.id = s.user_id WHERE s.rounds_played > 0
        ORDER BY s.lb_points DESC, s.rounds_won DESC, u.id LIMIT ?`),
      allMe: db.prepare(`SELECT lb_points AS points, rounds_won AS wins, rounds_played AS rounds FROM user_stats WHERE user_id = ?`),
      allRank: db.prepare(`SELECT COUNT(*) + 1 AS r FROM user_stats WHERE lb_points > ? AND rounds_played > 0`),
      friends: db.prepare(`SELECT u.id, u.username, u.avatar, u.level, u.title, s.lb_points AS points, s.rounds_won AS wins, s.rounds_played AS rounds
        FROM users u JOIN user_stats s ON s.user_id = u.id
        WHERE u.id = @me OR u.id IN (SELECT friend_id FROM friends WHERE user_id = @me AND status = 'accepted')
        ORDER BY s.lb_points DESC, u.id`),
      friendsWeek: db.prepare(`SELECT u.id, u.username, u.avatar, u.level, u.title, COALESCE(SUM(e.lb_points),0) AS points, COALESCE(SUM(e.won),0) AS wins, COUNT(e.id) AS rounds
        FROM users u LEFT JOIN score_entries e ON e.user_id = u.id AND e.created_at >= @since
        WHERE u.id = @me OR u.id IN (SELECT friend_id FROM friends WHERE user_id = @me AND status = 'accepted')
        GROUP BY u.id ORDER BY points DESC, u.id`),
    };
  }

  get(scope: LeaderboardScope, me: string, limit = 50, isOnline?: (id: string) => boolean): { rows: LeaderboardRow[]; me: LeaderboardRow | null } {
    let raws: Raw[] = [];
    let mine: LeaderboardRow | null = null;
    const now = Date.now();
    if (scope === 'daily' || scope === 'weekly') {
      const since = scope === 'daily' ? startOfDayUTC(now) : startOfWeekUTC(now);
      raws = this.s.period.all(since, limit) as Raw[];
      const m = this.s.periodMe.get(me, since) as { points: number | null; wins: number | null; rounds: number };
      if (m && m.rounds > 0) {
        const r = (this.s.periodRank.get(since, m.points ?? 0) as { r: number }).r;
        mine = { rank: r, id: me, name: '', avatar: null as never, level: 0, title: '', points: m.points ?? 0, wins: m.wins ?? 0, rounds: m.rounds, isMe: true };
      }
    } else if (scope === 'alltime') {
      raws = this.s.all.all(limit) as Raw[];
      const m = this.s.allMe.get(me) as { points: number; wins: number; rounds: number } | undefined;
      if (m && m.rounds > 0) {
        const r = (this.s.allRank.get(m.points) as { r: number }).r;
        mine = { rank: r, id: me, name: '', avatar: null as never, level: 0, title: '', points: m.points, wins: m.wins, rounds: m.rounds, isMe: true };
      }
    } else {
      raws = this.s.friends.all({ me }) as Raw[];
    }
    const rows = raws.map((r, i) => toRow(r, i + 1, me, isOnline));
    const inList = rows.find((r) => r.id === me);
    if (inList) mine = inList;
    return { rows, me: mine };
  }

  friendsWeekly(me: string, isOnline?: (id: string) => boolean): LeaderboardRow[] {
    return (this.s.friendsWeek.all({ me, since: startOfWeekUTC() }) as Raw[]).map((r, i) => toRow(r, i + 1, me, isOnline));
  }
}

function toRow(r: Raw, rank: number, me: string, isOnline?: (id: string) => boolean): LeaderboardRow {
  return {
    rank,
    id: r.id,
    name: r.username,
    avatar: parseAvatar(r.avatar),
    level: r.level,
    title: r.title,
    points: r.points ?? 0,
    wins: r.wins ?? 0,
    rounds: r.rounds ?? 0,
    isMe: r.id === me,
    online: isOnline ? isOnline(r.id) : undefined,
  };
}
