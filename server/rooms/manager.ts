// Owns all rooms, user->room membership, room codes, public matchmaking and the global tick loop.
import { randomInt } from '../util/rand';
import type { PublicProfile, PublicRoomInfo, RoomSettings } from '@shared/types';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, normalizeRoomCode } from '@shared/validation';
import { STEP_MS } from '../engine/runner';
import { Room, type RoomDeps } from './room';

export type ManagerDeps = Omit<RoomDeps, 'onMembership'> & { maxRooms?: number };

export class RoomManager {
  rooms = new Map<string, Room>();
  private userRoom = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;
  private roomDeps: RoomDeps;

  constructor(private deps: ManagerDeps) {
    this.roomDeps = {
      ...deps,
      onMembership: (userId, code) => {
        if (code) this.userRoom.set(userId, code);
        else if (this.userRoom.get(userId) && !this.rooms.get(this.userRoom.get(userId)!)?.members.has(userId)) this.userRoom.delete(userId);
      },
    };
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.step(), STEP_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  step(): void {
    const now = this.deps.clock.now();
    for (const room of [...this.rooms.values()]) {
      try {
        room.step();
      } catch (err) {
        (this.deps.log ?? console.error)(`room ${room.code} step failed`, err);
      }
      if (room.shouldClose(now)) this.closeRoom(room);
    }
  }

  private closeRoom(room: Room) {
    room.close();
    this.rooms.delete(room.code);
    for (const [u, c] of this.userRoom) if (c === room.code) this.userRoom.delete(u);
  }

  private newCode(): string {
    for (let i = 0; i < 1000; i++) {
      let c = '';
      for (let k = 0; k < ROOM_CODE_LENGTH; k++) c += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(c)) return c;
    }
    throw new Error('No room codes available');
  }

  roomOf(userId: string): Room | undefined {
    const code = this.userRoom.get(userId);
    if (!code) return undefined;
    const room = this.rooms.get(code);
    if (!room || !room.members.has(userId)) {
      this.userRoom.delete(userId);
      return undefined;
    }
    return room;
  }

  create(user: PublicProfile, settings: Partial<RoomSettings> | null, isPublic = false, code?: string): Room | string {
    if (this.rooms.size >= (this.deps.maxRooms ?? 2000)) return 'Servers are full right now, try again soon';
    this.leave(user.id);
    const room = new Room(code && !this.rooms.has(code) ? code : this.newCode(), isPublic, this.roomDeps, settings);
    this.rooms.set(room.code, room);
    room.addHuman(user);
    return room;
  }

  join(user: PublicProfile, rawCode: unknown): Room | string {
    const code = normalizeRoomCode(rawCode);
    if (!code) return 'Room codes are 4 letters';
    const room = this.rooms.get(code);
    if (!room || room.closed) return 'Room not found — check the code!';
    if (room.isBanned(user.id)) return 'You were kicked from this room';
    if (room.members.has(user.id)) {
      room.addHuman(user);
      return room;
    }
    if (room.isFull() && ![...room.members.values()].some((m) => m.isBot)) return 'That room is full';
    this.leave(user.id);
    if (!room.addHuman(user)) return 'That room is full';
    return room;
  }

  leave(userId: string): void {
    const room = this.roomOf(userId);
    if (!room) return;
    room.removeMember(userId, 'left');
    this.userRoom.delete(userId);
    if (room.shouldClose(this.deps.clock.now())) this.closeRoom(room);
  }

  /** Public matchmaking: prefer lobbies about to start, then running parties with space. */
  quickMatch(user: PublicProfile): Room | string {
    const current = this.roomOf(user.id);
    if (current?.isPublic) return current;
    const candidates = [...this.rooms.values()].filter((r) => r.isPublic && !r.closed && !r.isFull() && !r.isBanned(user.id));
    const score = (r: Room) => (r.phase === 'lobby' ? 1000 : 0) + r.connectedHumans.length * 10 - (r.phase === 'final' ? 5 : 0);
    candidates.sort((a, b) => score(b) - score(a));
    const best = candidates.find((r) => r.connectedHumans.length > 0);
    if (best) return this.join(user, best.code);
    return this.create(user, null, true);
  }

  publicRooms(): PublicRoomInfo[] {
    return [...this.rooms.values()]
      .filter((r) => r.isPublic && r.connectedHumans.length > 0)
      .map((r) => ({ code: r.code, players: r.size, maxPlayers: r.settings.maxPlayers, phase: r.phase, hostName: r.connectedHumans[0]?.name ?? 'Bloop Bash' }))
      .slice(0, 30);
  }

  activityOf(userId: string): { activity: string; roomCode: string | null } {
    const room = this.roomOf(userId);
    if (!room) return { activity: 'Online', roomCode: null };
    return { activity: room.activity(), roomCode: room.isPublic ? null : room.code };
  }

  stats(): { rooms: number; players: number } {
    let players = 0;
    for (const r of this.rooms.values()) players += r.connectedHumans.length;
    return { rooms: this.rooms.size, players };
  }

  shutdown(): void {
    this.stop();
    for (const r of [...this.rooms.values()]) this.closeRoom(r);
  }
}
