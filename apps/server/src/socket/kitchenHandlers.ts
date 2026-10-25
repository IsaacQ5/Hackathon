import type { Socket } from 'socket.io';
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from '@tilt-mayhem/shared';
import type { RoomManager } from '../rooms/RoomManager.js';
import { isPlainObject, TokenBucket } from '../utils/validation.js';
import { emitRoomState, type IOServer } from './handlers.js';

type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Sizzle Scramble gameplay events. Purely additive: room creation, joining
 * and reconnects stay in handlers.ts. Every event looks the sender up through
 * the RoomManager, so a phone can only act for its own chef.
 */
export function registerKitchenHandlers(io: IOServer, rooms: RoomManager): void {
  io.on('connection', (socket: IOSocket) => {
    const reps = new TokenBucket(20, 14); // gestures; the engine also rate-limits per station
    const efforts = new TokenBucket(20, 15); // accuracy updates (~10/s); the engine times them itself
    const control = new TokenBucket(10, 5);

    const me = () => {
      const found = rooms.bySocket(socket.id);
      return found && found.binding.role === 'player' ? found : null;
    };

    socket.on('kitchen:interact', () => {
      if (!control.take()) return;
      const found = me();
      if (found) found.room.engine.interact(found.binding.playerId);
    });

    socket.on('kitchen:rep', (payload) => {
      if (!reps.take() || !isPlainObject(payload)) return;
      const found = me();
      if (found) found.room.engine.rep(found.binding.playerId, payload.good === true);
    });

    socket.on('kitchen:effort', (payload) => {
      if (!efforts.take() || !isPlainObject(payload) || typeof payload.a !== 'number') return;
      const found = me();
      if (found) found.room.engine.effort(found.binding.playerId, payload.a);
    });

    socket.on('kitchen:recover', (payload) => {
      if (!reps.take() || !isPlainObject(payload)) return;
      const found = me();
      if (found) found.room.engine.recover(found.binding.playerId, payload.good === true);
    });

    socket.on('kitchen:push', () => {
      if (!control.take()) return;
      const found = me();
      if (found) found.room.engine.push(found.binding.playerId);
    });

    socket.on('kitchen:cancel', () => {
      if (!control.take()) return;
      const found = me();
      if (found) found.room.engine.cancel(found.binding.playerId);
    });

    socket.on('kitchen:serve', () => {
      if (!control.take()) return;
      const found = me();
      if (!found) return;
      if (found.room.engine.serve(found.binding.playerId) > 0) emitRoomState(io, rooms, found.room);
    });
  });
}
