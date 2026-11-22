// A party room: members, host controls, the session/round state machine and game runner glue.
import crypto from 'node:crypto';
import type {
  Avatar, ChatMessage, FinalResults, InputFrame, PublicProfile, RoomMember, RoomPhase, RoomSettings, RoomState,
  RoundInfo, RoundResults, Standing, TeamStanding, Award,
} from '@shared/types';
import { GAME_MAP, supportsCount } from '@shared/catalog/index';
import { normalizeRound } from '@shared/scoring';
import { colorValue } from '@shared/cosmetics';
import { sanitizeText } from '@shared/validation';
import { GameRunner, type Clock, type RunnerIO } from '../engine/runner';
import type { GameDef, GamePlayer } from '../engine/types';
import type { Recorder } from '../progression/recorder';
import { applySettingsPatch, defaultSettings } from './settings';
import { pickNextGame } from './planner';
import { makeBotProfile } from './bots';

export interface RoomTransport {
  toChannel(channel: string, ev: string, ...args: unknown[]): void;
  toSocket(socketId: string, ev: string, ...args: unknown[]): void;
  join(socketId: string, channel: string): void;
  leave(socketId: string, channel: string): void;
}

export interface RoomDeps {
  transport: RoomTransport;
  clock: Clock;
  recorder: Recorder | null;
  games: Map<string, GameDef>;
  rttOf: (socketId: string) => number;
  onMembership: (userId: string, code: string | null) => void;
  log?: (...a: unknown[]) => void;
}

interface Member {
  id: string;
  name: string;
  avatar: Avatar;
  level: number;
  title: string;
  isBot: boolean;
  sockets: Set<string>;
  connected: boolean;
  ready: boolean;
  team: number | null;
  score: number;
  roomScore: number;
  wins: number;
  joinedAt: number;
  disconnectedAt: number | null;
  spectator: boolean;
  lastRank: number;
}

interface Session {
  id: string;
  startedAt: number;
  total: number;
  index: number;
  used: string[];
  roundScores: Map<string, number[]>;
  history: { gameId: string; winnerId: string | null }[];
  halfwayLast: string | null;
  hostId: string | null;
  peakPlayers: number;
}

export const TIMING = {
  intro: 10_000,
  introSkip: 3_200,
  results: 11_000,
  resultsSkip: 1_200,
  standings: 7_000,
  standingsSkip: 900,
  publicFinal: 25_000,
  publicAutoStart: 20_000,
  publicReadyStart: 3_000,
  lobbyDisconnectGrace: 30_000,
  sessionDisconnectGrace: 120_000,
  hostMigrateAfter: 8_000,
  emptyRoomTtl: 60_000,
};

const MAX_CHAT = 60;

export class Room {
  readonly id = crypto.randomUUID();
  readonly channel: string;
  readonly createdAt: number;
  members = new Map<string, Member>();
  hostId: string | null = null;
  phase: RoomPhase = 'lobby';
  phaseEndsAt: number | null = null;
  settings: RoomSettings;
  session: Session | null = null;
  runner: GameRunner | null = null;
  round: RoundInfo | null = null;
  chat: ChatMessage[] = [];
  autoStartAt: number | null = null;
  emptySince: number | null = null;
  closed = false;
  lastResults: RoundResults | null = null;
  lastFinal: FinalResults | null = null;
  private banned = new Map<string, number>();
  private stateDirty = true;
  private standingsCache: Standing[] = [];

  constructor(readonly code: string, readonly isPublic: boolean, private deps: RoomDeps, settings?: Partial<RoomSettings> | null) {
    this.channel = `room:${code}`;
    this.createdAt = deps.clock.now();
    this.settings = defaultSettings(isPublic);
    if (settings && !isPublic) {
      const merged = applySettingsPatch(this.settings, settings, this.available);
      if (merged) this.settings = merged;
    }
  }

  get available(): Set<string> {
    return new Set(this.deps.games.keys());
  }

  private now() {
    return this.deps.clock.now();
  }

  private dirty() {
    this.stateDirty = true;
  }

  // ---------------------------------------------------------------- members

  get humans(): Member[] {
    return [...this.members.values()].filter((m) => !m.isBot);
  }

  get connectedHumans(): Member[] {
    return this.humans.filter((m) => m.connected);
  }

  get size(): number {
    return this.members.size;
  }

  isFull(): boolean {
    return this.members.size >= this.settings.maxPlayers;
  }

