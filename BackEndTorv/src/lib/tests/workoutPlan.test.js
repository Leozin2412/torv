const test = require('node:test');
const assert = require('node:assert/strict');
const workoutRepository = require('../../repository/workout.repository');
const { ensureDefaultPlan, planSuggestion, acceptPlan, dismissPlan, nextRoutineId } = require('../workoutPlan');

const profile = { gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso' };
const basis = { fitness_level: 'INICIANTE', goals: ['Perder Peso'], gender: 'M' };

test('ensureDefaultPlan: basis NULL → gera e salva em modo create', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...profile, savedBasis: null }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  const inputs = await ensureDefaultPlan('u1');
  assert.equal(save.mock.callCount(), 1);
  const [userId, savedBasis, routines, mode] = save.mock.calls[0].arguments;
  assert.equal(userId, 'u1');
  assert.deepEqual(savedBasis, basis);
  assert.equal(routines.length, 3);
  assert.equal(mode, 'create');
  assert.deepEqual(inputs.savedBasis, basis);
});

test('ensureDefaultPlan: plano já gerado → não salva nada', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...profile, savedBasis: basis }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  await ensureDefaultPlan('u1');
  assert.equal(save.mock.callCount(), 0);
});

test('ensureDefaultPlan: sem perfil → null, sem salvar', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => null);
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  assert.equal(await ensureDefaultPlan('u1'), null);
  assert.equal(save.mock.callCount(), 0);
});

test('planSuggestion: compara basis salvo com o perfil atual', () => {
  assert.deepEqual(planSuggestion(null), { has_suggestion: false, changed: [] });
  assert.deepEqual(planSuggestion({ ...profile, savedBasis: basis }), { has_suggestion: false, changed: [] });
  assert.deepEqual(planSuggestion({ ...profile, fitnessLevel: 'AVANÇADO', savedBasis: basis }), { has_suggestion: true, changed: ['fitness_level'] });
});

test('acceptPlan salva em modo replace; dismissPlan grava só o basis', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...profile, fitnessLevel: 'AVANÇADO', savedBasis: basis }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  const setBasis = t.mock.method(workoutRepository, 'setPlanBasis', async () => {});
  await acceptPlan('u1');
  assert.equal(save.mock.calls[0].arguments[3], 'replace');
  assert.equal(save.mock.calls[0].arguments[1].fitness_level, 'AVANÇADO');
  await dismissPlan('u1');
  assert.deepEqual(setBasis.mock.calls[0].arguments, ['u1', { ...basis, fitness_level: 'AVANÇADO' }]);
});

test('nextRoutineId: seguinte ao último treino, com volta ao início', () => {
  const routines = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(nextRoutineId(routines, null), 'a');
  assert.equal(nextRoutineId(routines, 'a'), 'b');
  assert.equal(nextRoutineId(routines, 'c'), 'a');
  assert.equal(nextRoutineId(routines, 'apagada'), 'a');
  assert.equal(nextRoutineId([], 'a'), null);
});
