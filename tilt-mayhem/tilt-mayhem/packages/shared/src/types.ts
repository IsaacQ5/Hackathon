export type GamePhase = 'lobby' | 'countdown' | 'playing' | 'results';

export type Role = 'host' | 'player';

/** Normalized movement input. x and y are in [-1, 1]. */
export interface PlayerInput {
  seq: number;
  x: number;
  y: number;
}

/** Player state that is safe to send to every client in the room. */
export interface PublicPlayer {
  id: string;
  nickname: string;
  color: string;
  x: number;
  y: number;
  score: number;
  connected: boolean;
}

export interface Collectible {
  id: number;
  x: number;
  y: number;
  value: number;
}

/** One-off visual events (e.g. a pickup) carried in the snapshot of the tick they happened. */
export interface PickupEvent {
  type: 'pickup';
  playerId: string;
  x: number;
  y: number;
  value: number;
}

export interface GameSnapshot {
  tick: number;
  phase: GamePhase;
  /** Server wall-clock time (ms) when the snapshot was produced. Used for interpolation. */
  serverTime: number;
  players: PublicPlayer[];
  collectibles: Collectible[];
  /** Remaining round time; equals the full duration during countdown. */
  timeLeftMs: number;
  /** Remaining countdown time; 0 outside the countdown phase. */
  countdownMs: number;
  events: PickupEvent[];
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  nickname: string;
  color: string;
  score: number;
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  round: number;
  hostConnected: boolean;
  minPlayers: number;
  maxPlayers: number;
  players: PublicPlayer[];
}

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'INVALID_INPUT'
  | 'INVALID_NICKNAME'
  | 'INVALID_SESSION'
  | 'NOT_HOST'
  | 'INVALID_PHASE'
  | 'NOT_ENOUGH_PLAYERS'
  | 'RATE_LIMITED'
  /** Client-side only: the server did not acknowledge in time. */
  | 'TIMEOUT';

export interface ServerError {
  code: ErrorCode;
  message: string;
}

export type AckResult<T extends object> = ({ ok: true } & T) | { ok: false; error: ServerError };
export type Ack<T extends object> = (result: AckResult<T>) => void;
