import type { ChefFace, GamePhase, StationId } from '@tilt-mayhem/shared';

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
