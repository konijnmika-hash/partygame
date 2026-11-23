// Token-bucket rate limiting for sockets and HTTP routes.
import type { NextFunction, Request, Response } from 'express';

export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(private capacity: number, private perSec: number, now = Date.now()) {
    this.tokens = capacity;
    this.last = now;
  }
  take(n = 1, now = Date.now()): boolean {
    const elapsed = (now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.perSec);
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

export class KeyedLimiter {
  private buckets = new Map<string, { b: TokenBucket; seen: number }>();
  constructor(private capacity: number, private perSec: number) {}
  take(key: string, n = 1): boolean {
    const now = Date.now();
    let e = this.buckets.get(key);
    if (!e) {
      e = { b: new TokenBucket(this.capacity, this.perSec, now), seen: now };
      this.buckets.set(key, e);
      if (this.buckets.size > 50_000) this.sweep(now);
    }
    e.seen = now;
    return e.b.take(n, now);
  }
  sweep(now = Date.now()): void {
    for (const [k, v] of this.buckets) if (now - v.seen > 10 * 60_000) this.buckets.delete(k);
  }
}

export function clientIp(req: Request): string {
  return (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '');
}

/** Express middleware: `capacity` requests burst, refilling at `perMin` per minute. */
export function httpLimit(capacity: number, perMin: number, keyFn: (req: Request) => string = clientIp) {
  const lim = new KeyedLimiter(capacity, perMin / 60);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!lim.take(keyFn(req))) {
      res.status(429).json({ ok: false, error: 'Too many requests — slow down a little!' });
      return;
    }
    next();
  };
}
