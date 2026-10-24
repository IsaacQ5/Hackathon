import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GameEngine } from '../src/game/GameEngine.js';

const TICK = 1000 / 30;

function playingEngine(players = ['a', 'b']) {
  const engine = new GameEngine({ countdownMs: 100, roundDurationMs: 2000 }, () => 0.1);
  players.forEach((id, i) => engine.addPlayer(id, `P${i}`, '#fff'));
  let now = 1000;
  assert.equal(engine.startCountdown(now), true);
  now += 100;
  engine.update(now);
  assert.equal(engine.phase, 'playing');
  return { engine, now };
}

const player = (engine: GameEngine, id: string) => engine.publicPlayers().find((p) => p.id === id)!;

describe('GameEngine', () => {
  it('goes countdown -> playing -> results on wall-clock deadlines', () => {
    const engine = new GameEngine({ countdownMs: 3000, roundDurationMs: 60_000 });
    engine.addPlayer('a', 'A', '#fff');
    engine.addPlayer('b', 'B', '#fff');
    engine.startCountdown(0);
    assert.equal(engine.phase, 'countdown');
    assert.equal(engine.update(2999).phaseChanged, null);
    assert.equal(engine.update(3000).phaseChanged, 'playing');
    assert.equal(engine.snapshot(33_000).timeLeftMs, 30_000);
    assert.equal(engine.update(63_000).phaseChanged, 'results');
  });

  it('moves players toward their tilt input and caps catch-up ticks', () => {
    const { engine, now } = playingEngine();
    engine.setPlayerPosition('a', 500, 300);
    assert.equal(engine.applyInput('a', { seq: 1, x: 1, y: 0 }), 'ok');
    engine.update(now + 1000);
    assert.ok(player(engine, 'a').x > 500);
    assert.ok(player(engine, 'a').x < 540);
    assert.ok(engine.update(now + 10_000).ticks <= 5);
  });

  it('punches nearby opponents in the direction the player faces', () => {
    const { engine, now } = playingEngine();
    engine.setPlayerPosition('a', 300, 300);
    engine.setPlayerPosition('b', 340, 300);
    engine.applyInput('a', { seq: 1, x: 0.5, y: 0, punch: true });
    engine.update(now + TICK);
    engine.update(now + TICK * 2);
    assert.equal(player(engine, 'a').action, 'punch');
    assert.equal(player(engine, 'b').action, 'thrown');
    assert.ok(player(engine, 'b').x > 340);
  });

  it('grabs a nearby opponent and flick-throws them', () => {
    const { engine, now } = playingEngine();
    engine.setPlayerPosition('a', 300, 300);
    engine.setPlayerPosition('b', 340, 300);
    engine.applyInput('a', { seq: 1, x: 0, y: 0, grab: true });
    engine.update(now + TICK);
    assert.equal(player(engine, 'b').x, 333);
    engine.applyInput('a', { seq: 2, x: 0, y: 0, grab: true, throwX: 1, throwY: 0 });
    engine.update(now + TICK * 2);
    engine.update(now + TICK * 3);
    assert.equal(player(engine, 'b').action, 'thrown');
    assert.ok(player(engine, 'b').x > 333);
  });

  it('eliminates players who fall off and ends when one remains', () => {
    const { engine, now } = playingEngine();
    engine.setPlayerPosition('a', 20, 20);
    engine.update(now + TICK);
    assert.equal(player(engine, 'a').alive, false);
    assert.equal(engine.phase, 'results');
    assert.ok(player(engine, 'b').score > player(engine, 'a').score);
    assert.equal(engine.snapshot(now + TICK).arena, 'train');
  });

  it('shrinks the island platform during a round', () => {
    const engine = new GameEngine({ countdownMs: 0, islandCollapseMs: 10_000 }, () => 0.9);
    engine.addPlayer('a', 'A', '#fff');
    engine.addPlayer('b', 'B', '#fff');
    engine.startCountdown(0);
    engine.update(1);
    assert.equal(engine.snapshot(1).arena, 'island');
    assert.equal(engine.snapshot(1).platformScale, 1);
    assert.ok(engine.snapshot(30_000).platformScale < 1);
  });

  it('rejects invalid, stale and out-of-phase inputs', () => {
    const engine = new GameEngine();
    engine.addPlayer('a', 'A', '#fff');
    assert.equal(engine.applyInput('a', { seq: 1, x: 0, y: 0 }), 'phase');
    const { engine: active } = playingEngine();
    assert.equal(active.applyInput('a', { seq: 1, x: Number.NaN, y: 0 }), 'invalid');
    assert.equal(active.applyInput('a', { seq: 1, x: 1.5, y: 0 }), 'invalid');
    assert.equal(active.applyInput('a', { seq: -1, x: 0, y: 0 }), 'invalid');
    assert.equal(active.applyInput('a', { seq: 1.5, x: 0, y: 0 }), 'invalid');
    assert.equal(active.applyInput('a', { seq: 2, x: 0, y: 0, throwX: 2 }), 'invalid');
    assert.equal(active.applyInput('a', { seq: 5, x: 0.2, y: 0 }), 'ok');
    assert.equal(active.applyInput('a', { seq: 5, x: 0.2, y: 0 }), 'stale');
    assert.equal(active.applyInput('missing', { seq: 9, x: 0, y: 0 }), 'unknown');
  });
});
