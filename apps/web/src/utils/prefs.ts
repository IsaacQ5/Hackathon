/** Per-device preferences (separate from room/session storage). Storage may throw: always fall back. */
function read<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export type MoveMode = 'tilt' | 'joystick' | 'dpad';

export interface ControllerPrefs {
  /** Degrees of tilt for full speed: lower = more sensitive. */
  tiltDeg: number;
  moveMode: MoveMode;
  /** Use on-screen buttons at stations instead of motion gestures. */
  stationButtons: boolean;
}

export const prefs = {
  controller: (): ControllerPrefs =>
    read<ControllerPrefs>('ss:controller', { tiltDeg: 22, moveMode: 'tilt', stationButtons: false }),
  setController: (c: ControllerPrefs) => write('ss:controller', c),
};
