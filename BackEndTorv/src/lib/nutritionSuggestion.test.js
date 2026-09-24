const test = require('node:test');
const assert = require('node:assert/strict');
const dietRepository = require('../repository/diet.repository');
const { buildSuggestion } = require('./nutritionSuggestion');

// Perfil fixo: só o basis salvo muda entre os casos.
const INPUTS = {
  gender: 'Masculino',
  birthDate: '1996-01-15',
  fitnessLevel: 'INTERMEDIÁRIO',
  goals: 'Criar uma Rotina',
  weightKg: 80,
  heightCm: 175,
};

// Stub do repository: sem banco, só o que buildSuggestion consome.
function stubRepo(t, savedRow) {
  const calls = { updateTargetsBasis: [], upsertNutritionTargets: [] };
  t.mock.method(dietRepository, 'getCalcInputs', async () => INPUTS);
  t.mock.method(dietRepository, 'getNutritionTargets', async () => savedRow);
  t.mock.method(dietRepository, 'updateTargetsBasis', async (userId, basis) => {
    calls.updateTargetsBasis.push({ userId, basis });
  });
  t.mock.method(dietRepository, 'upsertNutritionTargets', async (userId, targets) => {
    calls.upsertNutritionTargets.push({ userId, targets });
  });
  return calls;
}

// Meta salva com os mesmos números, mas basis de um objetivo antigo (F5):
// 'Melhorar Condicionamento' e 'Criar uma Rotina' dão o mesmo kcal (ajuste 0) para este perfil.
const SAME_NUMBERS_ROW = {
  daily_calories: 2711,
  protein_g: 169,
  carbs_g: 305,
  fat_g: 90,
  basis_json: {
    age: 30, weight_kg: 80, height_cm: 175, gender: 'Masculino',
    fitness_level: 'INTERMEDIÁRIO', goals: ['Melhorar Condicionamento'],
  },
};

test('basis velho com números iguais: sem sugestão, mas o basis é recarimbado', async (t) => {
  const calls = stubRepo(t, SAME_NUMBERS_ROW);

  const result = await buildSuggestion('user-1');

  assert.deepEqual(result, { has_suggestion: false });
  assert.equal(calls.updateTargetsBasis.length, 1);
  assert.deepEqual(calls.updateTargetsBasis[0].basis.goals, ['Criar uma Rotina']);
  assert.equal(calls.updateTargetsBasis[0].userId, 'user-1');
  assert.equal(calls.upsertNutritionTargets.length, 0); // números não mudam
});

test('basis igual ao atual: nada a recarimbar', async (t) => {
  const calls = stubRepo(t, {
    ...SAME_NUMBERS_ROW,
    basis_json: { ...SAME_NUMBERS_ROW.basis_json, goals: ['Criar uma Rotina'] },
  });

  assert.deepEqual(await buildSuggestion('user-1'), { has_suggestion: false });
  assert.equal(calls.updateTargetsBasis.length, 0);
});

test('números diferentes: sugestão normal, sem recarimbar', async (t) => {
  const calls = stubRepo(t, { ...SAME_NUMBERS_ROW, daily_calories: 1500 });

  const result = await buildSuggestion('user-1');

  assert.equal(result.has_suggestion, true);
  assert.equal(result.current.daily_calories, 1500);
  assert.equal(result.suggested.daily_calories, 2711);
  assert.equal(calls.updateTargetsBasis.length, 0);
});
