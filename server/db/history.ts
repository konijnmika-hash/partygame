import type { DB } from './database';

export interface SessionRecord {
  id: string;
  roomCode: string;
  isPublic: boolean;
  startedAt: number;
  endedAt: number;
  rounds: number;
  players: { id: string; name: string; points: number; rank: number; isBot: boolean }[];
  games: { gameId: string; winnerId: string | null }[];
}

export class HistoryRepo {
  private s;
  constructor(private db: DB) {
    this.s = {
      ins: db.prepare(`INSERT OR IGNORE INTO sessions_history (id, room_code, is_public, started_at, ended_at, rounds, players, games)
        VALUES (@id, @room, @pub, @start, @end, @rounds, @players, @games)`),
      insP: db.prepare(`INSERT OR IGNORE INTO session_players (session_id, user_id, rank, points) VALUES (?, ?, ?, ?)`),
      mine: db.prepare(`SELECT h.* FROM session_players p JOIN sessions_history h ON h.id = p.session_id WHERE p.user_id = ? ORDER BY h.ended_at DESC LIMIT ?`),
    };
  }

  /** Returns false if this session was already stored (duplicate protection). */
  insert(r: SessionRecord): boolean {
    let inserted = false;
    this.db.transaction(() => {
      inserted = this.s.ins.run({
        id: r.id, room: r.roomCode, pub: r.isPublic ? 1 : 0, start: r.startedAt, end: r.endedAt, rounds: r.rounds,
        players: JSON.stringify(r.players), games: JSON.stringify(r.games),
      }).changes > 0;
      if (inserted) for (const p of r.players) if (!p.isBot) this.s.insP.run(r.id, p.id, p.rank, p.points);
    })();
    return inserted;
  }

  forUser(userId: string, limit = 20): SessionRecord[] {
    return (this.s.mine.all(userId, limit) as any[]).map((h) => ({
      id: h.id,
      roomCode: h.room_code,
      isPublic: !!h.is_public,
      startedAt: h.started_at,
      endedAt: h.ended_at,
      rounds: h.rounds,
      players: JSON.parse(h.players),
      games: JSON.parse(h.games),
    }));
  }
}
