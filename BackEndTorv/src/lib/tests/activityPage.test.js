const test = require('node:test');
const assert = require('node:assert/strict');
const { activityItem, activityPage } = require('../activityPage');

const row = (over = {}) => ({
  id: 'a1', activity_type: 'STRENGTH', title: 'Treino A', start_time: new Date('2026-10-14T20:00:00Z'),
  duration_sec: 3000, distance_m: null, _count: { workout_sets: 3 }, ...over,
});

test('activityItem: título e duração nulos viram vazio e 0; distance_m Decimal vira número', () => {
  assert.deepEqual(activityItem(row({ title: null, duration_sec: null })), {
    id: 'a1', activity_type: 'STRENGTH', title: '', start_time: '2026-10-14T20:00:00.000Z',
    duration_sec: 0, set_count: 3, distance_m: null,
  });
  // O Prisma devolve Decimal; Number() converte pelo valueOf/toString.
  assert.equal(activityItem(row({ distance_m: { toString: () => '8445.10', valueOf: () => 8445.1 } })).distance_m, 8445.1);
  assert.equal(activityItem(row({ distance_m: '1000.00' })).distance_m, 1000);
});

test('activityPage: página cheia → next_before = start_time do último; incompleta → null', () => {
  const rows = [row({ id: 'a' }), row({ id: 'b', start_time: new Date('2026-10-13T20:00:00Z') })];
  assert.equal(activityPage(rows, 2).next_before, '2026-10-13T20:00:00.000Z');
  assert.equal(activityPage(rows, 3).next_before, null);
  assert.deepEqual(activityPage(rows, 3).activities.map((a) => a.id), ['a', 'b']);
});
