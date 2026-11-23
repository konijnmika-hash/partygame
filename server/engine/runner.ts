import type { Difficulty, GameMeta, InputFrame } from '@shared/types';
import { createRng } from '@shared/rng';
import type { Perf } from '@shared/scoring';
import type { GameCtx, GameDef, GamePlayer, GameResults } from './types';

export interface Clock {
  now(): number;
}

export const realClock: Clock = { now: () => Date.now() };

/** Output channel of a runner (socket.io in production, a recorder in tests). */
export interface RunnerIO {
  pub(data: unknown, t: number): void;
  priv(pid: string, data: unknown): void;
  event(type: string, data: unknown, to: string[] | null): void;
  asset(key: string, data: unknown, to: string[] | null): void;
}

export interface RunnerOptions {
  clock: Clock;
  seed: number;
  difficulty: Difficulty;
  timeScale: number;
  io: RunnerIO;
  isConnected?: (pid: string) => boolean;
  rtt?: (pid: string) => number;
  onError?: (err: unknown, where: string) => void;
}

interface Timer {
  id: number;
  at: number;
  fn: () => void;
}

export const STEP_MS = 50;

export class GameRunner {
  readonly ctx: GameCtx;
  state: any;
  ended = false;
  startedAt = 0;
  private timers: Timer[] = [];
  private timerSeq = 1;
  private isDirty = true;
  private lastPub = '';
  private lastPriv = new Map<string, string>();
  private assets = new Map<string, unknown>();
  private actedSet = new Set<string>();
  private botNext = new Map<string, number>();
  private stepCount = 0;
  private lastStepAt = 0;
  private maxDurationMs: number;
  results: GameResults | null = null;

  constructor(
    readonly def: GameDef,
    readonly meta: GameMeta,
    readonly players: GamePlayer[],
    private opts: RunnerOptions,
  ) {
    const rng = createRng(opts.seed);
    const ids = players.map((p) => p.id);
    const teamCount = players.reduce((m, p) => (p.team != null ? Math.max(m, p.team + 1) : m), 0);
    const teams: string[][] = Array.from({ length: teamCount }, () => []);
    for (const p of players) if (p.team != null) teams[p.team].push(p.id);
    const byId = new Map(players.map((p) => [p.id, p]));
    const self = this;
    this.maxDurationMs = Math.max(90_000, meta.duration * 1000 * 3 + 60_000);
    this.ctx = {
      meta,
      players,
      ids,
      teams,
      rng,
      difficulty: opts.difficulty,
      timeScale: opts.timeScale,
      now: () => opts.clock.now(),
      elapsed: () => opts.clock.now() - self.startedAt,
      after(ms, fn) {
        const id = self.timerSeq++;
        self.timers.push({ id, at: opts.clock.now() + Math.max(0, ms), fn });
        return id;
      },
      cancel(id) {
        if (id == null) return;
        self.timers = self.timers.filter((t) => t.id !== id);
      },
      dirty: () => {
        self.isDirty = true;
      },
      event(type, data, to) {
        const list = to == null ? null : Array.isArray(to) ? to : [to];
        opts.io.event(type, data ?? null, list);
      },
      asset(key, data) {
        self.assets.set(key, data);
        opts.io.asset(key, data, null);
      },
      end: () => {
        if (!self.ended) self.finish();
      },
      isConnected: (pid) => (byId.get(pid)?.isBot ? true : opts.isConnected ? opts.isConnected(pid) : true),
      rtt: (pid) => (byId.get(pid)?.isBot ? 0 : opts.rtt ? opts.rtt(pid) : 0),
      player: (pid) => byId.get(pid),
      name: (pid) => byId.get(pid)?.name ?? '???',
      isPlayer: (pid) => byId.has(pid),
      acted: (pid) => self.actedSet.has(pid),
      markActed: (pid) => {
        self.actedSet.add(pid);
      },
      diff: (e, n, h) => (opts.difficulty === 'easy' ? e : opts.difficulty === 'hard' ? h : n),
      ms: (ms) => Math.round(ms * opts.timeScale),
    };
  }

  begin(): void {
    this.startedAt = this.opts.clock.now();
    this.lastStepAt = this.startedAt;
    this.state = this.guard('setup', () => this.def.setup(this.ctx));
    if (this.state == null) this.state = {};
    this.guard('start', () => this.def.start?.(this.state, this.ctx));
    this.isDirty = true;
    this.flush(true);
  }

  /** Advance timers, realtime tick, bots; flush views. Called every STEP_MS. */
  step(): void {
    if (this.ended) return;
    const now = this.opts.clock.now();
    const dt = Math.min(0.25, Math.max(0, (now - this.lastStepAt) / 1000));
    this.lastStepAt = now;
    this.stepCount++;
    // timers (allow timers scheduled during execution)
    let guardLoops = 0;
    while (!this.ended && guardLoops++ < 1000) {
      let idx = -1;
      let best = Infinity;
      for (let i = 0; i < this.timers.length; i++) {
        if (this.timers[i].at <= now && this.timers[i].at < best) {
          best = this.timers[i].at;
          idx = i;
        }
      }
      if (idx < 0) break;
      const t = this.timers[idx];
      this.timers.splice(idx, 1);
      this.guard('timer', t.fn);
      this.isDirty = true;
    }
    if (this.ended) return;
    if (this.def.tick) {
      this.guard('tick', () => this.def.tick!(this.state, this.ctx, dt));
      this.isDirty = true;
    }
    if (this.ended) return;
    this.runBots(now);
    if (this.ended) return;
    if (now - this.startedAt > this.maxDurationMs) {
      this.finish();
      return;
    }
    const every = this.def.pubEvery ?? 1;
    this.flush(!this.def.realtime || this.stepCount % every === 0);
  }

