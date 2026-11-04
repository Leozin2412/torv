// Roda com: node --test src/utils/profileStats.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { deltaLabel, plural } from './profileStats.ts';

test('deltaLabel: sinal, zero e sinal de menos tipográfico', () => {
  assert.equal(deltaLabel(2), '+2 vs mês passado');
  assert.equal(deltaLabel(-1), '−1 vs mês passado');
  assert.equal(deltaLabel(0), 'Igual ao mês passado');
});

test('plural: singular só para 1', () => {
  assert.equal(plural(1, 'dia', 'dias'), '1 dia');
  assert.equal(plural(0, 'dia', 'dias'), '0 dias');
  assert.equal(plural(12, 'atividade', 'atividades'), '12 atividades');
});
