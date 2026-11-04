// Roda com: node --test src/utils/heatmap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeatmap, heatLevel, cellLabel, cellAt } from './heatmap.ts';

test('heatLevel: 0, 1, 2 e 3 ou mais viram 4 níveis', () => {
  assert.deepEqual([0, 1, 2, 3, 7].map(heatLevel), [0, 1, 2, 3, 3]);
});

test('buildHeatmap: 53 semanas de 7 dias; dias depois de end ficam null', () => {
  const h = buildHeatmap('2025-10-12', '2026-10-14', [{ date: '2026-10-14', count: 2 }, { date: '2025-10-12', count: 1 }]);
  assert.equal(h.weeks.length, 53);
  assert.ok(h.weeks.every((w) => w.length === 7));
  assert.deepEqual(h.weeks[0][0], { date: '2025-10-12', count: 1, level: 1 });
  const last = h.weeks[52];
  assert.deepEqual(last[0], { date: '2026-10-11', count: 0, level: 0 }); // domingo
  assert.deepEqual(last[3], { date: '2026-10-14', count: 2, level: 2 }); // quarta = hoje
  assert.deepEqual(last.slice(4), [null, null, null]);
  assert.equal(h.activeDays, 2);
});

test('buildHeatmap: rótulo do mês na coluna do 1º domingo dele', () => {
  const h = buildHeatmap('2025-10-12', '2026-10-14', []);
  assert.deepEqual(h.months.slice(0, 4), [
    { label: 'out', week: 0 }, { label: 'nov', week: 3 }, { label: 'dez', week: 8 }, { label: 'jan', week: 12 },
  ]);
  assert.deepEqual(h.months[h.months.length - 1], { label: 'out', week: 51 });
});

test('buildHeatmap: o 1º rótulo some quando cola no 2º', () => {
  const h = buildHeatmap('2025-10-26', '2026-10-25', []);
  assert.deepEqual(h.months[0], { label: 'nov', week: 1 });
});

test('cellLabel: data curta em pt-BR e quantidade no singular e no plural', () => {
  assert.equal(cellLabel({ date: '2026-10-12', count: 2, level: 2 }), '12 de out. · 2 atividades');
  assert.equal(cellLabel({ date: '2026-05-01', count: 1, level: 1 }), '1 de mai. · 1 atividade');
  assert.equal(cellLabel({ date: '2026-01-09', count: 0, level: 0 }), '9 de jan. · nenhuma atividade');
});

test('cellAt: toque → semana e dia; o espaço vai para o quadrado anterior', () => {
  assert.deepEqual(cellAt(0, 0, 12, 3), { week: 0, day: 0 });
  assert.deepEqual(cellAt(14, 14, 12, 3), { week: 0, day: 0 });
  assert.deepEqual(cellAt(15, 46, 12, 3), { week: 1, day: 3 });
  assert.deepEqual(cellAt(10, 200, 12, 3), { week: 0, day: 6 });
  assert.equal(cellAt(-1, 5, 12, 3), null);
});

test('cellAt: x ou y que não são números finitos → null', () => {
  assert.equal(cellAt(NaN, 5, 12, 3), null);
  assert.equal(cellAt(undefined, 5, 12, 3), null);
  assert.equal(cellAt(5, Infinity, 12, 3), null);
});
