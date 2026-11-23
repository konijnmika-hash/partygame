// Tracks which users are online (connected sockets) and per-socket latency.
export class Presence {
  private byUser = new Map<string, Set<string>>();
  private rtts = new Map<string, number>();

  add(userId: string, socketId: string): void {
    let s = this.byUser.get(userId);
    if (!s) {
      s = new Set();
      this.byUser.set(userId, s);
    }
    s.add(socketId);
  }

  remove(userId: string, socketId: string): void {
    const s = this.byUser.get(userId);
    this.rtts.delete(socketId);
    if (!s) return;
    s.delete(socketId);
    if (s.size === 0) this.byUser.delete(userId);
  }

  isOnline(userId: string): boolean {
    return this.byUser.has(userId);
  }

  socketsOf(userId: string): string[] {
    return [...(this.byUser.get(userId) ?? [])];
  }

  count(): number {
    return this.byUser.size;
  }

  setRtt(socketId: string, ms: number): void {
    const prev = this.rtts.get(socketId);
    const v = Math.max(0, Math.min(2000, ms));
    this.rtts.set(socketId, prev == null ? v : prev * 0.7 + v * 0.3);
  }

  rttOf(socketId: string): number {
    return this.rtts.get(socketId) ?? 120;
  }
}