  private runBots(now: number) {
    if (!this.def.bot) return;
    const [lo, hi] = this.def.botDelay ?? [450, 1300];
    for (const p of this.players) {
      if (!p.isBot) continue;
      const next = this.botNext.get(p.id) ?? now + lo;
      if (now < next) {
        if (!this.botNext.has(p.id)) this.botNext.set(p.id, next);
        continue;
      }
      this.botNext.set(p.id, now + lo + Math.random() * (hi - lo));
      const move = this.guard('bot', () => this.def.bot!(this.state, this.ctx, p.id));
      if (!move) continue;
      if ('action' in move) this.handleAction(p.id, move.action);
      else if ('input' in move) this.handleInput(p.id, move.input);
      if (this.ended) return;
    }
  }

  handleAction(pid: string, action: unknown): void {
    if (this.ended || !this.def.action || !this.ctx.isPlayer(pid)) return;
    if (action == null || typeof action !== 'object') return;
    this.guard('action', () => this.def.action!(this.state, this.ctx, pid, action));
    this.isDirty = true;
  }

  handleInput(pid: string, f: InputFrame): void {
    if (this.ended || !this.def.input || !this.ctx.isPlayer(pid)) return;
    const frame: InputFrame = {
      x: clampAxis(f.x),
      y: clampAxis(f.y),
      b: Number.isInteger(f.b) ? f.b & 0xff : 0,
    };
    if (frame.x !== 0 || frame.y !== 0 || frame.b !== 0) this.actedSet.add(pid);
    this.guard('input', () => this.def.input!(this.state, this.ctx, pid, frame));
  }

  /** Re-send current views + assets to a (re)joining socket. */
  resync(pid: string, send: (kind: 'pub' | 'priv' | 'asset', a: unknown, b?: unknown) => void): void {
    if (!this.state) return;
    for (const [k, v] of this.assets) send('asset', k, v);
    const pub = this.guard('pub', () => this.def.pub(this.state, this.ctx));
    send('pub', pub, this.opts.clock.now());
    if (this.def.priv && this.ctx.isPlayer(pid)) {
      const priv = this.guard('priv', () => this.def.priv!(this.state, this.ctx, pid));
      send('priv', priv ?? null);
    }
    if (this.ctx.isPlayer(pid)) this.guard('rejoin', () => this.def.rejoin?.(this.state, this.ctx, pid));
  }

  playerLeft(pid: string): void {
    if (!this.ended && this.ctx.isPlayer(pid)) this.guard('leave', () => this.def.leave?.(this.state, this.ctx, pid));
  }

  flush(sendPub = true): void {
    if (!this.state) return;
    if (!this.isDirty && !this.def.realtime) return;
    this.isDirty = false;
    if (sendPub) {
      const pub = this.guard('pub', () => this.def.pub(this.state, this.ctx));
      const str = JSON.stringify(pub ?? null);
      if (str !== this.lastPub || this.def.realtime) {
        this.lastPub = str;
        this.opts.io.pub(pub ?? null, this.opts.clock.now());
      }
    }
    if (this.def.priv) {
      for (const p of this.players) {
        if (p.isBot) continue;
        const priv = this.guard('priv', () => this.def.priv!(this.state, this.ctx, p.id));
        const str = JSON.stringify(priv ?? null);
        if (this.lastPriv.get(p.id) !== str) {
          this.lastPriv.set(p.id, str);
          this.opts.io.priv(p.id, priv ?? null);
        }
      }
    }
  }

  finish(): void {
    if (this.ended) return;
    this.flush(true);
    this.ended = true;
    this.timers = [];
    let res = this.guard('results', () => this.def.results(this.state, this.ctx));
    if (!res || !res.perfs) res = { perfs: {} };
    const perfs: Record<string, Perf> = {};
    for (const p of this.players) {
      const r = res.perfs[p.id];
      perfs[p.id] = r
        ? { ...r, score: Number.isFinite(r.score) ? r.score : 0, perf: Number.isFinite(r.perf) ? r.perf : 0 }
        : { score: 0, perf: 0, participated: false };
    }
    res.perfs = perfs;
    this.results = res;
  }

  private guard<T>(where: string, fn: () => T): T {
    try {
      return fn();
    } catch (err) {
      if (this.opts.onError) this.opts.onError(err, `${this.def.id}:${where}`);
      else console.error(`[game ${this.def.id}] error in ${where}`, err);
      return undefined as T;
    }
  }
}

function clampAxis(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(-1, Math.min(1, Math.round(n * 100) / 100));
}