  isBanned(userId: string): boolean {
    const until = this.banned.get(userId);
    return !!until && until > this.now();
  }

  /** Add (or refresh) a human member. Returns false when the room is full. */
  addHuman(p: PublicProfile): boolean {
    const existing = this.members.get(p.id);
    if (existing) {
      Object.assign(existing, { name: p.name, avatar: p.avatar, level: p.level, title: p.title });
      this.dirty();
      return true;
    }
    if (this.isFull()) {
      // make room by removing a bot if possible
      const bot = [...this.members.values()].find((m) => m.isBot);
      if (!bot) return false;
      this.removeMember(bot.id, 'replaced');
    }
    const inSession = this.phase !== 'lobby';
    const m: Member = {
      id: p.id, name: p.name, avatar: p.avatar, level: p.level, title: p.title, isBot: false,
      sockets: new Set(), connected: false, ready: false, team: null, score: 0, roomScore: 0, wins: 0,
      joinedAt: this.now(), disconnectedAt: null, spectator: inSession, lastRank: 0,
    };
    if (this.session && this.settings.teamMode !== 'off') m.team = this.smallestTeam();
    this.members.set(p.id, m);
    if (!this.hostId && !this.isPublic) this.hostId = p.id;
    this.deps.onMembership(p.id, this.code);
    this.systemChat(`${p.name} joined the party!`);
    this.dirty();
    return true;
  }

  updateProfile(p: PublicProfile): void {
    const m = this.members.get(p.id);
    if (!m) return;
    Object.assign(m, { name: p.name, avatar: p.avatar, level: p.level, title: p.title });
    this.dirty();
  }

  attach(userId: string, socketId: string): void {
    const m = this.members.get(userId);
    if (!m || m.isBot) return;
    const wasConnected = m.connected;
    m.sockets.add(socketId);
    m.connected = true;
    m.disconnectedAt = null;
    this.emptySince = null;
    this.deps.transport.join(socketId, this.channel);
    // catch the socket up on everything
    const t = this.deps.transport;
    t.toSocket(socketId, 'room:state', this.toState());
    t.toSocket(socketId, 'chat:history', this.chat);
    if (this.round) t.toSocket(socketId, 'game:reset', this.round.gameId);
    if (this.phase === 'playing' && this.runner) {
      this.runner.resync(userId, (kind, a, b) => {
        if (kind === 'pub') t.toSocket(socketId, 'game:pub', a, b);
        else if (kind === 'priv') t.toSocket(socketId, 'game:priv', a);
        else t.toSocket(socketId, 'game:asset', a, b);
      });
    }
    if ((this.phase === 'results' || this.phase === 'standings') && this.lastResults) t.toSocket(socketId, 'room:results', this.lastResults);
    if (this.phase === 'final' && this.lastFinal) t.toSocket(socketId, 'room:final', this.lastFinal);
    if (!wasConnected && m.joinedAt < this.now() - 2000) this.systemChat(`${m.name} reconnected.`);
    this.dirty();
  }

  detach(userId: string, socketId: string): void {
    const m = this.members.get(userId);
    if (!m) return;
    m.sockets.delete(socketId);
    this.deps.transport.leave(socketId, this.channel);
    if (m.sockets.size === 0 && m.connected) {
      m.connected = false;
      m.disconnectedAt = this.now();
      if (this.runner) this.runner.playerLeft(userId);
      this.dirty();
    }
  }

  removeMember(userId: string, reason: 'left' | 'kicked' | 'timeout' | 'replaced' | 'closed'): void {
    const m = this.members.get(userId);
    if (!m) return;
    if (this.runner) this.runner.playerLeft(userId);
    for (const sid of m.sockets) {
      this.deps.transport.toSocket(sid, 'room:left', reason);
      this.deps.transport.leave(sid, this.channel);
    }
    this.members.delete(userId);
    if (!m.isBot) {
      this.deps.onMembership(userId, null);
      if (reason !== 'closed') this.systemChat(reason === 'kicked' ? `${m.name} was kicked.` : `${m.name} left.`);
    }
    if (this.hostId === userId) this.migrateHost();
    this.dirty();
  }

  private migrateHost(): void {
    if (this.isPublic) {
      this.hostId = null;
      return;
    }
    const next = this.connectedHumans.sort((a, b) => a.joinedAt - b.joinedAt)[0] ?? this.humans[0];
    this.hostId = next ? next.id : null;
    if (next) this.systemChat(`${next.name} is now the host.`);
    this.dirty();
  }

