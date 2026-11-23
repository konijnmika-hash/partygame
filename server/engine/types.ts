import type { Difficulty, GameMeta, InputFrame } from '@shared/types';
import type { Rng } from '@shared/rng';
import type { Perf } from '@shared/scoring';

export interface GamePlayer {
  id: string;
  name: string;
  isBot: boolean;
  team: number | null;
  color: string; // avatar colour (hex) for rendering hints
  index: number;
}

export interface GameCtx {
  readonly meta: GameMeta;
  readonly players: GamePlayer[];
  readonly ids: string[];
  /** team index -> member ids (only for team games / team mode) */
  readonly teams: string[][];
  readonly rng: Rng;
  readonly difficulty: Difficulty;
  /** 1 normally, <1 in speed mode: multiply durations by this */
  readonly timeScale: number;
  /** absolute server time in ms (same base the clients sync to) */
  now(): number;
  /** ms since the game started */
  elapsed(): number;
  after(ms: number, fn: () => void): number;
  cancel(id: number | null | undefined): void;
  dirty(): void;
  event(type: string, data?: unknown, to?: string | string[]): void;
  asset(key: string, data: unknown): void;
  end(): void;
  isConnected(pid: string): boolean;
  /** smoothed round-trip time in ms for a player (bots: 0) */
  rtt(pid: string): number;
  player(pid: string): GamePlayer | undefined;
  name(pid: string): string;
  isPlayer(pid: string): boolean;
  /** true once the player has sent any accepted action/input */
  acted(pid: string): boolean;
  markActed(pid: string): void;
  /** scales difficulty-dependent values: easy/normal/hard */
  diff<T>(easy: T, normal: T, hard: T): T;
  /** scaled duration helper: ms * timeScale */
  ms(ms: number): number;
}

export type BotMove = { action: unknown } | { input: InputFrame } | null | undefined | void;

export interface RecordEntry {
  key: string;
  label: string;
  value: number;
  better: 'lower' | 'higher';
  format?: 'ms' | 'int' | 'pct' | 'sec';
}

export interface GameResults {
  perfs: Record<string, Perf>;
  summary?: string[];
  /** personal-record candidates per player */
  records?: Record<string, RecordEntry[]>;
  /** per-player numeric stats used for achievements (e.g. bestReactionMs) */
  stats?: Record<string, Record<string, number>>;
  teamScores?: Record<number, number>;
}

export interface GameDef<S = any> {
  id: string;
  /** realtime games get tick() every server step (50 ms) */
  realtime?: boolean;
  /** broadcast pub every N steps while realtime (default 1) */
  pubEvery?: number;
  setup(ctx: GameCtx): S;
  start?(s: S, ctx: GameCtx): void;
  action?(s: S, ctx: GameCtx, pid: string, a: any): void;
  input?(s: S, ctx: GameCtx, pid: string, f: InputFrame): void;
  tick?(s: S, ctx: GameCtx, dt: number): void;
  pub(s: S, ctx: GameCtx): unknown;
  priv?(s: S, ctx: GameCtx, pid: string): unknown;
  results(s: S, ctx: GameCtx): GameResults;
  bot?(s: S, ctx: GameCtx, pid: string): BotMove;
  /** ms range between bot decisions */
  botDelay?: [number, number];
  /** called when a participant reconnects (resend custom data) */
  rejoin?(s: S, ctx: GameCtx, pid: string): void;
  /** called when a participant disconnects */
  leave?(s: S, ctx: GameCtx, pid: string): void;
}

export function defineGame<S>(def: GameDef<S>): GameDef<S> {
  return def;
}
