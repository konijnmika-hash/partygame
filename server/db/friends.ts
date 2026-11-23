import type { DB } from './database';

export interface FriendRow {
  id: string;
  username: string;
  avatar: string;
  level: number;
  title: string;
  status: 'friends' | 'incoming' | 'outgoing';
}

export class FriendsRepo {
  private s;
  constructor(private db: DB) {
    this.s = {
      list: db.prepare(`
        SELECT u.id, u.username, u.avatar, u.level, u.title, 'friends' AS status FROM friends f JOIN users u ON u.id = f.friend_id
          WHERE f.user_id = @me AND f.status = 'accepted'
        UNION ALL
        SELECT u.id, u.username, u.avatar, u.level, u.title, 'outgoing' AS status FROM friends f JOIN users u ON u.id = f.friend_id
          WHERE f.user_id = @me AND f.status = 'pending'
        UNION ALL
        SELECT u.id, u.username, u.avatar, u.level, u.title, 'incoming' AS status FROM friends f JOIN users u ON u.id = f.user_id
          WHERE f.friend_id = @me AND f.status = 'pending'`),
      get: db.prepare(`SELECT status FROM friends WHERE user_id = ? AND friend_id = ?`),
      ins: db.prepare(`INSERT OR REPLACE INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)`),
      del: db.prepare(`DELETE FROM friends WHERE (user_id = @a AND friend_id = @b) OR (user_id = @b AND friend_id = @a)`),
      count: db.prepare(`SELECT COUNT(*) AS n FROM friends WHERE user_id = ? AND status = 'accepted'`),
      ids: db.prepare(`SELECT friend_id AS id FROM friends WHERE user_id = ? AND status = 'accepted'`),
      outgoing: db.prepare(`SELECT COUNT(*) AS n FROM friends WHERE user_id = ? AND status = 'pending'`),
    };
  }

  list(me: string): FriendRow[] {
    return this.s.list.all({ me }) as FriendRow[];
  }

  friendIds(me: string): string[] {
    return (this.s.ids.all(me) as { id: string }[]).map((r) => r.id);
  }

  count(me: string): number {
    return (this.s.count.get(me) as { n: number }).n;
  }

  /** Send a request (or auto-accept if the other side already requested). */
  request(me: string, other: string): 'sent' | 'accepted' | 'already' | 'limit' {
    if (me === other) return 'already';
    const mine = this.s.get.get(me, other) as { status: string } | undefined;
    if (mine) return mine.status === 'accepted' ? 'already' : 'already';
    const theirs = this.s.get.get(other, me) as { status: string } | undefined;
    const now = Date.now();
    if (theirs && theirs.status === 'pending') {
      this.db.transaction(() => {
        this.s.ins.run(me, other, 'accepted', now);
        this.s.ins.run(other, me, 'accepted', now);
      })();
      return 'accepted';
    }
    if ((this.s.outgoing.get(me) as { n: number }).n >= 100) return 'limit';
    this.s.ins.run(me, other, 'pending', now);
    return 'sent';
  }

  accept(me: string, other: string): boolean {
    const theirs = this.s.get.get(other, me) as { status: string } | undefined;
    if (!theirs || theirs.status !== 'pending') return false;
    const now = Date.now();
    this.db.transaction(() => {
      this.s.ins.run(other, me, 'accepted', now);
      this.s.ins.run(me, other, 'accepted', now);
    })();
    return true;
  }

  remove(me: string, other: string): void {
    this.s.del.run({ a: me, b: other });
  }
}
