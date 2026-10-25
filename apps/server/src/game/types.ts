import type { ChefFace, GamePhase, HazardKind, StationId, StuckKind } from '@tilt-mayhem/shared';

/** Server-side hazard state (a superset of HazardSnap). */
export interface Hazard {
  id: number;
  kind: HazardKind;
  x: number;
  y: number;
  r: number;
  warnMs: number;
  station: StationId | null;
  progress: number;
  dir: number;
  ttl: number;
  /** Chicken movement. */
  vx: number;
  vy: number;
  age: number;
  turnAt: number;
  /** Cheese: chefs already flattened by this wheel. */
  hit: Set<string>;
}

/** Internal (server-only) per-player simulation state. */
export interface EnginePlayer {
  id: string;
  x: number;
  y: number;
  score: number;
  input: { x: number; y: number };
  lastSeq: number;
  connected: boolean;
}

export interface Chef extends EnginePlayer {
  nickname: string;
  color: string;
  face: ChefFace;
  vx: number;
  vy: number;
  facing: number;
  recipeId: string;
  /** playMs when the current ticket was handed out. */
  ticketAt: number;
  have: Set<string>;
  /** Partly made ingredients survive stepping away from a station. */
  partial: Map<string, number>;
  working: { station: StationId; ingredient: string; reps: number; lastRepAt: number } | null;
  near: StationId | 'pass' | null;
  /** Taken out by a hazard until the phone does the recovery motion. */
  stuck: { kind: StuckKind; reps: number; hazardId: number | null; lastRepAt: number } | null;
  /** playMs until which hazards can't knock this chef down again (just got up). */
  immuneUntil: number;
  /** playMs when this chef can push again. */
  pushReadyAt: number;
  /** > 0 while sliding from a shove (ms left; steering is ignored). */
  knockMs: number;
  /** Who last shoved this chef, when (playMs) and whether it knocked them off a station. */
  pushedBy: { name: string; at: number; offStation: boolean } | null;
  served: number;
  stats: { gestures: number; oops: number; perStation: Partial<Record<StationId, number>>; fastestMs: number | null };
}

export type InputResult = 'ok' | 'stale' | 'invalid' | 'phase' | 'unknown';

export type InteractResult = 'ok' | 'not-near' | 'not-needed' | 'already-have' | 'busy' | 'phase';

export interface UpdateResult {
  /** Number of fixed simulation ticks executed. */
  ticks: number;
  /** Set when the phase changed during this update. */
  phaseChanged: GamePhase | null;
  /** True when at least one score changed during this update. */
  scoresChanged: boolean;
}

export interface Standing {
  id: string;
  score: number;
}
