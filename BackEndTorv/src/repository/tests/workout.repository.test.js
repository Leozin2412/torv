const test = require('node:test');
const assert = require('node:assert/strict');

// Prisma falso (o client real é um Proxy que o mock.method não alcança): $transaction roda o callback
// com a transação do teste em andamento.
let tx = null;
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = {
  id: prismaPath, filename: prismaPath, loaded: true,
  exports: { $transaction: async (fn) => fn(tx) },
};

const workoutRepository = require('../workout.repository');

const USER = '11111111-1111-4111-8111-111111111111';
const ROUTINE = '22222222-2222-4222-8222-222222222222';
const SUPINO = '33333333-3333-4333-8333-333333333333';
const REMADA = '55555555-5555-4555-8555-555555555555';

// Rotina com Supino na posição 1 e Remada na 2, as duas com 3 séries.
function useTx(routine) {
  const calls = { findFirst: [], updateMany: [] };
  tx = {
    workout_routines: {
      findFirst: async (args) => { calls.findFirst.push(args); return routine; },
    },
    routine_exercise_sets: {
      updateMany: async (args) => { calls.updateMany.push(args); return { count: args.where.set_number <= 3 ? 1 : 0 }; },
    },
  };
  return calls;
}

const routine = {
  routine_exercises: [
    { id: 're-supino', position: 1, exercise_id: SUPINO },
    { id: 're-remada', position: 2, exercise_id: REMADA },
  ],
};

test('updateRoutineWeights: só muda séries que batem com posição + exercício; conta as atualizadas', async () => {
  const calls = useTx(routine);
  const updated = await workoutRepository.updateRoutineWeights(USER, ROUTINE, [
    { position: 1, exercise_id: SUPINO, set_number: 2, weight_kg: 65 },
    { position: 2, exercise_id: REMADA, set_number: 1, weight_kg: null },
    { position: 2, exercise_id: SUPINO, set_number: 1, weight_kg: 50 }, // exercício trocou de lugar na rotina
    { position: 3, exercise_id: REMADA, set_number: 1, weight_kg: 50 }, // posição não existe mais
    { position: 1, exercise_id: SUPINO, set_number: 4, weight_kg: 70 }, // série removida da rotina: UPDATE conta 0
  ]);
  assert.equal(updated, 2);
  assert.deepEqual(calls.findFirst[0].where, { id: ROUTINE, user_id: USER });
  assert.deepEqual(calls.updateMany, [
    { where: { routine_exercise_id: 're-supino', set_number: 2 }, data: { weight_kg: 65 } },
    { where: { routine_exercise_id: 're-remada', set_number: 1 }, data: { weight_kg: null } },
    { where: { routine_exercise_id: 're-supino', set_number: 4 }, data: { weight_kg: 70 } },
  ]);
});

test('updateRoutineWeights: rotina de outro usuário (ou inexistente) → null, sem UPDATE', async () => {
  const calls = useTx(null);
  const sets = [{ position: 1, exercise_id: SUPINO, set_number: 1, weight_kg: 40 }];
  assert.equal(await workoutRepository.updateRoutineWeights(USER, ROUTINE, sets), null);
  assert.equal(calls.updateMany.length, 0);
});
