/**
 * Central game tuning. The server is authoritative and uses these values for
 * simulation; the web client uses the arena size and tick rate for rendering.
 */
export const GAME_CONFIG = {
  /** Virtual arena size in world units. */
  arenaWidth: 1000,
  arenaHeight: 600,

  /** Simulation rate (ticks per second). */
  tickRate: 30,
  /** Never simulate more than this many ticks in one update (stall protection). */
  maxCatchUpTicks: 5,

  /** Character movement. */
  maxSpeed: 260,
  playerRadius: 22,

  /** Round timing: shifts default to 3 minutes (the head chef can pick ROUND_MINUTE_OPTIONS). */
  countdownMs: 3000,
  roundDurationMs: 180_000,

  /** Collectibles (Tilt Mayhem; unused by Sizzle Scramble, kept for compatibility). */
  collectibleRadius: 12,
  collectibleCount: 6,
  /** Ticks before a collected item is replaced. */
  collectibleRespawnTicks: 12,
  goldenChance: 0.12,
  normalValue: 1,
  goldenValue: 3,

  /** Room limits. */
  minPlayers: 2,
  maxPlayers: 8,
} as const;

export type GameConfig = { -readonly [K in keyof typeof GAME_CONFIG]: number };

export const ROOM_CODE_LENGTH = 4;
/** No I or O, to avoid confusion with 1 and 0. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const NICKNAME_MAX_LENGTH = 15;

/** Shift lengths the head chef can pick in the lobby (minutes). */
export const ROUND_MINUTE_OPTIONS = [2, 3, 5, 7, 10] as const;

/** Movement updates per second the phone sends while playing. */
export const INPUT_SEND_HZ = 30;

export const PLAYER_COLORS = [
  '#ff3d7f', // pink
  '#2de2e6', // cyan
  '#ffd23f', // yellow
  '#7cff6b', // lime
  '#b26bff', // violet
  '#ff8a3d', // orange
  '#3d8bff', // blue
  '#ff6bd6', // magenta
] as const;
