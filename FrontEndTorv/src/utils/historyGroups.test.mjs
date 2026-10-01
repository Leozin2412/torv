// Roda com: node --test src/utils/historyGroups.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByDay, dayTitle } from './historyGroups.ts';

// Datas montadas no fuso local: o teste vale em qualquer TZ.
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const item = (id, date) => ({ id, start_time: date.toISOString() });

test('groupByDay: Hoje, Ontem e dia da semana, na ordem recebida', () => {
  const now = at(2026, 10, 1, 12);
  const groups = groupByDay([
    item('a', at(2026, 10, 1, 10)),
    item('b', at(2026, 10, 1, 8)),
    item('c', at(2026, 9, 30, 23, 59)),
    item('d', at(2026, 9, 28, 7)),
  ], now);
  assert.deepEqual(groups.map((g) => [g.title, g.data.map((i) => i.id)]), [
    ['Hoje', ['a', 'b']],
    ['Ontem', ['c']],
    ['seg, 28/09', ['d']],
  ]);
  assert.equal(groups[0].key, '2026-10-01');
});

test('dayTitle: virada de mês e de ano', () => {
  assert.equal(dayTitle(at(2026, 9, 30, 23, 50), at(2026, 10, 1, 0, 30)), 'Ontem');
  assert.equal(dayTitle(at(2025, 12, 31), at(2026, 1, 2)), 'qua, 31/12/2025');
  assert.equal(dayTitle(at(2026, 1, 1), at(2026, 1, 2)), 'Ontem');
});

test('groupByDay: lista vazia', () => {
  assert.deepEqual(groupByDay([], at(2026, 10, 1)), []);
});
