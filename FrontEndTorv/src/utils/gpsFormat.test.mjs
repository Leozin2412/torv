// Roda com: node --test src/utils/gpsFormat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, formatPace, paceOf, splitRows } from './gpsFormat.ts';

test('formatDistance e formatPace em pt-BR', () => {
  assert.equal(formatDistance(8670.74), '8,67 km');
  assert.equal(formatDistance(450), '0,45 km');
  assert.equal(formatPace(332), '5:32 /km');
  assert.equal(formatPace(359.6), '6:00 /km');
});

test('paceOf: tempo em movimento por km; sem distância → null', () => {
  assert.equal(paceOf(2877, 8670.74), 332);
  assert.equal(paceOf(600, null), null);
  assert.equal(paceOf(600, 0), null);
});

test('splitRows: km cheio pelo número, sobra pela distância', () => {
  assert.deepEqual(splitRows([{ km: 1, distance_m: 1000, duration_sec: 338 }, { km: 9, distance_m: 671, duration_sec: 217 }]), [
    { label: '1', time: '5:38', pace: '5:38 /km' },
    { label: '0,67 km', time: '3:37', pace: '5:23 /km' },
  ]);
});
