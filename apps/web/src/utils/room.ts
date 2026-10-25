import { GAME_CONFIG, type RoomState } from '@tilt-mayhem/shared';

/**
 * The head chef: the first phone that joined and is still connected. The server says who;
 * fall back to the same rule locally so the UI never loses its start button.
 */
export function captainIdOf(room: RoomState): string | null {
  return room.captainId ?? room.players.find((p) => p.connected)?.id ?? null;
}

/** Length of the next shift, in whole minutes. */
export function roundMinutesOf(room: RoomState): number {
  const ms = (room.roundDurationMs as number | undefined) ?? GAME_CONFIG.roundDurationMs;
  return Math.round(ms / 60_000);
}
