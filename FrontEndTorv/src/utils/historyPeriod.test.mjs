// Roda com: node --test src/utils/historyPeriod.test.mjs (Node 24 remove os tipos do .ts sozinho).
// Os esperados são montados com o Date local, então o teste passa em qualquer fuso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERIOD_PRESETS, periodKey, periodRange, customLabel } from './historyPeriod.ts';

const local = (y, m, d) => new Date(y, m - 1, d).toISOString();
const now = new Date(2026, 9, 2, 22, 45); // 02/10/2026 22:45 local

test('Tudo: sem limites', () => {
  assert.deepEqual(periodRange({ kind: 'all' }, now), {});
});

test('7 e 30 dias: de hoje 00:00 contando hoje, sem fim', () => {
  assert.deepEqual(periodRange({ kind: 'days', days: 7 }, now), { from: local(2026, 9, 26) });
  assert.deepEqual(periodRange({ kind: 'days', days: 30 }, now), { from: local(2026, 9, 3) });
});

test('3 meses: mesmo dia; dia que não existe no mês de destino cai no último dia', () => {
  assert.deepEqual(periodRange({ kind: 'months', months: 3 }, now), { from: local(2026, 7, 2) });
  assert.deepEqual(periodRange({ kind: 'months', months: 3 }, new Date(2026, 4, 31, 9)), { from: local(2026, 2, 28) });
  assert.deepEqual(periodRange({ kind: 'months', months: 3 }, new Date(2026, 0, 15)), { from: local(2025, 10, 15) });
});

test('Personalizado: início 00:00 até o dia seguinte ao fim 00:00 (fim incluso), virando mês e ano', () => {
  assert.deepEqual(periodRange({ kind: 'custom', start: '2026-09-12', end: '2026-09-30' }, now), {
    from: local(2026, 9, 12), before: local(2026, 10, 1),
  });
  assert.deepEqual(periodRange({ kind: 'custom', start: '2025-12-31', end: '2025-12-31' }, now), {
    from: local(2025, 12, 31), before: local(2026, 1, 1),
  });
});

test('periodKey: mesmo período em objetos diferentes = mesma chave; períodos diferentes = chaves diferentes', () => {
  assert.equal(periodKey({ kind: 'days', days: 7 }), periodKey({ kind: 'days', days: 7 }));
  const keys = [
    ...PERIOD_PRESETS.map((p) => periodKey(p.period)),
    periodKey({ kind: 'custom', start: '2026-09-12', end: '2026-09-30' }),
    periodKey({ kind: 'custom', start: '2026-09-12', end: '2026-09-29' }),
  ];
  assert.equal(new Set(keys).size, keys.length);
});

test('customLabel: dd/mm – dd/mm', () => {
  assert.equal(customLabel({ start: '2026-09-12', end: '2026-10-01' }), '12/09 – 01/10');
});
