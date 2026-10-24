import type { GamePhase } from '@tilt-mayhem/shared';

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

export type InputResult = 'ok' | 'stale' | 'invalid' | 'phase' | 'unknown';

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
