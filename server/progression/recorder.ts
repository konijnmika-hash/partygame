// Persists round + session outcomes: score entries (duplicate-safe), stats, XP, records,
// achievements and cosmetic unlocks. Everything is derived from server-computed results.
import type { ProgressUpdate } from '@shared/types';
import { levelFromXp, roundXp, SESSION_XP } from '@shared/levels';
import { ACHIEVEMENT_MAP } from '@shared/achievements';
import { unlocksForAchievement } from '@shared/cosmetics';
import { GAME_MAP } from '@shared/catalog/index';
import { leaderboardPoints } from '@shared/scoring';
import type { Repos } from '../db/index';
import type { RecordEntry } from '../engine/types';
import { evaluateAchievements, type AchievementInput } from './achievements';

export interface RoundPlayerInput {
  id: string;
  isBot: boolean;
  points: number;
  rank: number;
  participated: boolean;
  stats?: Record<string, number>;
}

export interface RoundInput {
  sessionId: string;
  roundIndex: number;
  gameId: string;
  players: RoundPlayerInput[];
  records?: Record<string, RecordEntry[]>;
}

export interface SessionInput {
  sessionId: string;
  roomCode: string;
  isPublic: boolean;
  startedAt: number;
  endedAt: number;
  rounds: number;
  hostId: string | null;
  players: { id: string; name: string; isBot: boolean; points: number; rank: number }[];
  games: { gameId: string; winnerId: string | null }[];
  comebackId: string | null;
}

function fmtRecord(v: number, format?: string): string {
  if (format === 'ms') return `${Math.round(v)} ms`;
  if (format === 'sec') return `${(v / 1000).toFixed(2)} s`;
  if (format === 'pct') return `${Math.round(v * 100)}%`;
  return String(Math.round(v * 100) / 100);
}

export class Recorder {
  constructor(private repos: Repos) {}

  private blank(id: string): ProgressUpdate {
    const u = this.repos.users.byId(id);
    const lv = levelFromXp(u?.xp ?? 0);
    return { xpGained: 0, level: lv.level, leveledUp: false, xp: u?.xp ?? 0, xpIntoLevel: lv.into, xpForNext: lv.next, achievements: [], unlocks: [], records: [] };
  }

  private achievementInput(id: string, extraSession?: AchievementInput['session']): AchievementInput {
    const u = this.repos.users.byId(id)!;
    const st = this.repos.stats.get(id);
    const ex = this.repos.stats.extra(st);
    return {
      roundsPlayed: st.rounds_played,
      roundsWon: st.rounds_won,
      sessionsWon: st.sessions_won,
      totalPoints: st.total_points,
      bestRound: st.best_round,
      roundStreak: st.round_streak,
      distinctGames: this.repos.stats.distinctGames(id),
      catWins: ex.catWins || {},
      bestReactionMs: ex.bestReactionMs,
      level: u.level,
      gamesHosted: st.games_hosted,
      friends: this.repos.friends.count(id),
      registered: !!u.password_hash,
      session: extraSession,
    };
  }

  /** Grants every achievement the user now qualifies for; mutates `up`. Loops for level-up chains. */
  private settleAchievements(id: string, up: ProgressUpdate, session?: AchievementInput['session']) {
    for (let pass = 0; pass < 3; pass++) {
      const earned = evaluateAchievements(this.achievementInput(id, session));
      let any = false;
      for (const aid of earned) {
        if (!ACHIEVEMENT_MAP[aid]) continue;
        if (!this.repos.users.addAchievement(id, aid)) continue;
        any = true;
        up.achievements.push(aid);
        up.unlocks.push(...this.repos.users.addUnlocks(id, unlocksForAchievement(aid)));
        this.addXp(id, ACHIEVEMENT_MAP[aid].xp, up);
      }
      if (!any) break;
    }
  }

  private addXp(id: string, xp: number, up: ProgressUpdate) {
    const r = this.repos.users.addXp(id, xp);
    up.xpGained += xp;
    up.xp = r.xp;
    if (r.level > r.oldLevel) up.leveledUp = true;
    up.level = r.level;
    const lv = levelFromXp(r.xp);
    up.xpIntoLevel = lv.into;
    up.xpForNext = lv.next;
    up.unlocks.push(...r.newUnlocks);
  }

