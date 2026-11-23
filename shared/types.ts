// Shared domain + protocol types for Bloop Bash (client <-> server).

export type CategoryId =
  | 'drawing' | 'reaction' | 'social' | 'physics' | 'racing' | 'memory'
  | 'puzzle' | 'team' | 'weird' | 'arcade';

export type Control =
  | 'tap' | 'swipe' | 'drag' | 'draw' | 'type' | 'joystick' | 'keys' | 'vote' | 'mic' | 'hold' | 'tilt' | 'numpad';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface GameMeta {
  id: string;
  name: string;
  category: CategoryId;
  emoji: string;
  tagline: string;
  instructions: string[];
  controls: Control[];
  minPlayers: number;
  maxPlayers: number;
  /** typical duration in seconds (used for planning + UI) */
  duration: number;
  /** team game: players are split into teams automatically */
  teams?: boolean;
  /** realtime model: arena = server physics broadcast, ghost = deterministic per-player sim */
  realtime?: 'arena' | 'ghost';
  orientation?: 'any' | 'landscape';
  needsSound?: boolean;
  mic?: 'optional';
  /** true for the 50+ original games invented for Bloop Bash */
  original?: boolean;
  tags?: string[];
}

export interface Avatar {
  color: string;
  eyes: string;
  mouth: string;
  hat: string;
  acc: string;
}

export interface PublicProfile {
  id: string;
  name: string;
  avatar: Avatar;
  level: number;
  title: string;
}

export interface UserSettings {
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  sfxMuted: boolean;
  musicMuted: boolean;
  reducedMotion: boolean;
  haptics: boolean;
  lastRoomSettings?: Partial<RoomSettings>;
}

export interface MyProfile extends PublicProfile {
  username: string;
  registered: boolean;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  unlocked: string[]; // cosmetic + title ids
  achievements: { id: string; at: number }[];
  settings: UserSettings;
  stats: UserStats;
  createdAt: number;
}

export interface UserStats {
  roundsPlayed: number;
  roundsWon: number;
  sessionsPlayed: number;
  sessionsWon: number;
  totalPoints: number;
  bestRound: number;
  perfectRounds: number;
  roundStreak: number;
  bestRoundStreak: number;
  sessionStreak: number;
  bestSessionStreak: number;
  gamesHosted: number;
  distinctGames: number;
}

export type MemberStatus = 'waiting' | 'ready' | 'playing' | 'finished' | 'spectating' | 'disconnected';

export interface RoomMember extends PublicProfile {
  isBot: boolean;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  status: MemberStatus;
  team: number | null;
  /** points in the current session */
  score: number;
  /** points accumulated in this room across sessions */
  roomScore: number;
  wins: number;
}

export type TeamMode = 'off' | 'teams2' | 'teams3';

export interface RoomRules {
  doubleFinal: boolean;
  speedMode: boolean;
  hideScores: boolean;
  underdog: boolean;
}

export interface RoomSettings {
  rounds: number;
  mode: 'random' | 'categories' | 'playlist';
  categories: CategoryId[];
  playlist: string[];
  difficulty: Difficulty;
  teamMode: TeamMode;
  allowRepeats: boolean;
  maxPlayers: number;
  rules: RoomRules;
}

export type RoomPhase = 'lobby' | 'intro' | 'playing' | 'results' | 'standings' | 'final';

export interface RoundInfo {
  index: number; // 0-based
  total: number;
  gameId: string;
  multiplier: number;
}

export interface Standing {
  id: string;
  points: number;
  rank: number;
  delta: number;
}

export interface TeamStanding {
  team: number;
  points: number;
  rank: number;
}

export interface RoomState {
  code: string;
  isPublic: boolean;
  hostId: string | null;
  phase: RoomPhase;
  phaseEndsAt: number | null;
  settings: RoomSettings;
  members: RoomMember[];
  round: RoundInfo | null;
  standings: Standing[];
  teamStandings: TeamStanding[];
  autoStartAt: number | null;
  sessionId: string | null;
  serverNow: number;
}

export interface BreakdownLine {
  label: string;
  pts: number;
}

export interface RoundResultPlayer {
  id: string;
  points: number; // base 0..1000
  sessionPoints: number; // after multipliers
  rank: number;
  breakdown: BreakdownLine[];
  highlight?: string;
  xp?: number;
}

