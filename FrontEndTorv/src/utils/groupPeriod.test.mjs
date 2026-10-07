// Roda com: node --test src/utils/groupPeriod.test.mjs (Node 24 remove os tipos do .ts sozinho).
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupToday, groupStatus, periodLabel, formatDay } from './groupPeriod.ts';

const at = (iso) => Date.parse(iso);

test('groupToday: o dia é o do fuso do grupo, não o do aparelho nem o UTC', () => {
  const now = at('2026-10-07T01:30:00Z'); // 22:30 de 06/10 em UTC-3
  assert.equal(groupToday(-180, now), '2026-10-06');
  assert.equal(groupToday(0, now), '2026-10-07');
});

test('groupStatus: antes do início, durante e depois do fim (inclusivo)', () => {
  const p = { starts_at: '2026-10-10', ends_at: '2026-10-20', tz_offset_min: 0 };
  assert.equal(groupStatus(p, at('2026-10-09T23:59:00Z')), 'upcoming');
  assert.equal(groupStatus(p, at('2026-10-10T00:00:00Z')), 'active');
  assert.equal(groupStatus(p, at('2026-10-20T23:59:00Z')), 'active');
  assert.equal(groupStatus(p, at('2026-10-21T00:00:00Z')), 'ended');
});

test('groupStatus: sem data de término nunca encerra', () => {
  const p = { starts_at: '2020-01-01', ends_at: null, tz_offset_min: -180 };
  assert.equal(groupStatus(p, at('2030-01-01T00:00:00Z')), 'active');
});

test('periodLabel: cada estado com singular e plural', () => {
  const day = (iso) => at(`${iso}T12:00:00Z`);
  const p = (s, e) => ({ starts_at: s, ends_at: e, tz_offset_min: 0 });
  assert.equal(periodLabel(p('2026-10-12', null), day('2026-10-10')), 'Começa em 2 dias');
  assert.equal(periodLabel(p('2026-10-11', null), day('2026-10-10')), 'Começa amanhã');
  assert.equal(periodLabel(p('2026-10-01', null), day('2026-10-10')), 'Sem data de término');
  assert.equal(periodLabel(p('2026-10-01', '2026-10-13'), day('2026-10-10')), '3 dias restantes');
  assert.equal(periodLabel(p('2026-10-01', '2026-10-11'), day('2026-10-10')), '1 dia restante');
  assert.equal(periodLabel(p('2026-10-01', '2026-10-10'), day('2026-10-10')), 'Termina hoje');
  assert.equal(periodLabel(p('2026-10-01', '2026-10-09'), day('2026-10-10')), 'Encerrado em 09/10/2026');
});

test('formatDay', () => {
  assert.equal(formatDay('2026-01-05'), '05/01/2026');
});
