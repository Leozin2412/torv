// Roda com: node --test src/utils/clock.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock } from './clock.ts';

test('formatClock', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(600), '10:00');
  assert.equal(formatClock(3600), '1:00:00');
  assert.equal(formatClock(3725), '1:02:05');
});
