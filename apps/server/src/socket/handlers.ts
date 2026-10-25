import type { Server, Socket } from 'socket.io';
import type {
  Ack,
  AckResult,
  ChefFace,
  ClientToServerEvents,
  ErrorCode,
  GameStartedPayload,
  HostSession,
  InterServerEvents,
  PlayerSession,
  ServerToClientEvents,
  SocketData,
} from '@tilt-mayhem/shared';
import type { Room, RoomManager, SocketBinding } from '../rooms/RoomManager.js';
import { isPlainObject, parseInput, TokenBucket } from '../utils/validation.js';
import { registerKitchenHandlers } from './kitchenHandlers.js';

export type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/** Socket.IO room names. Everyone in a game room joins `all`; only the host screen joins `host`. */
export const channel = {
  all: (code: string) => `room:${code}`,
  host: (code: string) => `host:${code}`,
};

const err = (code: ErrorCode, message: string) => ({ ok: false as const, error: { code, message } });

/** Clients may omit the ack callback; never trust that it is a function. */
function safeAck<T extends object>(ack: unknown): Ack<T> {
  return typeof ack === 'function' ? (ack as Ack<T>) : () => undefined;
}

export function emitRoomState(io: IOServer, rooms: RoomManager, room: Room): void {
  io.to(channel.all(room.code)).emit('room:state', rooms.roomState(room));
}

function startedPayload(room: Room, now: number): GameStartedPayload {
  return {
    round: room.round,
    serverTime: now,
    countdownMs: Math.max(0, room.engine.playStartsAt - now),
    roundDurationMs: room.engine.config.roundDurationMs,
    playStartsAt: room.engine.playStartsAt,
  };
}