export interface RoundResults {
  gameId: string;
  index: number;
  multiplier: number;
  players: RoundResultPlayer[];
  teams?: TeamStanding[];
  summary: string[];
}

export interface Award {
  title: string;
  emoji: string;
  playerId: string;
  detail: string;
}

export interface FinalResults {
  sessionId: string;
  standings: { id: string; points: number; rank: number; wins: number }[];
  teams?: TeamStanding[];
  awards: Award[];
  rounds: { gameId: string; winnerId: string | null }[];
}

export interface ProgressUpdate {
  xpGained: number;
  level: number;
  leveledUp: boolean;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  achievements: string[];
  unlocks: string[];
  records: { gameId: string; label: string; value: string }[];
}

export interface ChatMessage {
  id: string;
  from: string; // user id or 'system'
  name: string;
  text: string;
  at: number;
}

export interface PublicRoomInfo {
  code: string;
  players: number;
  maxPlayers: number;
  phase: RoomPhase;
  hostName: string;
}

export interface LeaderboardRow {
  rank: number;
  id: string;
  name: string;
  avatar: Avatar;
  level: number;
  title: string;
  points: number;
  wins: number;
  rounds: number;
  isMe?: boolean;
  online?: boolean;
}

export type LeaderboardScope = 'daily' | 'weekly' | 'alltime' | 'friends';

export interface FriendInfo extends PublicProfile {
  online: boolean;
  activity: string; // 'online' | 'in lobby' | 'playing X'
  roomCode: string | null;
  status: 'friends' | 'incoming' | 'outgoing';
}

/** Input frame for realtime games: joystick axes (-1..1) and button bitmask. */
export interface InputFrame {
  x: number;
  y: number;
  b: number; // bit0 = A (action/jump), bit1 = B (secondary)
}

// ---- Socket protocol ----

export interface Ack<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface ClientToServerEvents {
  'room:create': (settings: Partial<RoomSettings> | null, ack: (r: Ack<{ code: string }>) => void) => void;
  'room:join': (code: string, ack: (r: Ack<{ code: string }>) => void) => void;
  'room:leave': (ack?: (r: Ack) => void) => void;
  'room:ready': (ready: boolean) => void;
  'room:settings': (patch: Partial<RoomSettings>, ack?: (r: Ack) => void) => void;
  'room:start': (ack?: (r: Ack) => void) => void;
  'room:kick': (userId: string) => void;
  'room:bot': (op: 'add' | 'remove') => void;
  'room:team': (team: number) => void;
  'room:skip': () => void;
  'room:lobby': () => void;
  'room:again': () => void;
  'room:soloBots': () => void;
  'match:quick': (ack: (r: Ack<{ code: string }>) => void) => void;
  'chat:send': (text: string) => void;
  'emote': (emote: string) => void;
  'game:action': (action: unknown) => void;
  'game:input': (frame: [number, number, number] | [number, number, number, number]) => void;
  'game:sync': () => void;
  'time:ping': (clientTime: number, ack: (serverTime: number) => void) => void;
  'presence:list': (ack: (r: Ack<{ online: number; rooms: PublicRoomInfo[] }>) => void) => void;
  'friend:invite': (friendId: string) => void;
}

export interface GameEventMsg {
  type: string;
  data?: unknown;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:left': (reason: string) => void;
  'room:results': (results: RoundResults) => void;
  'room:final': (results: FinalResults) => void;
  'game:pub': (pub: unknown, t: number) => void;
  'game:priv': (priv: unknown) => void;
  'game:event': (ev: GameEventMsg) => void;
  'game:asset': (key: string, data: unknown) => void;
  'game:reset': (gameId: string | null) => void;
  'chat': (msg: ChatMessage) => void;
  'chat:history': (msgs: ChatMessage[]) => void;
  'emote': (from: string, emote: string) => void;
  'progress': (p: ProgressUpdate) => void;
  'toast': (t: { kind: 'info' | 'error' | 'success'; text: string }) => void;
  'presence': (p: { online: number }) => void;
  'friends:update': () => void;
  'sping': (serverTime: number, ack: () => void) => void;
  'invite': (inv: { from: string; code: string }) => void;
}
