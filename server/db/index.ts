import { openDatabase, type DB } from './database';
import { UsersRepo } from './users';
import { StatsRepo } from './stats';
import { LeaderboardRepo } from './leaderboard';
import { FriendsRepo } from './friends';
import { HistoryRepo } from './history';

export interface Repos {
  db: DB;
  users: UsersRepo;
  stats: StatsRepo;
  leaderboard: LeaderboardRepo;
  friends: FriendsRepo;
  history: HistoryRepo;
}

export function createRepos(file: string): Repos {
  const db = openDatabase(file);
  return {
    db,
    users: new UsersRepo(db),
    stats: new StatsRepo(db),
    leaderboard: new LeaderboardRepo(db),
    friends: new FriendsRepo(db),
    history: new HistoryRepo(db),
  };
}