  private smallestTeam(): number {
    const n = this.settings.teamMode === 'teams3' ? 3 : 2;
    const counts = new Array(n).fill(0);
    for (const m of this.members.values()) if (m.team != null && m.team < n) counts[m.team]++;
    return counts.indexOf(Math.min(...counts));
  }

  // ---------------------------------------------------------------- host + player actions

  private isHost(userId: string) {
    return !this.isPublic && this.hostId === userId;
  }

  updateSettings(userId: string, patch: unknown): string | null {
    if (!this.isHost(userId)) return 'Only the host can change settings';
    if (this.phase !== 'lobby') return 'Settings can only change in the lobby';
    const next = applySettingsPatch(this.settings, patch, this.available);
    if (!next) return 'Invalid settings';
    if (next.maxPlayers < this.members.size) next.maxPlayers = this.members.size;
    this.settings = next;
    if (next.teamMode !== 'off') this.assignTeams(false);
    else for (const m of this.members.values()) m.team = null;
    this.dirty();
    return null;
  }

  setReady(userId: string, ready: boolean): void {
    const m = this.members.get(userId);
    if (!m || m.isBot) return;
    if (this.phase === 'lobby') {
      m.ready = !!ready;
      this.dirty();
    } else this.skip(userId);
  }

  /** "Got it / continue" during intro, results and standings. Speeds up when everyone is ready. */
  skip(userId: string): void {
    const m = this.members.get(userId);
    if (!m || m.isBot || !['intro', 'results', 'standings'].includes(this.phase)) return;
    m.ready = true;
    const waiting = this.connectedHumans.filter((h) => !h.ready && (this.phase !== 'intro' || !h.spectator));
    if (waiting.length === 0 && this.phaseEndsAt != null) {
      const skipMs = this.phase === 'intro' ? TIMING.introSkip : this.phase === 'results' ? TIMING.resultsSkip : TIMING.standingsSkip;
      this.phaseEndsAt = Math.min(this.phaseEndsAt, this.now() + skipMs);
    }
    this.dirty();
  }

  setTeam(userId: string, team: number): void {
    if (this.phase !== 'lobby' || this.settings.teamMode === 'off') return;
    const n = this.settings.teamMode === 'teams3' ? 3 : 2;
    const m = this.members.get(userId);
    if (!m || !Number.isInteger(team) || team < 0 || team >= n) return;
    m.team = team;
    this.dirty();
  }

  kick(userId: string, target: string): void {
    if (!this.isHost(userId) || target === userId) return;
    const m = this.members.get(target);
    if (!m) return;
    if (!m.isBot) this.banned.set(target, this.now() + 5 * 60_000);
    this.removeMember(target, 'kicked');
  }

  addBot(userId: string): string | null {
    if (!this.isHost(userId) && !(this.isPublic && this.connectedHumans.length === 1)) return 'Only the host can add bots';
    if (this.isFull()) return 'Room is full';
    const taken = new Set([...this.members.values()].map((m) => m.name));
    const b = makeBotProfile(taken);
    this.members.set(b.id, {
      id: b.id, name: b.name, avatar: b.avatar, level: 1, title: 'Robot', isBot: true, sockets: new Set(), connected: true,
      ready: true, team: this.settings.teamMode !== 'off' ? this.smallestTeam() : null, score: 0, roomScore: 0, wins: 0,
      joinedAt: this.now(), disconnectedAt: null, spectator: this.phase !== 'lobby', lastRank: 0,
    });
    this.dirty();
    return null;
  }

  removeBot(userId: string): void {
    if (!this.isHost(userId)) return;
    const bots = [...this.members.values()].filter((m) => m.isBot);
    const last = bots[bots.length - 1];
    if (last) this.removeMember(last.id, 'left');
  }

  /** Public rooms: a lonely player can start right away against bots. */
  soloWithBots(userId: string): string | null {
    if (!this.isPublic || this.phase !== 'lobby') return 'Not available';
    if (this.connectedHumans.length !== 1 || this.connectedHumans[0].id !== userId) return 'Other players are here — start together!';
    while (this.members.size < 4) this.addBot(userId);
    this.startSession();
    return null;
  }

  start(userId: string): string | null {
    if (!this.isHost(userId)) return 'Only the host can start';
    if (this.phase !== 'lobby') return 'Already started';
    return this.startSession();
  }

