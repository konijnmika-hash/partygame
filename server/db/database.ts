import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type DB = Database.Database;

const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_lc TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    avatar TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 't-rookie',
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );
  CREATE TABLE auth_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    last_used INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    user_agent TEXT
  );
  CREATE INDEX idx_tokens_user ON auth_tokens(user_id);
  CREATE TABLE user_stats (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rounds_played INTEGER NOT NULL DEFAULT 0,
    rounds_won INTEGER NOT NULL DEFAULT 0,
    sessions_played INTEGER NOT NULL DEFAULT 0,
    sessions_won INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0,
    lb_points INTEGER NOT NULL DEFAULT 0,
    best_round INTEGER NOT NULL DEFAULT 0,
    perfect_rounds INTEGER NOT NULL DEFAULT 0,
    round_streak INTEGER NOT NULL DEFAULT 0,
    best_round_streak INTEGER NOT NULL DEFAULT 0,
    session_streak INTEGER NOT NULL DEFAULT 0,
    best_session_streak INTEGER NOT NULL DEFAULT 0,
    games_hosted INTEGER NOT NULL DEFAULT 0,
    extra TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE game_stats (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    plays INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0,
    best_points INTEGER NOT NULL DEFAULT 0,
    last_played INTEGER NOT NULL,
    PRIMARY KEY (user_id, game_id)
  );
  CREATE TABLE personal_records (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    value REAL NOT NULL,
    better TEXT NOT NULL,
    format TEXT,
    at INTEGER NOT NULL,
    PRIMARY KEY (user_id, game_id, key)
  );
  CREATE TABLE score_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    round_index INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    lb_points INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    players INTEGER NOT NULL,
    won INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (session_id, round_index, user_id)
  );
  CREATE INDEX idx_scores_time ON score_entries(created_at);
  CREATE INDEX idx_scores_user_time ON score_entries(user_id, created_at);
  CREATE TABLE achievements (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
  );
  CREATE TABLE unlocks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id)
  );
  CREATE TABLE friends (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id)
  );
  CREATE INDEX idx_friends_friend ON friends(friend_id);
  CREATE TABLE sessions_history (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    is_public INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    rounds INTEGER NOT NULL,
    players TEXT NOT NULL,
    games TEXT NOT NULL
  );
  CREATE TABLE session_players (
    session_id TEXT NOT NULL REFERENCES sessions_history(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    points INTEGER NOT NULL,
    PRIMARY KEY (session_id, user_id)
  );
  CREATE INDEX idx_session_players_user ON session_players(user_id);
  `,
];

export function openDatabase(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const version = db.pragma('user_version', { simple: true }) as number;
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}
