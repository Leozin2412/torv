const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const { encryptField } = require('../../lib/fieldCrypto');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '99999999-9999-4999-8999-999999999999';
const enc = (v, column, userId = USER) => encryptField(v, { table: 'user_measurements', column, userId });

let rows;
let created;
let calls = [];
const upserts = {};
const fakePrisma = {
  $transaction: async (fn) => { calls.push('tx:start'); const r = await fn(fakePrisma); calls.push('tx:end'); return r; },
  users: { findUnique: async () => ({ id: USER }) },
  user_profiles: {
    findUnique: async () => ({ user_id: USER }),
    upsert: async (args) => { calls.push('profile.upsert'); upserts.profile = args; return {}; },
  },
  user_measurements: {
    findFirst: async () => rows.measurement,
    create: async (args) => { calls.push('measurement.create'); created = args; return {}; },
    deleteMany: async (args) => { calls.push('measurement.deleteMany'); upserts.deleted = args; return {}; },
  },
  user_streaks: { upsert: async (args) => { calls.push('streak.upsert'); upserts.streak = args; return {}; } },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
const repo = require('../profile.repository');

const stored = (userId = USER) => ({ id: 'm1', user_id: USER, weight_kg: enc(60.5, 'weight_kg', userId), height_cm: enc(165, 'height_cm', userId) });

test('addMeasurement: grava cifrado; null continua null', async () => {
  await repo.addMeasurement(USER, { weight_kg: 60.5, height_cm: null });
  assert.match(created.data.weight_kg, /^v1\./);
  assert.equal(created.data.height_cm, null);
  assert.equal(created.data.user_id, USER);
});

test('getLatestMeasurement e getUserProfile: devolvem números', async () => {
  rows = { measurement: stored() };
  const m = await repo.getLatestMeasurement(USER);
  assert.equal(typeof m.weight_kg, 'number');
  assert.equal(m.weight_kg, 60.5);
  assert.equal(m.height_cm, 165);
  const p = await repo.getUserProfile(USER);
  assert.equal(p.user_measurements[0].weight_kg, 60.5);
  assert.equal(p.user_measurements[0].height_cm, 165);
});

test('sem medição: null e lista vazia', async () => {
  rows = { measurement: null };
  assert.equal(await repo.getLatestMeasurement(USER), null);
  assert.deepEqual((await repo.getUserProfile(USER)).user_measurements, []);
});

test('cifra de outro dono: leitura lança', async () => {
  rows = { measurement: stored(OTHER) };
  await assert.rejects(repo.getLatestMeasurement(USER), /falha ao decifrar campo/);
  await assert.rejects(repo.getUserProfile(USER), /falha ao decifrar campo/);
});

const signup = { username: 'ana', name: 'Ana', birth_date: new Date('1995-04-10'), gender: 'Feminino', fitness_level: 'INICIANTE', goal: 'Perder Peso', weight_kg: 60.5, height_cm: 165 };

test('saveSignupProfile: ordem na transação e medida cifrada', async () => {
  calls = [];
  await repo.saveSignupProfile(USER, signup);
  assert.deepEqual(calls, ['tx:start', 'profile.upsert', 'measurement.deleteMany', 'measurement.create', 'streak.upsert', 'tx:end']);
  assert.deepEqual(upserts.profile.where, { user_id: USER });
  assert.equal(upserts.profile.create.user_id, USER);
  assert.equal(upserts.profile.create.username, 'ana');
  assert.equal(upserts.profile.update.user_id, undefined);
  assert.deepEqual(upserts.deleted, { where: { user_id: USER } });
  assert.match(created.data.weight_kg, /^v1\./);
  assert.match(created.data.height_cm, /^v1\./);
  assert.deepEqual(upserts.streak, { where: { user_id: USER }, create: { user_id: USER, current_streak: 0, longest_streak: 0 }, update: {} });
});

test('saveSignupProfile: repetir com outro peso grava só o novo', async () => {
  const store = [];
  fakePrisma.user_measurements.deleteMany = async () => { store.length = 0; return {}; };
  fakePrisma.user_measurements.create = async ({ data }) => { store.push(data); return {}; };
  await repo.saveSignupProfile(USER, { ...signup, weight_kg: 60 });
  await repo.saveSignupProfile(USER, { ...signup, weight_kg: 70 });
  assert.equal(store.length, 1);
  rows = { measurement: store[0] };
  assert.equal((await repo.getLatestMeasurement(USER)).weight_kg, 70);
});
