const test = require('node:test');
const assert = require('node:assert/strict');
const { checkPoints, checkWindow, checkPlausible } = require('../gpsValidation');

test('checkPoints: aceita de 3 a 6 campos, completa com null e zera FC/cadência fora da faixa', () => {
  assert.deepEqual(checkPoints([[0, -15, -47], [1, -15.0001, -47, 400, 300, -1], [1, -15.0002, -47, null, 150, 85]]), {
    points: [[0, -15, -47, null, null, null], [1, -15.0001, -47, 400, null, null], [1, -15.0002, -47, null, 150, 85]],
  });
});

test('checkPoints: 1º t precisa ser 0; t não pode diminuir', () => {
  assert.deepEqual(checkPoints([[1, -15, -47], [2, -15, -47]]), { error: 'invalid point at index 0' });
  assert.deepEqual(checkPoints([[0, -15, -47], [5, -15, -47], [4, -15, -47]]), { error: 'points must be in chronological order' });
});

test('checkPoints: coordenada, altitude e t fora da faixa apontam o índice', () => {
  const base = [0, -15, -47];
  for (const bad of [[1, 91, -47], [1, -15, -181], [1, -15, -47, 9001], [-1, -15, -47], [1, -15, -47, -501]]) {
    assert.deepEqual(checkPoints([base, bad]), { error: 'invalid point at index 1' }, JSON.stringify(bad));
  }
});

const NOW = Date.parse('2026-10-14T12:00:00Z');
const H = 3600 * 1000;

test('checkWindow: últimas 72 h, nada antes de 2026 e nada terminando no futuro (Review Focus 3)', () => {
  assert.equal(checkWindow(NOW - H, 1800, NOW), null);
  assert.equal(checkWindow(NOW - 72 * H, 1800, NOW), null); // exatamente 72 h ainda vale
  assert.equal(checkWindow(Date.parse('2025-12-31T23:59:59Z'), 60, Date.parse('2026-01-02T00:00:00Z')), 'start_time must be on or after 2026-01-01');
  assert.equal(checkWindow(NOW - 72 * H - 1, 1800, NOW), 'start_time must be within the last 72 hours');
  assert.equal(checkWindow(NOW + 6 * 60 * 1000, 60, NOW), 'start_time must not be in the future');
  assert.equal(checkWindow(NOW - 10 * 60 * 1000, 20 * 60, NOW), 'activity must not end in the future');
  assert.equal(checkWindow(NaN, 60, NOW), 'start_time must be on or after 2026-01-01');
});

test('checkPlausible: curta, longa e rápida demais; a amostra passa', () => {
  assert.equal(checkPlausible({ elapsed_sec: 59, distance_m: 500, duration_sec: 59 }), 'activity too short');
  assert.equal(checkPlausible({ elapsed_sec: 600, distance_m: 99.9, duration_sec: 600 }), 'activity too short');
  assert.equal(checkPlausible({ elapsed_sec: 86401, distance_m: 10000, duration_sec: 3600 }), 'activity too long');
  assert.equal(checkPlausible({ elapsed_sec: 600, distance_m: 5000, duration_sec: 600 }), 'speed not compatible with run or walk');
  assert.equal(checkPlausible({ elapsed_sec: 2882, distance_m: 8671.66, duration_sec: 2877 }), null);
});
