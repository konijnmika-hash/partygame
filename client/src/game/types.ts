import type { GameMeta, InputFrame, RoomMember } from '@shared/types';

export interface GameViewProps<P = any, Q = any> {
  meta: GameMeta;
  pub: P;
  priv: Q;
  /** server time when the latest pub was sent */
  pubT: number;
  me: string;
  /** false for spectators */
  isPlayer: boolean;
  players: RoomMember[];
  player(id: string): RoomMember | undefined;
  send(action: Record<string, unknown>): void;
  input(frame: InputFrame): void;
  assets: Record<string, any>;
}
