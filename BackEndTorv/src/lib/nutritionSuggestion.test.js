const test = require('node:test');
const assert = require('node:assert/strict');
const dietRepository = require('../repository/diet.repository');
const { buildSuggestion } = require('./nutritionSuggestion');

// Perfil fixo: só o basis salvo muda entre os casos. O 'today' atravessa getCalcInputs ->
// computeForUser -> calculateTargets, então a idade (e os números esperados) não dependem do relógio.
const INPUTS = {
  gender: 'Masculino',
  birthDate: '1996-01-15',
  fitnessLevel: 'INTERMEDIÁRIO',
  goals: 'Criar uma Rotina',
  weightKg: 80,
  heightCm: 175,
  today: new Date('2026-09-24T12:00:00Z'),
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

test('sem meta salva: cria com o calc, sem sugestão, e calcula uma vez só', async (t) => {
  const calls = stubRepo(t, null);

  assert.deepEqual(await buildSuggestion('user-1'), { has_suggestion: false });
  assert.equal(calls.upsertNutritionTargets.length, 1);
  const { userId, targets } = calls.upsertNutritionTargets[0];
  assert.equal(userId, 'user-1');
  assert.deepEqual(
    { daily_calories: targets.daily_calories, protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g },
    { daily_calories: 2711, protein_g: 169, carbs_g: 305, fat_g: 90 },
  );
  assert.deepEqual(targets.basis_json.goals, ['Criar uma Rotina']);
  assert.equal(calls.updateTargetsBasis.length, 0);
  assert.equal(dietRepository.getCalcInputs.mock.callCount(), 1);
  assert.equal(dietRepository.getNutritionTargets.mock.callCount(), 1);
});

test('sem meta salva e outra request criou antes (P2002): engole, sem sugestão', async (t) => {
  stubRepo(t, null);
  t.mock.method(dietRepository, 'upsertNutritionTargets', async () => {
    throw Object.assign(new Error('unique'), { code: 'P2002' });
  });
  assert.deepEqual(await buildSuggestion('user-1'), { has_suggestion: false });
});

test('sem dados de perfil: sem sugestão e não cria meta', async (t) => {
  const calls = stubRepo(t, null);
  t.mock.method(dietRepository, 'getCalcInputs', async () => null);
  assert.deepEqual(await buildSuggestion('user-1'), { has_suggestion: false });
  assert.equal(calls.upsertNutritionTargets.length, 0);
});

test('meta salva e inputs do cálculo são buscados em paralelo', async (t) => {
  stubRepo(t, SAME_NUMBERS_ROW);
  let calcStarted;
  const calcCalled = new Promise((resolve) => { calcStarted = resolve; });
  t.mock.method(dietRepository, 'getCalcInputs', async () => { calcStarted(); return INPUTS; });
  // Só resolve depois que getCalcInputs já começou; em sequência, estoura o timeout.
  t.mock.method(dietRepository, 'getNutritionTargets', () => Promise.race([
    calcCalled.then(() => SAME_NUMBERS_ROW),
    new Promise((_, reject) => setTimeout(() => reject(new Error('queries em sequência')), 200)),
  ]));

  assert.deepEqual(await buildSuggestion('user-1'), { has_suggestion: false });
});
