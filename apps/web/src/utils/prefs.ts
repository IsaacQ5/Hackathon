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

export interface ControllerPrefs {
  /** Degrees of tilt for full speed: lower = more sensitive. */
  tiltDeg: number;
}

export const prefs = {
  controller: (): ControllerPrefs => {
    const { tiltDeg } = read<ControllerPrefs>('ss:controller', { tiltDeg: 22 });
    return { tiltDeg };
  },
  setController: (c: ControllerPrefs) => write('ss:controller', c),
};
