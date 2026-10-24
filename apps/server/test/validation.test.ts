import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeRoomCode, parseInput, sanitizeNickname, TokenBucket } from '../src/utils/validation.js';

describe('validation', () => {
  it('sanitizes nicknames', () => {
    assert.equal(sanitizeNickname('  Ada   Lovelace '), 'Ada Lovelace');
    assert.equal(sanitizeNickname('<script>'), 'script');
    assert.equal(sanitizeNickname('a​b\u0007c'), 'abc');
    assert.equal(sanitizeNickname('x'.repeat(40))!.length, 16);
    assert.equal(sanitizeNickname('🔥'.repeat(20)), '🔥'.repeat(16));
    assert.equal(sanitizeNickname('   '), null);
    assert.equal(sanitizeNickname(42), null);
  });

  it('normalizes room codes', () => {
    assert.equal(normalizeRoomCode(' abcd '), 'ABCD');
    assert.equal(normalizeRoomCode('ABC'), null);
    assert.equal(normalizeRoomCode('AB0D'), null);
    assert.equal(normalizeRoomCode('ABIO'), null);
    assert.equal(normalizeRoomCode(null), null);
  });

  it('parses input structure', () => {
    assert.deepEqual(parseInput({ seq: 1, x: 0.5, y: -0.5 }), { seq: 1, x: 0.5, y: -0.5 });
    assert.equal(parseInput({ seq: '1', x: 0, y: 0 }), null);
    assert.equal(parseInput([1, 2, 3]), null);
    assert.equal(parseInput(null), null);
  });

  it('rate limits with a token bucket', () => {
    const b = new TokenBucket(3, 1, 0);
    assert.equal(b.take(0), true);
    assert.equal(b.take(0), true);
    assert.equal(b.take(0), true);
    assert.equal(b.take(0), false);
    assert.equal(b.take(1000), true);
    assert.equal(b.take(1000), false);
  });
});
