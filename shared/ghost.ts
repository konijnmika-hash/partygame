// "Ghost" games: every player runs their own deterministic simulation (same world, no contact).
// The client predicts its own sim instantly; the server re-simulates from timestamped inputs
// (with rewind) and is authoritative for scoring. Other players are shown as ghosts.
import type { Difficulty, InputFrame } from './types';

/** Quantized input: x,y in -8..8, b = button bits */
export type GInput = [number, number, number];

export const NO_INPUT: GInput = [0, 0, 0];

export interface GhostDef<W, S> {
  id: string;
  /** simulation ticks per second */
  hz: number;
  /** length of the run in ticks (hard cap) */
  maxTicks: number;
  world(seed: number, difficulty: Difficulty): W;
  init(w: W, index: number, count: number): S;
  /** advance one tick; mutate s in place. `prev` is the previous tick's input (edge detection). */
  step(w: W, s: S, input: GInput, prev: GInput, tick: number): void;
  done(w: W, s: S, tick: number): boolean;
}

export function quantize(f: InputFrame): GInput {
  return [Math.round(clamp(f.x) * 8), Math.round(clamp(f.y) * 8), (f.b | 0) & 0xff];
}

export function inputEq(a: GInput, b: GInput): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function pressed(i: GInput, prev: GInput, bit = 1): boolean {
  return (i[2] & bit) !== 0 && (prev[2] & bit) === 0;
}

export function held(i: GInput, bit = 1): boolean {
  return (i[2] & bit) !== 0;
}

export function cloneState<S>(s: S): S {
  return JSON.parse(JSON.stringify(s));
}

function clamp(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/** Input timeline used by both server (authoritative) and client (prediction). */
export class InputTimeline {
  list: { k: number; i: GInput }[] = [];
  set(k: number, i: GInput): void {
    // drop any future entries at or after k for simplicity (latest wins), keep order
    let idx = this.list.length;
    while (idx > 0 && this.list[idx - 1].k > k) idx--;
    if (idx > 0 && this.list[idx - 1].k === k) this.list[idx - 1].i = i;
    else this.list.splice(idx, 0, { k, i });
  }
  at(k: number): GInput {
    let lo = 0;
    let hi = this.list.length - 1;
    let ans: GInput = NO_INPUT;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.list[mid].k <= k) {
        ans = this.list[mid].i;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }
  prune(beforeK: number): void {
    // keep the last entry before beforeK as base
    let idx = 0;
    while (idx + 1 < this.list.length && this.list[idx + 1].k <= beforeK) idx++;
    if (idx > 0) this.list.splice(0, idx);
  }
}

/** A rewindable simulation for one player. */
export class GhostSim<W, S> {
  tick = 0;
  state: S;
  doneAt: number | null = null;
  readonly inputs = new InputTimeline();
  private snaps: (S | null)[];

  constructor(
    readonly def: GhostDef<W, S>,
    readonly world: W,
    index: number,
    count: number,
    readonly window = 60,
  ) {
    this.state = def.init(world, index, count);
    this.snaps = new Array(window).fill(null);
  }

  advanceTo(target: number): void {
    target = Math.min(target, this.def.maxTicks);
    while (this.tick < target && this.doneAt == null) {
      this.snaps[this.tick % this.window] = cloneState(this.state);
      const i = this.inputs.at(this.tick);
      const prev = this.tick > 0 ? this.inputs.at(this.tick - 1) : NO_INPUT;
      this.def.step(this.world, this.state, i, prev, this.tick);
      this.tick++;
      if (this.def.done(this.world, this.state, this.tick)) this.doneAt = this.tick;
    }
    if (this.tick >= this.def.maxTicks && this.doneAt == null) this.doneAt = this.tick;
  }

  /** Oldest tick we can still rewind to. */
  get oldest(): number {
    return Math.max(0, this.tick - this.window + 1);
  }

  /** Apply an input that takes effect from tick k; rewinds + re-simulates if k is in the past. */
  applyInput(k: number, i: GInput): number {
    k = Math.max(this.oldest, k);
    const prevTick = this.tick;
    this.inputs.set(k, i);
    if (k < this.tick) {
      const snap = this.snaps[k % this.window];
      if (snap) {
        this.state = cloneState(snap);
        this.tick = k;
        if (this.doneAt != null && this.doneAt > k) this.doneAt = null;
        this.advanceTo(prevTick);
      }
    }
    this.inputs.prune(this.oldest - 1);
    return k;
  }

  /** Replace state at tick k (client reconciliation) and re-simulate to the current tick. */
  reconcile(k: number, s: S, done: boolean): void {
    const cur = this.tick;
    this.state = cloneState(s);
    this.tick = k;
    this.doneAt = done ? k : null;
    if (!done) this.advanceTo(cur);
  }

  snapshotAt(k: number): S | null {
    if (k === this.tick) return this.state;
    if (k < this.oldest || k > this.tick) return null;
    return this.snaps[k % this.window];
  }
}