export function registerSocketHandlers(io: IOServer, rooms: RoomManager): void {
  io.on('connection', (socket: IOSocket) => {
    // Per-connection rate limits.
    const control = new TokenBucket(12, 4); // joins, starts, pings...
    const inputs = new TokenBucket(45, 36); // movement (~30/s expected)
    let lastInputErrorAt = 0;

    const limited = <T extends object>(ack: Ack<T>): boolean => {
      if (control.take()) return false;
      ack(err('RATE_LIMITED', 'Slow down a little.'));
      return true;
    };

    /** Leave the Socket.IO rooms for a previous binding and tell that room. */
    const handleLeft = (left: SocketBinding | null) => {
      if (!left) return;
      void socket.leave(channel.all(left.code));
      void socket.leave(channel.host(left.code));
      const old = rooms.getRoom(left.code);
      if (old) emitRoomState(io, rooms, old);
    };

    /** Another socket took over this identity (new tab / reconnect race). */
    const evict = (socketId: string | null, code: string, message: string) => {
      if (!socketId || socketId === socket.id) return;
      const other = io.sockets.sockets.get(socketId);
      if (!other) return;
      void other.leave(channel.all(code));
      void other.leave(channel.host(code));
      other.data = {};
      other.emit('server:error', { code: 'INVALID_SESSION', message });
    };

    // ---------------------------------------------------------------- host

    socket.on('room:create', (payload, rawAck) => {
      const ack = safeAck<HostSession>(rawAck);
      if (limited(ack)) return;
      const nickname = isPlainObject(payload) ? payload.nickname : undefined;
      const { room, token, left } = rooms.createRoom(socket.id, nickname);
      handleLeft(left);
      void socket.join([channel.all(room.code), channel.host(room.code)]);
      socket.data = { code: room.code, role: 'host', playerId: room.hostId };
      ack({ ok: true, code: room.code, playerId: room.hostId, role: 'host', token });
      socket.emit('room:created', { code: room.code, playerId: room.hostId, role: 'host' });
      emitRoomState(io, rooms, room);
    });

    socket.on('room:resume-host', (payload, rawAck) => {
      const ack = safeAck<HostSession>(rawAck);
      if (limited(ack)) return;
      if (!isPlainObject(payload)) return ack(err('INVALID_INPUT', 'Bad request.'));
      const res = rooms.resumeHost(payload.code, payload.token, socket.id);
      if (!res.ok) return ack(res);
      const { room, token, previousSocketId, left } = res.value;
      evict(previousSocketId, room.code, 'This room is now hosted from another screen.');
      handleLeft(left);
      void socket.join([channel.all(room.code), channel.host(room.code)]);
      socket.data = { code: room.code, role: 'host', playerId: room.hostId };
      ack({ ok: true, code: room.code, playerId: room.hostId, role: 'host', token });
      emitRoomState(io, rooms, room);
      const phase = room.engine.phase;
      if (phase === 'countdown' || phase === 'playing') socket.emit('game:started', startedPayload(room, Date.now()));
    });

    // ---------------------------------------------------------------- players

    socket.on('room:join', (payload, rawAck) => {
      const ack = safeAck<PlayerSession>(rawAck);
      if (limited(ack)) return;
      if (!isPlainObject(payload)) return ack(err('INVALID_INPUT', 'Bad request.'));
      const res = rooms.joinRoom(payload.code, payload.nickname, payload.token, socket.id);
      if (!res.ok) return ack(res);
      const { room, player, resumed, previousSocketId, left } = res.value;
      evict(previousSocketId, room.code, 'You joined from another tab or device.');
      if (left && left.code !== room.code) handleLeft(left);
      void socket.join(channel.all(room.code));
      socket.data = { code: room.code, role: 'player', playerId: player.id };
      const session: AckResult<PlayerSession> = {
        ok: true,
        code: room.code,
        playerId: player.id,
        role: 'player',
        token: player.token,
        nickname: player.nickname,
        color: player.color,
        phase: room.engine.phase,
        resumed,
      };
      ack(session);
      emitRoomState(io, rooms, room);
      const phase = room.engine.phase;
      if (phase === 'countdown' || phase === 'playing') socket.emit('game:started', startedPayload(room, Date.now()));
    });

    socket.on('player:input', (payload) => {
      if (!inputs.take()) return; // excessive rate: drop silently
      const found = rooms.bySocket(socket.id);
      if (!found || found.binding.role !== 'player') return;
      const input = parseInput(payload);
      const result = input ? found.room.engine.applyInput(found.binding.playerId, input) : 'invalid';
      if (result === 'invalid') {
        const now = Date.now();
        if (now - lastInputErrorAt > 5000) {
          lastInputErrorAt = now;
          socket.emit('server:error', { code: 'INVALID_INPUT', message: 'Movement input rejected.' });
        }
      }
      // 'stale' and 'phase' are expected occasionally and ignored.
    });

    socket.on('room:settings', (payload, rawAck) => {
      const ack = safeAck<object>(rawAck);
      if (limited(ack)) return;
      if (!isPlainObject(payload)) return ack(err('INVALID_INPUT', 'Bad request.'));
      const found = rooms.bySocket(socket.id);
      if (!found) return ack(err('ROOM_NOT_FOUND', 'You are not in a room.'));
      const res = rooms.setRoundLength(found.room, socket.id, payload.roundMinutes);
      if (!res.ok) return ack(res);
      ack({ ok: true });
      emitRoomState(io, rooms, found.room);
    });

    socket.on('player:customize', (payload, rawAck) => {
      const ack = safeAck<{ color: string; face: ChefFace }>(rawAck);
      if (limited(ack)) return;
      if (!isPlainObject(payload)) return ack(err('INVALID_INPUT', 'Bad request.'));
      const found = rooms.bySocket(socket.id);
      if (!found || found.binding.role !== 'player') return ack(err('INVALID_SESSION', 'You are not in a room.'));
      const res = rooms.customize(found.room, found.binding.playerId, payload.color, payload.face);
      if (!res.ok) return ack(res);
      ack({ ok: true, ...res.value });
      emitRoomState(io, rooms, found.room);
    });

    socket.on('player:recenter', () => {
      if (!control.take()) return;
      const found = rooms.bySocket(socket.id);
      if (found && found.binding.role === 'player') found.room.engine.clearInput(found.binding.playerId);
    });

    // ---------------------------------------------------------------- game flow

    const startHandler = (kind: 'start' | 'rematch') => (_payload: unknown, rawAck: unknown) => {
      const ack = safeAck<object>(rawAck);
      if (limited(ack)) return;
      const found = rooms.bySocket(socket.id);
      if (!found) return ack(err('ROOM_NOT_FOUND', 'You are not in a room.'));
      const { room } = found;
      const res = rooms.startGame(room, socket.id, kind);
      if (!res.ok) {
        ack(res);
        emitRoomState(io, rooms, room); // player list may have been pruned
        return;
      }
      ack({ ok: true });
      io.to(channel.all(room.code)).emit('game:started', startedPayload(room, Date.now()));
      emitRoomState(io, rooms, room);
    };
    socket.on('game:start', startHandler('start'));
    socket.on('game:rematch', startHandler('rematch'));

    socket.on('net:ping', (_payload, ack) => {
      if (!control.take()) return;
      if (typeof ack === 'function') ack({ serverTime: Date.now() });
    });

    socket.on('disconnect', () => {
      const found = rooms.disconnect(socket.id);
      if (found) emitRoomState(io, rooms, found.room);
    });
  });

  // Sizzle Scramble gameplay events (interact, gestures, cancel, serve).
  registerKitchenHandlers(io, rooms);
}

