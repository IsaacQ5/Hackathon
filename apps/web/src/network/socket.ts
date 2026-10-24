import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import type {
  AckResult,
  ClientToServerEvents,
  HostSession,
  JoinRoomPayload,
  PlayerSession,
  ServerToClientEvents,
} from '@tilt-mayhem/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;

const options: Partial<ManagerOptions & SocketOptions> = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
  timeout: 8000,
};

/** One shared connection per browser tab. */
export const socket: GameSocket = SERVER_URL ? io(SERVER_URL, options) : io(options);

type UntypedEmitter = { emit: (event: string, ...args: unknown[]) => void };

/** Emit an event that expects an acknowledgement, with a timeout. */
function request<T extends object>(event: string, payload: unknown, timeoutMs = 6000): Promise<AckResult<T>> {
  return new Promise((resolve) => {
    const emitter = socket.timeout(timeoutMs) as unknown as UntypedEmitter;
    emitter.emit(event, payload, (err: Error | null, res: AckResult<T>) => {
      if (err || !res) {
        resolve({ ok: false, error: { code: 'TIMEOUT', message: 'The server did not respond. Check your connection.' } });
      } else {
        resolve(res);
      }
    });
  });
}

export const api = {
  createRoom: (nickname = 'Host') => request<HostSession>('room:create', { nickname }),
  resumeHost: (code: string, token: string) => request<HostSession>('room:resume-host', { code, token }),
  joinRoom: (payload: JoinRoomPayload) => request<PlayerSession>('room:join', payload),
  startGame: () => request<object>('game:start', {}),
  rematch: () => request<object>('game:rematch', {}),
  recenter: () => socket.emit('player:recenter', {}),
  ping: () => request<{ serverTime: number }>('net:ping', {}),
};

/** Sizzle Scramble gameplay calls (additive; room calls above are unchanged). */
export const kitchenApi = {
  interact: () => socket.emit('kitchen:interact', {}),
  rep: (good: boolean) => socket.emit('kitchen:rep', { good }),
  cancel: () => socket.emit('kitchen:cancel', {}),
  serve: () => socket.emit('kitchen:serve', {}),
};