  backToLobby(userId: string): void {
    if (!this.isHost(userId) || this.phase !== 'final') return;
    this.returnToLobby();
  }

  playAgain(userId: string): void {
    if (!this.isHost(userId) || this.phase !== 'final') return;
    this.returnToLobby();
    this.startSession();
  }

  sendChat(userId: string, text: unknown): void {
    const m = this.members.get(userId);
    if (!m) return;
    const clean = sanitizeText(text, 200);
    if (!clean) return;
    this.pushChat({ id: crypto.randomUUID(), from: userId, name: m.name, text: clean, at: this.now() });
  }

  emote(userId: string, emote: unknown): void {
    if (!this.members.has(userId)) return;
    const ALLOWED = ['😂', '😮', '😍', '😡', '👏', '🔥', '💀', '🎉', 'GG', '😭', '🤔', '👀'];
    if (typeof emote !== 'string' || !ALLOWED.includes(emote)) return;
    this.deps.transport.toChannel(this.channel, 'emote', userId, emote);
  }

  private systemChat(text: string) {
    this.pushChat({ id: crypto.randomUUID(), from: 'system', name: 'Bloop Bash', text, at: this.now() });
  }

  private pushChat(msg: ChatMessage) {
    this.chat.push(msg);
    if (this.chat.length > MAX_CHAT) this.chat.splice(0, this.chat.length - MAX_CHAT);
    this.deps.transport.toChannel(this.channel, 'chat', msg);
  }

  gameAction(userId: string, action: unknown): void {
    if (this.phase === 'playing' && this.runner) this.runner.handleAction(userId, action);
  }

  gameInput(userId: string, frame: InputFrame): void {
    if (this.phase === 'playing' && this.runner) this.runner.handleInput(userId, frame);
  }

  gameSync(userId: string, socketId: string): void {
    if (this.phase !== 'playing' || !this.runner) return;
    const t = this.deps.transport;
    this.runner.resync(userId, (kind, a, b) => {
      if (kind === 'pub') t.toSocket(socketId, 'game:pub', a, b);
      else if (kind === 'priv') t.toSocket(socketId, 'game:priv', a);
      else t.toSocket(socketId, 'game:asset', a, b);
    });
  }

  // ---------------------------------------------------------------- session flow

  private participants(): Member[] {
    return [...this.members.values()].filter((m) => !m.spectator && (m.isBot || m.connected));
  }

  private assignTeams(shuffle: boolean): void {
    const n = this.settings.teamMode === 'teams3' ? 3 : 2;
    const list = [...this.members.values()];
    if (shuffle) list.sort(() => Math.random() - 0.5);
    const unassigned = list.filter((m) => m.team == null || m.team >= n || shuffle);
    for (const m of unassigned) m.team = null;
    for (const m of unassigned) m.team = this.smallestTeam();
  }

  private startSession(): string | null {
    const players = this.participantsForStart();
    if (players.length < 2) return 'Need at least 2 players (add a bot!)';
    this.session = {
      id: crypto.randomUUID(),
      startedAt: this.now(),
      total: this.settings.rounds,
      index: -1,
      used: [],
      roundScores: new Map(),
      history: [],
      halfwayLast: null,
      hostId: this.hostId,
      peakPlayers: players.length,
    };
    for (const m of this.members.values()) {
      m.score = 0;
      m.wins = 0;
      m.spectator = false;
      m.lastRank = 0;
    }
    if (this.settings.teamMode !== 'off') this.assignTeams(false);
    this.autoStartAt = null;
    this.lastFinal = null;
    this.systemChat('Let the games begin!');
    this.beginRound(0);
    return null;
  }

  private participantsForStart(): Member[] {
    return [...this.members.values()].filter((m) => m.isBot || m.connected);
  }

  private beginRound(index: number): void {
    const s = this.session!;
    for (const m of this.members.values()) if (m.spectator && (m.connected || m.isBot)) m.spectator = false;
    const parts = this.participants();
    if (parts.length < 2) {
      this.finishSession();
      return;
    }
    s.peakPlayers = Math.max(s.peakPlayers, parts.length);
    const gameId = pickNextGame(this.settings, parts.length, s.used, index, this.available);
    if (!gameId) {
      this.finishSession();
      return;
    }
    s.index = index;
    const multiplier = this.settings.rules.doubleFinal && index === s.total - 1 ? 2 : 1;
    this.round = { index, total: s.total, gameId, multiplier };
    this.phase = 'intro';
    this.phaseEndsAt = this.now() + TIMING.intro;
    for (const m of this.members.values()) m.ready = m.isBot;
    this.deps.transport.toChannel(this.channel, 'game:reset', gameId);
    this.dirty();
  }

