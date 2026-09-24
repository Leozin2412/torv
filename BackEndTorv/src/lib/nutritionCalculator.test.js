const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTargets, ageOn, diffBasis } = require('./nutritionCalculator');

const TODAY = new Date('2026-09-24T12:00:00Z');
const base = {
  gender: 'Masculino',
  birthDate: '1996-01-15', // 30 anos em TODAY
  weightKg: 80,
  heightCm: 175,
  fitnessLevel: 'INTERMEDIÁRIO',
  today: TODAY,
};

test('exemplo da planilha: Perder Peso + Criar uma Rotina', () => {
  const r = calculateTargets({ ...base, goals: 'Perder Peso, Criar uma Rotina' });
  assert.equal(r.bmi, 26.1);
  assert.equal(r.bmiClass, 'over');
  assert.equal(r.adjust, -225);
  assert.equal(r.daily_calories, 2486); // 1748.75 * 1.55 - 225
  assert.equal(r.protein_g, 171);
  assert.equal(r.carbs_g, 264);
  assert.equal(r.fat_g, 83);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.basis, {
    age: 30, weight_kg: 80, height_cm: 175, gender: 'Masculino',
    fitness_level: 'INTERMEDIÁRIO', goals: ['Criar uma Rotina', 'Perder Peso'],
  });
});

test('conflito: acima do peso, Perder Peso + Ganhar Massa → média -137.5 e alerta', () => {
  const r = calculateTargets({ ...base, goals: ['Perder Peso', 'Ganhar Massa Muscular'] });
  assert.equal(r.adjust, -137.5); // (-450 + 350/2) / 2
  assert.equal(r.daily_calories, 2573);
  assert.equal(r.protein_g, 193);
  assert.equal(r.carbs_g, 273);
  assert.equal(r.fat_g, 79);
  assert.deepEqual(r.warnings, ['GOAL_CONFLICT']);
});

test('abaixo do peso + Perder Peso → ajuste zerado', () => {
  const r = calculateTargets({ ...base, weightKg: 50, goals: 'Perder Peso' });
  assert.equal(r.bmiClass, 'under');
  assert.equal(r.adjust, 0);
});

test('65+ usa faixa Lipschitz: IMC 26 é ideal aos 70, acima aos 40', () => {
  const old = calculateTargets({ ...base, weightKg: 79.6, birthDate: '1956-01-15', goals: 'Perder Peso' });
  const adult = calculateTargets({ ...base, weightKg: 79.6, birthDate: '1986-01-15', goals: 'Perder Peso' });
  assert.equal(old.bmi, 26);
  assert.equal(old.bmiClass, 'normal');
  assert.equal(adult.bmiClass, 'over');
});

test('mulher, iniciante, Saúde & Bem-estar', () => {
  const r = calculateTargets({
    gender: 'Feminino', birthDate: '2001-01-15', weightKg: 60, heightCm: 165,
    fitnessLevel: 'INICIANTE', goals: 'Saúde & Bem-estar', today: TODAY,
  });
  assert.equal(r.daily_calories, 1614); // (600 + 1031.25 - 125 - 161) * 1.2
  assert.equal(r.protein_g, 101);
  assert.equal(r.carbs_g, 182);
  assert.equal(r.fat_g, 54);
});

test('sem objetivos válidos → Saúde & Bem-estar; nível desconhecido → INICIANTE', () => {
  const r = calculateTargets({ ...base, fitnessLevel: null, goals: 'Objetivo Inventado' });
  assert.deepEqual(r.basis.goals, ['Saúde & Bem-estar']);
  assert.equal(r.basis.fitness_level, 'INICIANTE');
});

test('peso Decimal-like (string) funciona', () => {
  const r = calculateTargets({ ...base, weightKg: '80.00', goals: 'Criar uma Rotina' });
  assert.equal(r.basis.weight_kg, 80);
});

test('dado faltando → null', () => {
  assert.equal(calculateTargets({ ...base, weightKg: null, goals: 'Perder Peso' }), null);
  assert.equal(calculateTargets({ ...base, birthDate: null, goals: 'Perder Peso' }), null);
  assert.equal(calculateTargets({ ...base, gender: 'Outro', goals: 'Perder Peso' }), null);
  assert.equal(calculateTargets({ ...base, heightCm: undefined, goals: 'Perder Peso' }), null);
});

test('ageOn vira no dia do aniversário', () => {
  assert.equal(ageOn('1996-09-24', new Date('2026-09-23T12:00:00Z')), 29);
  assert.equal(ageOn('1996-09-24', new Date('2026-09-24T12:00:00Z')), 30);
  assert.equal(ageOn(new Date('1996-09-24T00:00:00.000Z'), new Date('2026-09-24T12:00:00Z')), 30);
});

test('diffBasis', () => {
  const cur = calculateTargets({ ...base, goals: 'Perder Peso' }).basis;
  assert.deepEqual(diffBasis(null, cur), ['age', 'weight_kg', 'height_cm', 'gender', 'fitness_level', 'goals']);
  assert.deepEqual(diffBasis({ ...cur }, cur), []);
  assert.deepEqual(diffBasis({ ...cur, age: 29, goals: ['Criar uma Rotina'] }, cur), ['age', 'goals']);
  assert.deepEqual(diffBasis({ ...cur, weight_kg: '80' }, cur), []); // JSON guarda número; tolera string
});

test('chaves da prototype chain não viram nível/sexo/objetivo válidos', () => {
  const proto = calculateTargets({ ...base, fitnessLevel: 'constructor', goals: 'Perder Peso' });
  assert.equal(proto.basis.fitness_level, 'INICIANTE');
  assert.ok(Number.isFinite(proto.daily_calories));
  assert.ok(Number.isFinite(proto.protein_g));

  assert.equal(calculateTargets({ ...base, gender: 'constructor', goals: 'Perder Peso' }), null);
  assert.equal(calculateTargets({ ...base, gender: 'toString', goals: 'Perder Peso' }), null);

  const goals = calculateTargets({ ...base, goals: 'constructor, toString' });
  assert.deepEqual(goals.basis.goals, ['Saúde & Bem-estar']);
  assert.ok(Number.isFinite(goals.daily_calories));
});
