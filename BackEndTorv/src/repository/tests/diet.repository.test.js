const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const { encryptField } = require('../../lib/fieldCrypto');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const BASIS = { age: 30, weight_kg: 60.5, height_cm: 165, gender: 'Feminino', fitness_level: 'INICIANTE', goals: ['Perder Peso'] };
const enc = (v, table, column, userId = USER) => encryptField(v, { table, column, userId });

let rows;
let upserted;
const fakePrisma = {
  user_profiles: { findUnique: async () => ({ gender: 'Feminino', birth_date: null, fitness_level: 'INICIANTE', goal: 'x' }) },
  user_measurements: { findFirst: async () => rows.measurement },
  nutrition_targets: {
    findUnique: async () => rows.targets,
    upsert: async (args) => { upserted = args; return {}; },
  },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
const repo = require('../diet.repository');

const measurement = (userId = USER) => ({
  weight_kg: enc(60.5, 'user_measurements', 'weight_kg', userId),
  height_cm: enc(165, 'user_measurements', 'height_cm', userId),
});

test('getCalcInputs: peso e altura decifrados', async () => {
  rows = { measurement: measurement() };
  const c = await repo.getCalcInputs(USER);
  assert.equal(c.weightKg, 60.5);
  assert.equal(c.heightCm, 165);
  rows = { measurement: null };
  const n = await repo.getCalcInputs(USER);
  assert.equal(n.weightKg, null);
  assert.equal(n.heightCm, null);
});

test('getCalcInputs: cifra de outro dono lança', async () => {
  rows = { measurement: measurement(OTHER) };
  await assert.rejects(repo.getCalcInputs(USER), /falha ao decifrar campo/);
});

test('updateTargetsBasis e upsertNutritionTargets: basis_json gravado cifrado', async () => {
  await repo.updateTargetsBasis(USER, BASIS);
  assert.match(upserted.update.basis_json, /^v1\./);
  assert.match(upserted.create.basis_json, /^v1\./);
  await repo.upsertNutritionTargets(USER, { daily_calories: 2000, protein_g: 1, carbs_g: 1, fat_g: 1, basis_json: BASIS });
  assert.match(upserted.update.basis_json, /^v1\./);
  assert.match(upserted.create.basis_json, /^v1\./);
  assert.equal(upserted.create.daily_calories, 2000);
  await repo.upsertNutritionTargets(USER, { daily_calories: 2000, protein_g: 1, carbs_g: 1, fat_g: 1 });
  assert.equal(upserted.update.basis_json, null);
});

test('getNutritionTargets: devolve o objeto original; null continua null; sem linha → null', async () => {
  rows = { targets: { user_id: USER, daily_calories: 2000, basis_json: enc(BASIS, 'nutrition_targets', 'basis_json') } };
  assert.deepEqual((await repo.getNutritionTargets(USER)).basis_json, BASIS);
  rows = { targets: { user_id: USER, basis_json: null } };
  assert.equal((await repo.getNutritionTargets(USER)).basis_json, null);
  rows = { targets: null };
  assert.equal(await repo.getNutritionTargets(USER), null);
});

test('getNutritionTargets: cifra de outro dono lança', async () => {
  rows = { targets: { user_id: USER, basis_json: enc(BASIS, 'nutrition_targets', 'basis_json', OTHER) } };
  await assert.rejects(repo.getNutritionTargets(USER), /falha ao decifrar campo/);
});