  private beginPlaying(): void {
    const s = this.session!;
    const round = this.round!;
    let meta = GAME_MAP[round.gameId];
    const parts = this.participants();
    if (parts.length < 2) {
      this.finishSession();
      return;
    }
    if (!supportsCount(meta, parts.length)) {
      // someone left during the intro: pick something that fits and show its intro
      this.beginRound(round.index);
      return;
    }
    const def = this.deps.games.get(round.gameId)!;
    // team assignment for this round
    let teamOf = (m: Member): number | null => (this.settings.teamMode !== 'off' ? m.team : null);
    if (meta.teams && this.settings.teamMode === 'off') {
      const shuffled = [...parts].sort(() => Math.random() - 0.5);
      const tmp = new Map<string, number>();
      shuffled.forEach((m, i) => tmp.set(m.id, i % 2));
      teamOf = (m) => tmp.get(m.id) ?? 0;
    }
    if (meta.teams && this.settings.teamMode !== 'off') {
      // make sure every team has someone; otherwise rebalance for this round
      const n = this.settings.teamMode === 'teams3' ? 3 : 2;
      const counts = new Array(n).fill(0);
      for (const m of parts) if (m.team != null) counts[m.team]++;
      const nonEmpty = counts.filter((c) => c > 0).length;
      if (nonEmpty < 2) {
        const tmp = new Map<string, number>();
        parts.forEach((m, i) => tmp.set(m.id, i % 2));
        teamOf = (m) => tmp.get(m.id) ?? 0;
      }
    }
    // compact team indices so games always get teams 0..k-1
    const rawTeams = parts.map((m) => teamOf(m));
    const uniq = [...new Set(rawTeams.filter((t): t is number => t != null))].sort();
    const players: GamePlayer[] = parts.map((m, i) => ({
      id: m.id,
      name: m.name,
      isBot: m.isBot,
      team: rawTeams[i] == null ? null : uniq.indexOf(rawTeams[i]!),
      color: colorValue(m.avatar.color),
      index: i,
    }));
    meta = GAME_MAP[round.gameId];
    const io: RunnerIO = {
      pub: (data, t) => this.deps.transport.toChannel(this.channel, 'game:pub', data, t),
      priv: (pid, data) => this.toMember(pid, 'game:priv', data),
      event: (type, data, to) => {
        if (to == null) this.deps.transport.toChannel(this.channel, 'game:event', { type, data });
        else for (const pid of to) this.toMember(pid, 'game:event', { type, data });
      },
      asset: (key, data, to) => {
        if (to == null) this.deps.transport.toChannel(this.channel, 'game:asset', key, data);
        else for (const pid of to) this.toMember(pid, 'game:asset', key, data);
      },
    };
    this.runner = new GameRunner(def, meta, players, {
      clock: this.deps.clock,
      seed: crypto.randomInt(1, 2 ** 31 - 1),
      difficulty: this.settings.difficulty,
      timeScale: this.settings.rules.speedMode ? 0.75 : 1,
      io,
      isConnected: (pid) => !!this.members.get(pid)?.connected,
      rtt: (pid) => {
        const m = this.members.get(pid);
        if (!m || m.sockets.size === 0) return 150;
        return Math.min(...[...m.sockets].map((sid) => this.deps.rttOf(sid)));
      },
      onError: (err, where) => (this.deps.log ?? console.error)(`[room ${this.code}] game error at ${where}:`, err),
    });
    s.used.push(round.gameId);
    this.phase = 'playing';
    this.phaseEndsAt = null;
    this.dirty();
    this.runner.begin();
  }

  private toMember(pid: string, ev: string, ...args: unknown[]) {
    const m = this.members.get(pid);
    if (!m) return;
    for (const sid of m.sockets) this.deps.transport.toSocket(sid, ev, ...args);
  }

