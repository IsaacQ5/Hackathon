import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KITCHEN } from '@tilt-mayhem/shared';
import { RoomManager } from '../src/rooms/RoomManager.js';

function setup(opts: ConstructorParameters<typeof RoomManager>[0] = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const rm = new RoomManager({ now: clock.now, ...opts });
  const { room, token } = rm.createRoom('host-sock', 'TV');
  return { rm, room, hostToken: token, clock };
}

function mustJoin(rm: RoomManager, code: string, name: string, sock: string, token?: string) {
  const r = rm.joinRoom(code, name, token, sock);
  assert.ok(r.ok, r.ok ? '' : r.error.code);
  return r.value;
}

describe('RoomManager', () => {
  it('creates rooms with 4-letter codes and lets players join', () => {
    const { rm, room } = setup();
    assert.match(room.code, /^[A-HJ-NP-Z]{4}$/);
    const a = mustJoin(rm, room.code.toLowerCase(), 'Alice', 's1');
    assert.equal(a.player.nickname, 'Alice');
    assert.equal(rm.roomState(room).players.length, 1);
    assert.equal(rm.bySocket('s1')?.binding.role, 'player');
  });

  it('rejects unknown rooms and bad nicknames', () => {
    const { rm, room } = setup();
    const r1 = rm.joinRoom('ZZZZ', 'x', undefined, 's1');
    assert.ok(!r1.ok && r1.error.code === 'ROOM_NOT_FOUND');
    const r2 = rm.joinRoom(room.code, '   \u0000  ', undefined, 's1');
    assert.ok(!r2.ok && r2.error.code === 'INVALID_NICKNAME');
  });

  it('enforces the 8 player maximum', () => {
    const { rm, room } = setup();
    for (let i = 0; i < 8; i++) mustJoin(rm, room.code, `P${i}`, `s${i}`);
    const r = rm.joinRoom(room.code, 'Nine', undefined, 's9');
    assert.ok(!r.ok && r.error.code === 'ROOM_FULL');
  });

  it('dedupes nicknames and assigns distinct colours', () => {
    const { rm, room } = setup();
    const a = mustJoin(rm, room.code, 'Sam', 's1');
    const b = mustJoin(rm, room.code, 'sam', 's2');
    assert.equal(b.player.nickname, 'sam 2');
    assert.notEqual(a.player.color, b.player.color);
  });

  it('lets chefs pick a free colour and a face in the lobby, but not a taken colour', () => {
    const { rm, room } = setup();
    const a = mustJoin(rm, room.code, 'Ann', 's1');
    const b = mustJoin(rm, room.code, 'Bob', 's2');
    const taken = rm.customize(room, b.player.id, a.player.color, undefined);
    assert.ok(!taken.ok && taken.error.code === 'COLOR_TAKEN');
    const ok = rm.customize(room, b.player.id, '#3d8bff', 'shades');
    assert.ok(ok.ok);
    const pub = rm.roomState(room).players.find((p) => p.id === b.player.id)!;
    assert.equal(pub.color, '#3d8bff');
    assert.equal(pub.face, 'shades');
    assert.ok(!rm.customize(room, b.player.id, '#123456', undefined).ok, 'only palette colours');
    assert.ok(!rm.customize(room, b.player.id, undefined, 'crown').ok, 'only known faces');
  });

  it('reconnects with a token without creating a duplicate, and rotates the token', () => {
    const { rm, room } = setup();
    const first = mustJoin(rm, room.code, 'Alice', 's1');
    const oldToken = first.player.token;
    rm.disconnect('s1');
    assert.equal(rm.roomState(room).players[0]!.connected, false);
    const again = mustJoin(rm, room.code, 'ignored', 's2', oldToken);
    assert.equal(again.resumed, true);
    assert.equal(again.player.id, first.player.id);
    assert.notEqual(again.player.token, oldToken);
    assert.equal(rm.roomState(room).players.length, 1);
    assert.equal(rm.roomState(room).players[0]!.connected, true);
    // Old token is no longer valid -> treated as a new player.
    const third = mustJoin(rm, room.code, 'Bob', 's3', oldToken);
    assert.equal(third.resumed, false);
  });

  it('blocks new players mid-round but allows reconnects', () => {
    const { rm, room } = setup();
    const a = mustJoin(rm, room.code, 'A', 's1');
    mustJoin(rm, room.code, 'B', 's2');
    assert.ok(rm.startGame(room, 'host-sock', 'start').ok);
    const late = rm.joinRoom(room.code, 'Late', undefined, 's3');
    assert.ok(!late.ok && late.error.code === 'INVALID_PHASE');
    rm.disconnect('s1');
    const back = rm.joinRoom(room.code, 'A', a.player.token, 's4');
    assert.ok(back.ok && back.value.resumed);
  });

  it('only the host can start, and needs enough connected players', () => {
    const { rm, room } = setup();
    mustJoin(rm, room.code, 'A', 's1');
    const notHost = rm.startGame(room, 's1', 'start');
    assert.ok(!notHost.ok && notHost.error.code === 'NOT_HOST');
    const tooFew = rm.startGame(room, 'host-sock', 'start');
    assert.ok(!tooFew.ok && tooFew.error.code === 'NOT_ENOUGH_PLAYERS');
    mustJoin(rm, room.code, 'B', 's2');
    const rematchFromLobby = rm.startGame(room, 'host-sock', 'rematch');
    assert.ok(!rematchFromLobby.ok && rematchFromLobby.error.code === 'INVALID_PHASE');
    assert.ok(rm.startGame(room, 'host-sock', 'start').ok);
    assert.equal(room.engine.phase, 'countdown');
  });

  it('host can resume with its token; wrong token is refused', () => {
    const { rm, room, hostToken } = setup();
    rm.disconnect('host-sock');
    assert.equal(rm.roomState(room).hostConnected, false);
    const bad = rm.resumeHost(room.code, 'f'.repeat(32), 'h2');
    assert.ok(!bad.ok && bad.error.code === 'INVALID_SESSION');
    const good = rm.resumeHost(room.code, hostToken, 'h2');
    assert.ok(good.ok);
    assert.equal(rm.isHost(room, 'h2'), true);
  });

  it('keeps rooms isolated when a socket switches rooms', () => {
    const { rm, room } = setup();
    const other = rm.createRoom('host-2').room;
    mustJoin(rm, room.code, 'A', 's1');
    const moved = mustJoin(rm, other.code, 'A', 's1');
    assert.equal(moved.left?.code, room.code);
    assert.equal(rm.roomState(room).players[0]!.connected, false);
    assert.equal(rm.bySocket('s1')?.room.code, other.code);
  });

  it('prunes disconnected lobby players after the grace period and expires empty rooms', () => {
    const { rm, room, clock } = setup({ reconnectGraceMs: 1000, roomIdleMs: 5000 });
    mustJoin(rm, room.code, 'A', 's1');
    rm.disconnect('s1');
    clock.advance(1500);
    const s1 = rm.sweep(clock.now());
    assert.deepEqual(s1.changed.map((r) => r.code), [room.code]);
    assert.equal(rm.roomState(room).players.length, 0);
    rm.disconnect('host-sock');
    clock.advance(6000);
    const s2 = rm.sweep(clock.now());
    assert.deepEqual(s2.removed, [room.code]);
    assert.equal(rm.getRoom(room.code), undefined);
  });

  it('builds a ranked leaderboard with ties', () => {
    const { rm, room } = setup();
    const a = mustJoin(rm, room.code, 'A', 's1');
    const b = mustJoin(rm, room.code, 'B', 's2');
    const c = mustJoin(rm, room.code, 'C', 's3');
    rm.startGame(room, 'host-sock', 'start');
    const e = room.engine;
    let t = 1_000_000 + 3000;
    e.update(t);
    // A and B each serve one burger, C serves nothing.
    for (const p of [a, b]) {
      e.setRecipe(p.player.id, 'burger');
      for (const st of ['chop', 'fry', 'knead', 'stir'] as const) {
        const spot = KITCHEN.spots.find((x) => x.id === st)!;
        e.setPlayerPosition(p.player.id, spot.fx, spot.fy);
        e.interact(p.player.id);
        for (let i = 0; i < 20 && e.peek(p.player.id)!.working; i++) {
          e.update((t += 400));
          e.rep(p.player.id, true);
        }
      }
      e.setPlayerPosition(p.player.id, KITCHEN.pass.x, KITCHEN.pass.y + 100);
      e.serve(p.player.id);
    }
    const board = rm.finishRound(room);
    assert.deepEqual(board.map((x) => [x.nickname, x.rank]), [
      ['A', 1],
      ['B', 1],
      ['C', 3],
    ]);
    assert.ok(board[0]!.score > 0 && board[0]!.score === board[1]!.score);
    void c;
  });
});
