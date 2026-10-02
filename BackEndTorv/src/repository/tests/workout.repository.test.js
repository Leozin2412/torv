const test = require('node:test');
const assert = require('node:assert/strict');

// Prisma falso (o client real é um Proxy que o mock.method não alcança): registra as chamadas do teste em andamento.
let calls = null;
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = {
  id: prismaPath, filename: prismaPath, loaded: true,
  exports: {
    workout_routines: { findFirst: async (args) => { calls.findFirst.push(args); return calls.routine; } },
    $executeRaw: async (query) => { calls.executeRaw.push(query); return calls.count; },
  },
};

const workoutRepository = require('../workout.repository');

const USER = '11111111-1111-4111-8111-111111111111';
const ROUTINE = '22222222-2222-4222-8222-222222222222';
const SUPINO = '33333333-3333-4333-8333-333333333333';
const REMADA = '55555555-5555-4555-8555-555555555555';

// O casamento posição + exercício + nº da série acontece no SQL; o teste ao vivo (QA) cobre o efeito no banco.
test('updateRoutineWeights: um UPDATE só, preso à rotina e ao dono, com as séries em VALUES', async () => {
  calls = { findFirst: [], executeRaw: [], routine: { id: ROUTINE }, count: 2 };
  const updated = await workoutRepository.updateRoutineWeights(USER, ROUTINE, [
    { position: 1, exercise_id: SUPINO, set_number: 2, weight_kg: 65 },
    { position: 2, exercise_id: REMADA, set_number: 1, weight_kg: null },
  ]);
  assert.equal(updated, 2);
  assert.deepEqual(calls.findFirst[0].where, { id: ROUTINE, user_id: USER });
  assert.equal(calls.executeRaw.length, 1);
  const [query] = calls.executeRaw;
  const sql = query.sql.replace(/\s+/g, ' ');
  assert.match(sql, /UPDATE routine_exercise_sets AS rs SET weight_kg = v\.weight_kg/);
  assert.match(sql, /wr\.id = \?::uuid AND wr\.user_id = \?::uuid/);
  assert.match(sql, /re\.position = v\.position AND re\.exercise_id = v\.exercise_id AND rs\.set_number = v\.set_number/);
  assert.deepEqual(query.values, [1, SUPINO, 2, 65, 2, REMADA, 1, null, ROUTINE, USER]);
});

test('updateRoutineWeights: rotina de outro usuário (ou inexistente) → null, sem UPDATE', async () => {
  calls = { findFirst: [], executeRaw: [], routine: null, count: 0 };
  const sets = [{ position: 1, exercise_id: SUPINO, set_number: 1, weight_kg: 40 }];
  assert.equal(await workoutRepository.updateRoutineWeights(USER, ROUTINE, sets), null);
  assert.equal(calls.executeRaw.length, 0);
});