  recordRound(input: RoundInput): Map<string, ProgressUpdate> {
    const out = new Map<string, ProgressUpdate>();
    const humans = input.players.filter((p) => !p.isBot).length;
    const participants = input.players.length;
    const category = GAME_MAP[input.gameId]?.category ?? 'misc';
    const tx = this.repos.db.transaction(() => {
      for (const p of input.players) {
        if (p.isBot) continue;
        if (!this.repos.users.byId(p.id)) continue;
        const won = p.participated && p.rank === 1;
        const lb = leaderboardPoints(p.points, humans, participants);
        const inserted = this.repos.stats.insertScore({
          id: p.id, session: input.sessionId, round: input.roundIndex, game: input.gameId,
          points: p.points, lb, rank: p.rank, players: participants, won,
        });
        if (!inserted) continue; // duplicate scoring protection
        const up = this.blank(p.id);
        const st = this.repos.stats.get(p.id);
        const ex = this.repos.stats.extra(st);
        const streak = won ? st.round_streak + 1 : 0;
        if (won) {
          ex.catWins = ex.catWins || {};
          ex.catWins[category] = (ex.catWins[category] || 0) + 1;
        }
        const react = p.stats?.reactionMs;
        if (typeof react === 'number' && react > 0 && (ex.bestReactionMs == null || react < ex.bestReactionMs)) ex.bestReactionMs = react;
        this.repos.stats.applyRound(p.id, p.points, lb, won, streak, ex);
        this.repos.stats.applyGame(p.id, input.gameId, p.points, won);
        for (const r of input.records?.[p.id] || []) {
          if (this.repos.stats.submitRecord(p.id, input.gameId, r.key, r.label, r.value, r.better, r.format)) {
            up.records.push({ gameId: input.gameId, label: r.label, value: fmtRecord(r.value, r.format) });
          }
        }
        this.addXp(p.id, roundXp(p.points, p.rank, p.participated), up);
        this.settleAchievements(p.id, up);
        out.set(p.id, up);
      }
    });
    tx();
    return out;
  }

  recordSession(input: SessionInput): Map<string, ProgressUpdate> {
    const out = new Map<string, ProgressUpdate>();
    const humans = input.players.filter((p) => !p.isBot);
    const tx = this.repos.db.transaction(() => {
      const fresh = this.repos.history.insert({
        id: input.sessionId, roomCode: input.roomCode, isPublic: input.isPublic, startedAt: input.startedAt, endedAt: input.endedAt,
        rounds: input.rounds, players: input.players, games: input.games,
      });
      if (!fresh) return;
      if (input.hostId && humans.some((h) => h.id === input.hostId)) this.repos.stats.addHosted(input.hostId);
      for (const p of humans) {
        if (!this.repos.users.byId(p.id)) continue;
        const up = this.blank(p.id);
        const st = this.repos.stats.get(p.id);
        const won = p.rank === 1 && input.players.length > 1;
        this.repos.stats.applySession(p.id, won, won ? st.session_streak + 1 : 0);
        const xp = SESSION_XP.finish + (won ? SESSION_XP.win : p.rank <= 3 ? SESSION_XP.podium : 0);
        this.addXp(p.id, xp, up);
        this.settleAchievements(p.id, up, {
          won,
          players: input.players.length,
          rounds: input.rounds,
          comeback: input.comebackId === p.id,
        });
        out.set(p.id, up);
      }
    });
    tx();
    return out;
  }

  /** One-off achievement grants (register, customize, friends). */
  grant(id: string, aid: string): ProgressUpdate | null {
    if (!ACHIEVEMENT_MAP[aid]) return null;
    const up = this.blank(id);
    this.repos.db.transaction(() => {
      if (this.repos.users.addAchievement(id, aid)) {
        up.achievements.push(aid);
        up.unlocks.push(...this.repos.users.addUnlocks(id, unlocksForAchievement(aid)));
        this.addXp(id, ACHIEVEMENT_MAP[aid].xp, up);
      }
      this.settleAchievements(id, up);
    })();
    return up.achievements.length ? up : null;
  }
}
