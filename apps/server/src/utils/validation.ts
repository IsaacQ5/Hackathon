import {
  NICKNAME_MAX_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type PlayerInput,
} from '@tilt-mayhem/shared';

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Clean a nickname: normalize unicode, strip control/invisible characters,
 * collapse whitespace, and cut to the maximum length (by code point).
 * Returns null if nothing usable is left.
 */
export function sanitizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/gu, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(cleaned).slice(0, NICKNAME_MAX_LENGTH);
  const result = chars.join('').trim();
  return result.length > 0 ? result : null;
}

/** Uppercase and validate a room code. Returns null if it can't be a valid code. */
export function normalizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Reconnect tokens are 32 hex chars. */
export function isToken(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[0-9a-f]{32}$/.test(raw);
}

/**
 * Parse a movement input payload. Structure is checked here; numeric ranges
 * and sequence ordering are enforced by the GameEngine.
 */
export function parseInput(raw: unknown): PlayerInput | null {
  if (!isPlainObject(raw)) return null;
  const { seq, x, y, punch, grab, throwX, throwY } = raw;
  if (typeof seq !== 'number' || typeof x !== 'number' || typeof y !== 'number') return null;
  if (punch !== undefined && typeof punch !== 'boolean') return null;
  if (grab !== undefined && typeof grab !== 'boolean') return null;
  if (throwX !== undefined && typeof throwX !== 'number') return null;
  if (throwY !== undefined && typeof throwY !== 'number') return null;
  return {
    seq,
    x,
    y,
    ...(punch === undefined ? {} : { punch }),
    ...(grab === undefined ? {} : { grab }),
    ...(throwX === undefined ? {} : { throwX }),
    ...(throwY === undefined ? {} : { throwY }),
  };
}

/** Simple token-bucket rate limiter. */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now: number = Date.now(),
  ) {
    this.tokens = capacity;
    this.last = now;
  }

  take(now: number = Date.now(), cost = 1): boolean {
    const elapsed = Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}