  private endRound(): void {
    const runner = this.runner!;
    const s = this.session!;
    const round = this.round!;
    const res = runner.results!;
    this.runner = null;
    const norm = normalizeRound(res.perfs);
    const before = this.computeStandings();
    const beforeRank = new Map(before.map((x) => [x.id, x.rank]));
    const n = before.length;
    const players: RoundResults['players'] = [];
    let winnerId: string | null = null;
    for (const p of runner.players) {
      const r = norm[p.id];
      if (!r) continue;
      let sessionPoints = r.points * round.multiplier;
      const breakdown = r.breakdown.slice();
      if (round.multiplier > 1) breakdown.push({ label: `Final round x${round.multiplier}`, pts: r.points * (round.multiplier - 1) });
      if (this.settings.rules.underdog && n >= 3 && (beforeRank.get(p.id) ?? 0) > Math.ceil(n / 2) && r.points > 0) {
        const bonus = Math.round(r.points * 0.15);
        sessionPoints += bonus;
        breakdown.push({ label: 'Underdog boost +15%', pts: bonus });
      }
      const m = this.members.get(p.id);
      if (m) {
        m.score += sessionPoints;
        m.roomScore += sessionPoints;
        if (r.rank === 1 && res.perfs[p.id]?.participated) m.wins++;
      }
      if (r.rank === 1 && res.perfs[p.id]?.participated && !winnerId) winnerId = p.id;
      const list = s.roundScores.get(p.id) ?? [];
      list.push(r.points);
      s.roundScores.set(p.id, list);
      players.push({ id: p.id, points: r.points, sessionPoints, rank: r.rank, breakdown, highlight: res.perfs[p.id]?.highlight });
    }
    players.sort((a, b) => a.rank - b.rank || b.points - a.points);
    s.history.push({ gameId: round.gameId, winnerId });
    // persistence + progression (server-computed points only)
    if (this.deps.recorder) {
      try {
        const updates = this.deps.recorder.recordRound({
          sessionId: s.id,
          roundIndex: round.index,
          gameId: round.gameId,
          players: runner.players.map((p) => ({
            id: p.id,
            isBot: p.isBot,
            points: norm[p.id]?.points ?? 0,
            rank: norm[p.id]?.rank ?? runner.players.length,
            participated: !!res.perfs[p.id]?.participated,
            stats: res.stats?.[p.id],
          })),
          records: res.records,
        });
        for (const [uid, up] of updates) {
          const pr = players.find((x) => x.id === uid);
          if (pr) pr.xp = up.xpGained;
          this.toMember(uid, 'progress', up);
          const m = this.members.get(uid);
          if (m) m.level = up.level;
        }
      } catch (err) {
        (this.deps.log ?? console.error)('recordRound failed', err);
      }
    }
    const results: RoundResults = {
      gameId: round.gameId,
      index: round.index,
      multiplier: round.multiplier,
      players,
      teams: this.computeTeamStandings(players),
      summary: res.summary ?? [],
    };
    this.lastResults = results;
    // halfway snapshot for the comeback achievement
    if (s.total >= 4 && round.index === Math.floor(s.total / 2) - 1) {
      const st = this.computeStandings();
      s.halfwayLast = st.length ? st[st.length - 1].id : null;
    }
    for (const m of this.members.values()) m.ready = m.isBot;
    this.phase = 'results';
    this.phaseEndsAt = this.now() + TIMING.results;
    this.deps.transport.toChannel(this.channel, 'room:results', results);
    this.dirty();
  }

  private computeTeamStandings(round?: RoundResults['players']): TeamStanding[] {
    const teams = new Map<number, number>();
    if (round) {
      for (const p of round) {
        const m = this.members.get(p.id);
        if (m?.team != null && this.settings.teamMode !== 'off') teams.set(m.team, (teams.get(m.team) || 0) + p.sessionPoints);
      }
    } else {
      for (const m of this.members.values()) if (m.team != null && this.settings.teamMode !== 'off') teams.set(m.team, (teams.get(m.team) || 0) + m.score);
    }
    const arr = [...teams.entries()].map(([team, points]) => ({ team, points, rank: 0 })).sort((a, b) => b.points - a.points);
    arr.forEach((t, i) => (t.rank = i > 0 && arr[i - 1].points === t.points ? arr[i - 1].rank : i + 1));
    return arr;
  }

