import type { ChefFace, StationId } from './kitchen.js';
import type { ChaosLevel, MapId } from './maps.js';

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
  /** Good gestures this station needs (the server's number, so every phone agrees). */
  need: number;
  /** ms since the last counted gesture (drives the station animation). */
  sinceRep: number;
}

// ------------------------------------------------------------------ kitchen chaos (environmental hazards)

/** `gust` is the themed maps' own event (wave / airlock / monsoon / blizzard): it slides every walking chef sideways. */
export type HazardKind =
  | 'spill'
  | 'chicken'
  | 'fire'
  | 'meteor'
  | 'cheese'
  | 'gust'
  // each map's own special event (MapDef.special)
  | 'sprinkler'
  | 'kraken'
  | 'lowgrav'
  | 'quicksand'
  | 'freeze';

/** What a chef has to do with their phone before they can move again. */
export type StuckKind = 'slip' | 'bonk' | 'feathers' | 'fire';

export interface ChefStuck {
  kind: StuckKind;
  /** 0..1 */
  progress: number;
}

export interface HazardSnap {
  id: number;
  kind: HazardKind;
  /** Centre (meteor: impact point; cheese: current x and lane y; fire: the station). */
  x: number;
  y: number;
  /** Radius of effect. */
  r: number;
  /** ms until it lands / starts rolling; > 0 means "warning" on the big screen. */
  warnMs: number;
  /** Fire only. */
  station: StationId | null;
  /** 0..1 how much has been cleaned / put out. */
  progress: number;
  /** Direction of travel (chicken, cheese, gust): -1 left, 1 right. */
  dir: number;
  /** Landed meteor / slammed tentacle: ms left on the floor; gust, sprinkler, low gravity, freeze: ms left blowing; quicksand: ms left. */
  ttl: number;
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
  /** Knocked down / slipped / feathered / fighting a fire. */
  stuck: ChefStuck | null;
}

export type KitchenEvent =
  | { type: 'rep'; chef: string; station: StationId; good: boolean }
  | { type: 'made'; chef: string; station: StationId; ingredient: string }
  | { type: 'served'; chef: string; recipeId: string; points: number; fast: boolean }
  | { type: 'rush' }
  /** A hazard appeared (meteor/cheese start their warning now). */
  | { type: 'hazard'; kind: HazardKind; x: number; y: number; station: StationId | null }
  /** Meteor landed / cheese started rolling. */
  | { type: 'impact'; kind: HazardKind; x: number; y: number }
  | { type: 'stuck'; chef: string; kind: StuckKind }
  | { type: 'recovered'; chef: string; kind: StuckKind }
  /** One chef shoved another (they slide away from the pusher). */
  | { type: 'push'; chef: string; target: string }
  /** A chef dropped through a trapdoor and popped out of the other one. */
  | { type: 'hatch'; chef: string; from: { x: number; y: number }; to: { x: number; y: number } };

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
  hazards: HazardSnap[];
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
  /** The station you're standing at is on fire (INTERACT starts fanning it out). */
  fireHere: boolean;
  /** Your phone is taken over until you do the recovery motion. */
  stuck: ChefStuck | null;
  /** Lobby apartment: standing on the wardrobe rug (the phone shows the look picker). */
  atWardrobe: boolean;
  /** ms until you can push again (0 = ready). */
  pushReadyInMs: number;
  /** Someone just shoved you (shown for a few seconds): who, and whether it knocked you off your station. */
  pushedBy: { name: string; offStation: boolean } | null;
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
  /** The "head chef": first phone to join (next one if they leave). Starts shifts from their phone. */
  captainId: string | null;
  /** Length of the next shift. */
  roundDurationMs: number;
  /** Shake-to-push is on (the head chef chooses before a shift). */
  pushEnabled: boolean;
  /** Which kitchen the next shift is in. */
  map: MapId;
  /** How often kitchen chaos happens. */
  chaos: ChaosLevel;
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
