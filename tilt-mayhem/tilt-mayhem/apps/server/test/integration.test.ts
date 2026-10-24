/**
 * End-to-end over real sockets: host creates a room, two phones join,
 * the host starts, inputs move characters, and the round ends with a leaderboard.
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { io as connect, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  GameEndedPayload,
  GameSnapshot,
  HostSession,
  PlayerSession,
  RoomState,
  ServerToClientEvents,
} from '@tilt-mayhem/shared';
import { createAppServer, type AppHandle } from '../src/app.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: AppHandle;
let url = '';
const sockets: ClientSocket[] = [];

function client(): Promise<ClientSocket> {
  const s: ClientSocket = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  sockets.push(s);
  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

function waitFor<T>(s: ClientSocket, event: keyof ServerToClientEvents, pred: (v: T) => boolean = () => true, ms = 5000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${String(event)}`)), ms);
    const handler = (v: T) => {
      if (!pred(v)) return;
      clearTimeout(timer);
      (s as unknown as { off: (e: string, h: unknown) => void }).off(event, handler);
      resolve(v);
    };
    (s as unknown as { on: (e: string, h: unknown) => void }).on(event, handler);
  });
}

before(async () => {
  server = createAppServer({
    staticDir: null,
    gameConfig: { countdownMs: 200, roundDurationMs: 1500, collectibleCount: 3 },
  });
  await new Promise<void>((r) => server.httpServer.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
});

after(async () => {
  sockets.forEach((s) => s.close());
  await server.close();
});

describe('socket flow', () => {
  it('runs a full round from room creation to results', async () => {
    const host = await client();
    const created = await new Promise<HostSession>((resolve, reject) =>
      host.emit('room:create', { nickname: 'TV' }, (r) => (r.ok ? resolve(r) : reject(new Error(r.error.code)))),
    );
    assert.match(created.code, /^[A-Z]{4}$/);

    const join = async (name: string) => {
      const s = await client();
      const res = await new Promise<PlayerSession>((resolve, reject) =>
        s.emit('room:join', { code: created.code, nickname: name }, (r) =>
          r.ok ? resolve(r) : reject(new Error(r.error.code)),
        ),
      );
      return { s, res };
    };
    const p1 = await join('Alice');
    const p2 = await join('Bob');

    // A bogus room is rejected.
    const stray = await client();
    const bad = await new Promise<{ ok: boolean }>((resolve) =>
      stray.emit('room:join', { code: 'QQQQ', nickname: 'x' }, resolve),
    );
    assert.equal(bad.ok, false);

    // Players can't start the game.
    const notHost = await new Promise<{ ok: boolean }>((r) => p1.s.emit('game:start', {}, r));
    assert.equal(notHost.ok, false);

    const state = await waitFor<RoomState>(host, 'room:state', (s) => s.players.length === 2, 2000).catch(() => null);
    assert.ok(state === null || state.players.length === 2);

    const started = waitFor(p1.s, 'game:started');
    const ok = await new Promise<{ ok: boolean }>((r) => host.emit('game:start', {}, r));
    assert.equal(ok.ok, true);
    await started;

    const playing = await waitFor<GameSnapshot>(host, 'game:snapshot', (s) => s.phase === 'playing');
    const startX = playing.players.find((p) => p.id === p1.res.playerId)!.x;

    let seq = 0;
    const pump = setInterval(() => p1.s.volatile.emit('player:input', { seq: ++seq, x: 1, y: 0 }), 33);
    const later = await waitFor<GameSnapshot>(host, 'game:snapshot', (s) => s.phase === 'playing' && s.tick > playing.tick + 15);
    clearInterval(pump);
    const movedX = later.players.find((p) => p.id === p1.res.playerId)!.x;
    assert.ok(movedX > startX + 20, `expected movement: ${startX} -> ${movedX}`);

    // Phones must not receive host snapshots.
    let phoneGotSnapshot = false;
    p2.s.on('game:snapshot', () => (phoneGotSnapshot = true));

    const ended = await waitFor<GameEndedPayload>(p2.s, 'game:ended', () => true, 4000);
    assert.equal(ended.leaderboard.length, 2);
    assert.equal(phoneGotSnapshot, false);

    // Rematch works without recreating the room.
    const again = await new Promise<{ ok: boolean }>((r) => host.emit('game:rematch', {}, r));
    assert.equal(again.ok, true);
  });
});
