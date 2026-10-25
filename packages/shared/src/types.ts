import type { ChefFace, StationId } from './kitchen.js';

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
  face: ChefFace;
  x: number;
  y: number;
  score: number;
  connected: boolean;
}

// ------------------------------------------------------------------ Sizzle Scramble snapshot

export interface ChefWork {
  station: StationId;
  ingredient: string;
  /** 0..1 */
  progress: number;
  /** ms since the last counted gesture (drives the station animation). */
  sinceRep: number;
}

export interface ChefSnap {
  id: string;
  nickname: string;
  color: string;
  face: ChefFace;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  connected: boolean;
  score: number;
  served: number;
  recipeId: string;
  /** Ingredient ids already made for the current recipe. */
  have: string[];
  working: ChefWork | null;
  /** Station (or the pass) the chef is standing at. */
  near: StationId | 'pass' | null;
}

export type KitchenEvent =
  | { type: 'rep'; chef: string; station: StationId; good: boolean }
  | { type: 'made'; chef: string; station: StationId; ingredient: string }
  | { type: 'served'; chef: string; recipeId: string; points: number; fast: boolean }
  | { type: 'rush' };

export interface GameSnapshot {
  tick: number;
  phase: GamePhase;
  /** Server wall-clock time (ms) when the snapshot was produced. Used for interpolation. */
  serverTime: number;
  /** Remaining round time; equals the full duration during countdown. */
  timeLeftMs: number;
  /** Remaining countdown time; 0 outside the countdown phase. */
  countdownMs: number;
  /** Final stretch: double points. */
  rush: boolean;
  chefs: ChefSnap[];
  events: KitchenEvent[];
}

/** Private per-phone status (sent only to that player's socket). */
export interface KitchenStatus {
  recipeId: string;
  have: string[];
  working: ChefWork | null;
  near: StationId | 'pass' | null;
  /** Can press INTERACT right now (standing at a station the recipe needs). */
  canInteract: boolean;
  /** Can press SEND right now (all four made and standing at the pass). */
  canServe: boolean;
  score: number;
  served: number;
  rank: number;
  timeLeftMs: number;
  rush: boolean;
}

export interface ChefResult {
  id: string;
  nickname: string;
  color: string;
  face: ChefFace;
  placement: number;
  score: number;
  served: number;
  /** Fastest dish, ms from ticket to serve (null if none). */
  fastestMs: number | null;
  favoriteStation: StationId | null;
  gestures: number;
  oops: number;
}

export interface MatchResults {
  round: number;
  durationMs: number;
  winnerIds: string[];
  results: ChefResult[];
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
  | 'COLOR_TAKEN'
  | 'RATE_LIMITED'
  /** Client-side only: the server did not acknowledge in time. */
  | 'TIMEOUT';

export interface ServerError {
  code: ErrorCode;
  message: string;
}

export type AckResult<T extends object> = ({ ok: true } & T) | { ok: false; error: ServerError };
export type Ack<T extends object> = (result: AckResult<T>) => void;