/** Each phone gets its own chef's status (recipe, progress, score). */
function sendPlayerStatuses(io: IOServer, room: Room, now: number): void {
  for (const p of room.players.values()) {
    if (!p.socketId) continue;
    const status = room.engine.status(p.id, now);
    if (status) io.to(p.socketId).emit('kitchen:status', status);
  }
}

export interface GameLoop {
  stop(): void;
}

/**
 * Drives every active room's GameEngine and broadcasts results.
 * Snapshots go only to the host screen; phones get low-frequency room:state.
 */
export function startGameLoop(io: IOServer, rooms: RoomManager, tickMs: number): GameLoop {
  const lastStateAt = new Map<string, number>();
  const dirty = new Set<string>();
  const STATE_MIN_INTERVAL = 200;
  const lastStatusAt = new Map<string, number>();
  const STATUS_INTERVAL = 100;

  const tick = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.allRooms()) {
      const phase = room.engine.phase;
      if (phase !== 'countdown' && phase !== 'playing') {
        if (dirty.delete(room.code)) emitRoomState(io, rooms, room);
        continue;
      }
      const result = room.engine.update(now);
      const snapshot = room.engine.snapshot(now);
      const hostChannel = io.to(channel.host(room.code));

      if (result.phaseChanged === 'results') {
        hostChannel.emit('game:snapshot', snapshot);
        io.to(channel.all(room.code)).emit('game:ended', {
          round: room.round,
          leaderboard: rooms.finishRound(room),
        });
        const results = room.engine.results();
        if (results) io.to(channel.all(room.code)).emit('game:results', results);
        sendPlayerStatuses(io, room, now);
        emitRoomState(io, rooms, room);
        dirty.delete(room.code);
        lastStateAt.set(room.code, now);
        continue;
      }

      // High-frequency and droppable.
      hostChannel.volatile.emit('game:snapshot', snapshot);

      // Phones: their own status ~10x per second (progress bars feel live).
      if (now - (lastStatusAt.get(room.code) ?? 0) >= STATUS_INTERVAL) {
        lastStatusAt.set(room.code, now);
        sendPlayerStatuses(io, room, now);
      }

      if (result.scoresChanged) dirty.add(room.code);
      const due = now - (lastStateAt.get(room.code) ?? 0) >= STATE_MIN_INTERVAL;
      if (result.phaseChanged || (dirty.has(room.code) && due)) {
        emitRoomState(io, rooms, room);
        dirty.delete(room.code);
        lastStateAt.set(room.code, now);
      }
    }
  }, tickMs);

  const sweep = setInterval(() => {
    const { removed, changed } = rooms.sweep();
    for (const code of removed) {
      lastStateAt.delete(code);
      lastStatusAt.delete(code);
      dirty.delete(code);
      io.in(channel.all(code)).socketsLeave(channel.all(code));
      io.in(channel.host(code)).socketsLeave(channel.host(code));
    }
    for (const room of changed) emitRoomState(io, rooms, room);
  }, 30_000);

  return {
    stop() {
      clearInterval(tick);
      clearInterval(sweep);
    },
  };
}