  private computeStandings(): Standing[] {
    const list = [...this.members.values()].filter((m) => !m.spectator || m.score > 0);
    list.sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);
    const out: Standing[] = [];
    list.forEach((m, i) => {
      const rank = i > 0 && list[i - 1].score === m.score ? out[i - 1].rank : i + 1;
      out.push({ id: m.id, points: m.score, rank, delta: m.lastRank ? m.lastRank - rank : 0 });
    });
    return out;
  }

  private advanceFromStandings(): void {
    const s = this.session!;
    for (const st of this.computeStandings()) {
      const m = this.members.get(st.id);
      if (m) m.lastRank = st.rank;
    }
    if (s.index + 1 >= s.total) this.finishSession();
    else this.beginRound(s.index + 1);
  }

  private finishSession(): void {
    const s = this.session;
    if (!s) {
      this.returnToLobby();
      return;
    }
    if (this.runner) {
      this.runner.finish();
      this.runner = null;
    }
    const standings = this.computeStandings();
    const final: FinalResults = {
      sessionId: s.id,
      standings: standings.map((st) => ({ id: st.id, points: st.points, rank: st.rank, wins: this.members.get(st.id)?.wins ?? 0 })),
      teams: this.settings.teamMode !== 'off' ? this.computeTeamStandings() : undefined,
      awards: this.computeAwards(standings),
      rounds: s.history,
    };
    this.lastFinal = final;
    const winner = standings[0];
    const comebackId = winner && s.halfwayLast === winner.id && standings.length >= 3 ? winner.id : null;
    if (this.deps.recorder && s.history.length > 0) {
      try {
        const updates = this.deps.recorder.recordSession({
          sessionId: s.id,
          roomCode: this.code,
          isPublic: this.isPublic,
          startedAt: s.startedAt,
          endedAt: this.now(),
          rounds: s.history.length,
          hostId: s.hostId,
          players: standings.map((st) => {
            const m = this.members.get(st.id);
            return { id: st.id, name: m?.name ?? '?', isBot: !!m?.isBot, points: st.points, rank: st.rank };
          }),
          games: s.history,
          comebackId,
        });
        for (const [uid, up] of updates) {
          this.toMember(uid, 'progress', up);
          const m = this.members.get(uid);
          if (m) m.level = up.level;
        }
      } catch (err) {
        (this.deps.log ?? console.error)('recordSession failed', err);
      }
    }
    this.phase = 'final';
    this.phaseEndsAt = this.isPublic ? this.now() + TIMING.publicFinal : null;
    this.round = null;
    this.deps.transport.toChannel(this.channel, 'room:final', final);
    this.dirty();
  }

  private computeAwards(standings: Standing[]): Award[] {
    const s = this.session!;
    const awards: Award[] = [];
    const name = (id: string) => this.members.get(id)?.name ?? '???';
    if (standings[0] && standings[0].points > 0) awards.push({ title: 'Party Champion', emoji: '🏆', playerId: standings[0].id, detail: `${standings[0].points} points` });
    let mostWins: [string, number] | null = null;
    for (const m of this.members.values()) if (m.wins > 0 && (!mostWins || m.wins > mostWins[1])) mostWins = [m.id, m.wins];
    if (mostWins && mostWins[1] > 1) awards.push({ title: 'Round Hoarder', emoji: '🥇', playerId: mostWins[0], detail: `${mostWins[1]} round wins` });
    let big: [string, number] | null = null;
    let steady: [string, number] | null = null;
    for (const [id, scores] of s.roundScores) {
      const best = Math.max(...scores);
      if (!big || best > big[1]) big = [id, best];
      if (scores.length >= Math.max(2, s.history.length)) {
        const min = Math.min(...scores);
        if (!steady || min > steady[1]) steady = [id, min];
      }
    }
    if (big && big[1] > 0) awards.push({ title: 'Big Moment', emoji: '🚀', playerId: big[0], detail: `${big[1]} points in one round` });
    if (steady && steady[1] > 0 && steady[0] !== standings[0]?.id) awards.push({ title: 'Steady Hands', emoji: '🧘', playerId: steady[0], detail: `never below ${steady[1]}` });
    const last = standings[standings.length - 1];
    if (last && standings.length >= 3) awards.push({ title: 'Participation Trophy', emoji: '🐢', playerId: last.id, detail: `${name(last.id)} kept it fun` });
    return awards.slice(0, 5);
  }

  private returnToLobby(): void {
    if (this.runner) {
      this.runner.finish();
      this.runner = null;
    }
    this.phase = 'lobby';
    this.phaseEndsAt = null;
    this.session = null;
    this.round = null;
    this.lastResults = null;
    for (const m of this.members.values()) {
      m.ready = m.isBot;
      m.spectator = false;
      m.score = 0;
      m.wins = 0;
      m.lastRank = 0;
    }
    if (this.isPublic && this.connectedHumans.length >= 2) {
      for (const m of [...this.members.values()]) if (m.isBot) this.removeMember(m.id, 'left');
    }
    this.deps.transport.toChannel(this.channel, 'game:reset', null);
    this.dirty();
  }

  // ---------------------------------------------------------------- loop

  step(): void {
    if (this.closed) return;
    const now = this.now();
    if (this.phase === 'playing' && this.runner) {
      this.runner.step();
      if (this.runner.ended) this.endRound();
    }
    if (this.phaseEndsAt != null && now >= this.phaseEndsAt) {
      if (this.phase === 'intro') this.beginPlaying();
      else if (this.phase === 'results') {
        if (this.settings.rules.hideScores) this.advanceFromStandings();
        else {
          for (const m of this.members.values()) m.ready = m.isBot;
          this.phase = 'standings';
          this.phaseEndsAt = now + TIMING.standings;
          this.dirty();
        }
      } else if (this.phase === 'standings') this.advanceFromStandings();
      else if (this.phase === 'final') this.returnToLobby();
    }
    if (this.isPublic && this.phase === 'lobby') this.checkAutoStart(now);
    this.cleanupMembers(now);
    if (this.stateDirty) {
      this.stateDirty = false;
      this.deps.transport.toChannel(this.channel, 'room:state', this.toState());
    }
  }

  private checkAutoStart(now: number) {
    const humans = this.connectedHumans;
    if (humans.length < 2) {
      if (this.autoStartAt != null) {
        this.autoStartAt = null;
        this.dirty();
      }
      return;
    }
    if (this.autoStartAt == null) {
      this.autoStartAt = now + TIMING.publicAutoStart;
      this.dirty();
    }
    if (humans.every((h) => h.ready) && this.autoStartAt > now + TIMING.publicReadyStart) {
      this.autoStartAt = now + TIMING.publicReadyStart;
      this.dirty();
    }
    if (now >= this.autoStartAt) {
      this.autoStartAt = null;
      this.startSession();
    }
  }

  private cleanupMembers(now: number) {
    for (const m of [...this.members.values()]) {
      if (m.isBot || m.connected || m.disconnectedAt == null) continue;
      const grace = this.phase === 'lobby' ? TIMING.lobbyDisconnectGrace : TIMING.sessionDisconnectGrace;
      if (now - m.disconnectedAt > grace) this.removeMember(m.id, 'timeout');
      else if (this.hostId === m.id && now - m.disconnectedAt > TIMING.hostMigrateAfter && this.connectedHumans.length) this.migrateHost();
    }
    if (this.connectedHumans.length === 0) {
      if (this.emptySince == null) this.emptySince = now;
    } else this.emptySince = null;
  }

  shouldClose(now: number): boolean {
    if (this.humans.length === 0) return true;
    return this.emptySince != null && now - this.emptySince > TIMING.emptyRoomTtl;
  }

  close(): void {
    for (const m of [...this.members.values()]) this.removeMember(m.id, 'closed');
    this.closed = true;
  }

  toState(): RoomState {
    const standings = this.session ? this.computeStandings() : [];
    this.standingsCache = standings;
    const members: RoomMember[] = [...this.members.values()].map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      level: m.level,
      title: m.title,
      isBot: m.isBot,
      isHost: m.id === this.hostId,
      ready: m.ready,
      connected: m.connected,
      status: !m.connected && !m.isBot
        ? 'disconnected'
        : m.spectator
          ? 'spectating'
          : this.phase === 'lobby'
            ? m.ready ? 'ready' : 'waiting'
            : this.phase === 'playing' || this.phase === 'intro'
              ? 'playing'
              : 'finished',
      team: m.team,
      score: m.score,
      roomScore: m.roomScore,
      wins: m.wins,
    }));
    return {
      code: this.code,
      isPublic: this.isPublic,
      hostId: this.hostId,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      settings: this.settings,
      members,
      round: this.round,
      standings,
      teamStandings: this.session && this.settings.teamMode !== 'off' ? this.computeTeamStandings() : [],
      autoStartAt: this.autoStartAt,
      sessionId: this.session?.id ?? null,
      serverNow: this.now(),
    };
  }

  activity(): string {
    if (this.phase === 'lobby') return 'In a lobby';
    if (this.round) return `Playing ${GAME_MAP[this.round.gameId]?.name ?? 'a game'}`;
    return 'At a party';
  }
}
