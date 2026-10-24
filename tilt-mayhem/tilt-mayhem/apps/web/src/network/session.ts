/**
 * Small persistence helpers. Storage can throw (private mode, blocked
 * cookies), so every access is wrapped and failures degrade to "no session".
 */

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export interface SavedPlayer {
  token: string;
  nickname: string;
}

export interface AxisSettings {
  invertX: boolean;
  invertY: boolean;
}

export const storage = {
  hostToken: (code: string) => read<string>(`tm:host:${code}`),
  setHostToken: (code: string, token: string | null) => write(`tm:host:${code}`, token),

  player: (code: string) => read<SavedPlayer>(`tm:player:${code}`),
  setPlayer: (code: string, p: SavedPlayer | null) => write(`tm:player:${code}`, p),

  nickname: () => read<string>('tm:nickname') ?? '',
  setNickname: (n: string) => write('tm:nickname', n),

  axis: (): AxisSettings => read<AxisSettings>('tm:axis') ?? { invertX: false, invertY: false },
  setAxis: (a: AxisSettings) => write('tm:axis', a),
};
