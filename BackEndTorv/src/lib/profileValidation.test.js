const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfileUpdate } = require('./profileValidation');

test('nada enviado → erro', () => {
  assert.ok(validateProfileUpdate({}).error);
});

test('username e goal válidos passam como hoje', () => {
  const r = validateProfileUpdate({ username: 'leo', goal: 'Perder Peso, Criar uma Rotina' });
  assert.deepEqual(r, { profileData: { username: 'leo', goal: 'Perder Peso, Criar uma Rotina' }, measurement: null });
});

test('goal com objetivo desconhecido → erro', () => {
  assert.ok(validateProfileUpdate({ goal: 'Perder Peso, Voar' }).error);
  assert.ok(validateProfileUpdate({ goal: '' }).error);
});

test('fitness_level só aceita os 3 valores', () => {
  assert.deepEqual(validateProfileUpdate({ fitness_level: 'AVANÇADO' }).profileData, { fitness_level: 'AVANÇADO' });
  assert.ok(validateProfileUpdate({ fitness_level: 'PRO' }).error);
});

test('peso e altura dentro das faixas viram measurement', () => {
  const r = validateProfileUpdate({ weight_kg: 72.5, height_cm: 180 });
  assert.deepEqual(r, { profileData: {}, measurement: { weight_kg: 72.5, height_cm: 180 } });
  assert.deepEqual(validateProfileUpdate({ weight_kg: 70 }).measurement, { weight_kg: 70 });
});

test('peso/altura fora da faixa ou altura não inteira → erro', () => {
  assert.ok(validateProfileUpdate({ weight_kg: 19.9 }).error);
  assert.ok(validateProfileUpdate({ weight_kg: 300.1 }).error);
  assert.ok(validateProfileUpdate({ height_cm: 49 }).error);
  assert.ok(validateProfileUpdate({ height_cm: 251 }).error);
  assert.ok(validateProfileUpdate({ height_cm: 175.5 }).error);
});
