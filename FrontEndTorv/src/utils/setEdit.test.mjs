// Roda com: node --test src/utils/setEdit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeightInput, parseSeconds, toEditRows, toEditPayload } from './setEdit.ts';

test('parseWeightInput: vírgula ou ponto, vazio = sem carga, inválido = undefined, teto 999,99', () => {
  assert.equal(parseWeightInput('7,5'), 7.5);
  assert.equal(parseWeightInput('7.5'), 7.5);
  assert.equal(parseWeightInput(' 20 '), 20);
  assert.equal(parseWeightInput('7,'), 7);
  assert.equal(parseWeightInput(''), null);
  assert.equal(parseWeightInput('   '), null);
  assert.equal(parseWeightInput('1000'), 999.99);
  assert.equal(parseWeightInput('abc'), undefined);
  assert.equal(parseWeightInput('1.234'), undefined);
  assert.equal(parseWeightInput('-3'), undefined);
  assert.equal(parseWeightInput('1,2,3'), undefined);
});

test('parseSeconds: inteiro de 0 a 3600; o resto é inválido', () => {
  assert.equal(parseSeconds('45'), 45);
  assert.equal(parseSeconds(' 0 '), 0);
  assert.equal(parseSeconds('3601'), 3600);
  for (const bad of ['', 'x', '-1', '4.5', '4,5']) assert.equal(parseSeconds(bad), undefined, bad);
});

const sets = [
  { id: 'a', exercise_name: 'Supino', set_number: 1, duration_sec: 30, weight_kg: 20 },
  { id: 'b', exercise_name: 'Supino', set_number: 2, duration_sec: 32, weight_kg: null },
];

test('toEditRows: rótulo, tempo e carga em texto (vírgula decimal)', () => {
  const rows = toEditRows([{ ...sets[0], weight_kg: 22.5 }, sets[1]]);
  assert.deepEqual(rows, [
    { id: 'a', label: 'Supino · série 1', durationText: '30', weightText: '22,5' },
    { id: 'b', label: 'Supino · série 2', durationText: '32', weightText: '' },
  ]);
});

test('toEditPayload: monta o corpo do PUT; carga vazia vira null', () => {
  const out = toEditPayload(900, toEditRows(sets));
  assert.deepEqual(out, { ok: true, body: { duration_sec: 900, sets: [
    { id: 'a', duration_sec: 30, weight_kg: 20 },
    { id: 'b', duration_sec: 32, weight_kg: null },
  ] } });
});

test('toEditPayload: sem séries, tempo ou carga inválidos → erro com o nome da série', () => {
  assert.equal(toEditPayload(900, []).ok, false);
  const rows = toEditRows(sets);
  const badTime = toEditPayload(900, [{ ...rows[0], durationText: 'x' }, rows[1]]);
  assert.equal(badTime.ok, false);
  assert.match(badTime.error, /Supino · série 1/);
  const badWeight = toEditPayload(900, [rows[0], { ...rows[1], weightText: 'abc' }]);
  assert.match(badWeight.error, /Carga inválida.*série 2/);
});
