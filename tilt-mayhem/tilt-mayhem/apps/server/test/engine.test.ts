import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GameEngine } from '../src/game/GameEngine.js';

const TICK = 1000 / 30;

function playingEngine(players = ['a', 'b']) {
  const e = new GameEngine({ countdownMs: 100, roundDurationMs: 2000, collectibleCount: 0 }, () => 0.5);
  players.forEach((id, i) => e.addPlayer(id, `P${i}`, '#fff'));
  let now = 1000;
  assert.equal(e.startCountdown(now), true);
  now += 100;
  e.update(now);
  assert.equal(e.phase, 'playing');
  return { e, now };
}

const pos = (e: GameEngine, id: string) => e.publicPlayers().find((p) => p.id === id)!;

describe('GameEngine', () => {
  it('goes countdown -> playing -> results on wall-clock deadlines', () => {
    const e = new GameEngine({ countdownMs: 3000, roundDurationMs: 60_000 });
    e.addPlayer('a', 'A', '#fff');
    e.startCountdown(0);
    assert.equal(e.phase, 'countdown');
    assert.equal(e.update(2999).phaseChanged, null);
    assert.equal(e.update(3000).phaseChanged, 'playing');
    const mid = e.snapshot(33_000);
    assert.equal(mid.timeLeftMs, 30_000);
    assert.equal(e.update(63_000).phaseChanged, 'results');
    assert.equal(e.phase, 'results');
  });

  it('moves players by input * maxSpeed * dt', () => {
    const { e, now } = playingEngine(['a']);
    e.setPlayerPosition('a', 500, 300);
    assert.equal(e.applyInput('a', { seq: 1, x: 1, y: 0 }), 'ok');
    e.update(now + 1000); // 1 s, but capped by maxCatchUpTicks
    const p = pos(e, 'a');
    // 5 ticks max per update -> 5 * (220 / 30)
    assert.ok(Math.abs(p.x - (500 + 5 * (220 / 30))) < 0.2, `x=${p.x}`);
    assert.equal(p.y, 300);
  });

  it('keeps players inside the arena', () => {
    const { e } = playingEngine(['a']);
    let { now } = playingEngine(['a']);
    e.setPlayerPosition('a', 20, 20);
    e.applyInput('a', { seq: 1, x: -1, y: -1 });
    for (let i = 0; i < 200; i++) {
      now += TICK;
      e.update(now);
    }
    const p = pos(e, 'a');
    assert.equal(p.x, 15);
    assert.equal(p.y, 15);
  });

  it('limits catch-up after a stall', () => {
    const { e, now } = playingEngine(['a']);
    const r = e.update(now + 10_000 - 1); // huge gap but before round end... round is 2s, so clamp
    assert.ok(r.ticks <= 5, `ran ${r.ticks} ticks`);
  });

  it('rejects invalid, stale and out-of-phase input', () => {
    const e = new GameEngine();
    e.addPlayer('a', 'A', '#fff');
    assert.equal(e.applyInput('a', { seq: 1, x: 0, y: 0 }), 'phase');
    const { e: p } = playingEngine(['a']);
    assert.equal(p.applyInput('a', { seq: 1, x: Number.NaN, y: 0 }), 'invalid');
    assert.equal(p.applyInput('a', { seq: 1, x: 1.5, y: 0 }), 'invalid');
    assert.equal(p.applyInput('a', { seq: -1, x: 0, y: 0 }), 'invalid');
    assert.equal(p.applyInput('a', { seq: 1.5, x: 0, y: 0 }), 'invalid');
    assert.equal(p.applyInput('a', { seq: 5, x: 0.2, y: 0 }), 'ok');
    assert.equal(p.applyInput('a', { seq: 5, x: 0.2, y: 0 }), 'stale');
    assert.equal(p.applyInput('a', { seq: 4, x: 0.2, y: 0 }), 'stale');
    assert.equal(p.applyInput('zzz', { seq: 9, x: 0, y: 0 }), 'unknown');
  });

  it('awards a collectible exactly once, to the closest player', () => {
    const { e, now } = playingEngine(['a', 'b']);
    e.setPlayerPosition('a', 300, 300);
    e.setPlayerPosition('b', 330, 300);
    e.placeCollectible(305, 300, 3);
    e.update(now + TICK);
    e.update(now + TICK * 2);
    e.update(now + TICK * 3);
    assert.equal(pos(e, 'a').score, 3);
    assert.equal(pos(e, 'b').score, 0);
    const snap = e.snapshot(now + TICK * 3);
    assert.equal(snap.events.length, 1);
    assert.equal(e.snapshot(now + TICK * 3).events.length, 0, 'events drain');
  });

  it('respawns collected items', () => {
    const e = new GameEngine({ countdownMs: 0, roundDurationMs: 60_000, collectibleCount: 3, collectibleRespawnTicks: 2 });
    e.addPlayer('a', 'A', '#fff');
    e.startCountdown(0);
    e.update(1);
    const before = e.snapshot(1).collectibles;
    assert.equal(before.length, 3);
    const target = before[0]!;
    e.setPlayerPosition('a', target.x, target.y);
    let t = 1;
    for (let i = 0; i < 5; i++) e.update((t += TICK));
    assert.equal(e.snapshot(t).collectibles.length, 3);
    assert.ok(pos(e, 'a').score >= 1);
  });

  it('disconnected players do not move or score', () => {
    const { e, now } = playingEngine(['a']);
    e.setPlayerPosition('a', 300, 300);
    e.applyInput('a', { seq: 1, x: 1, y: 0 });
    e.setConnected('a', false);
    e.placeCollectible(300, 300);
    e.update(now + TICK * 3);
    assert.equal(pos(e, 'a').x, 300);
    assert.equal(pos(e, 'a').score, 0);
  });

  it('rematch resets scores', () => {
    const { e, now } = playingEngine(['a']);
    e.setPlayerPosition('a', 300, 300);
    e.placeCollectible(300, 300);
    e.update(now + TICK);
    assert.equal(pos(e, 'a').score, 1);
    e.update(now + 5000);
    assert.equal(e.phase, 'results');
    assert.equal(e.standings()[0]!.score, 1);
    assert.equal(e.startCountdown(now + 6000), true);
    assert.equal(pos(e, 'a').score, 0);
    assert.equal(e.startCountdown(now + 6000), false, 'cannot restart mid-countdown');
  });
});
