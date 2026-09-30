const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

// O middleware real valida JWT contra o JWKS do Supabase (e quebra sem SUPABASE_URL). Aqui todo request é do USER.
const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const workoutRepository = require('../repository/workout.repository');

const ID = '22222222-2222-4222-8222-222222222222';
const EX = '33333333-3333-4333-8333-333333333333';
const basis = { fitness_level: 'INICIANTE', goals: ['Perder Peso'], gender: 'M' };
const inputs = { gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso', savedBasis: basis };
const routineRow = {
  id: ID, name: 'Peito', is_default: false,
  routine_exercises: [{
    id: 'reid', exercise_id: EX, position: 1, reps_min: 8, reps_max: 12, rest_sec: 60,
    exercise: { name: 'Supino', muscle_group: 'Peito' },
    sets: [{ set_number: 1, weight_kg: '40.50' }, { set_number: 2, weight_kg: null }],
  }],
};
const validRoutine = { name: '  Peito  ', exercises: [{ exercise_id: EX, reps_min: 8, reps_max: 12, rest_sec: 60, sets: [{ weight_kg: 40.5 }, { weight_kg: null }] }] };

async function build(t) {
  const app = Fastify();
  app.register(require('./workout.routes'), { prefix: '/workouts' });
  t.after(() => app.close());
  await app.ready();
  return app;
}

const call = (app, method, url, payload) => app.inject({ method, url, payload });

test('GET /routines: gera plano na 1ª vez e monta lista, próximo e sugestão', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...inputs, savedBasis: null }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  t.mock.method(workoutRepository, 'listRoutines', async () => [
    { id: 'a', name: 'Dia 1', is_default: true, routine_exercises: [{ _count: { sets: 3 } }, { _count: { sets: 3 } }] },
    { id: 'b', name: 'Dia 2', is_default: true, routine_exercises: [{ _count: { sets: 4 } }] },
  ]);
  t.mock.method(workoutRepository, 'lastRoutineId', async () => 'a');
  const app = await build(t);
  const res = await call(app, 'GET', '/workouts/routines');
  assert.equal(res.statusCode, 200);
  assert.equal(save.mock.callCount(), 1);
  assert.deepEqual(res.json(), {
    routines: [
      { id: 'a', name: 'Dia 1', is_default: true, exercise_count: 2, set_count: 6 },
      { id: 'b', name: 'Dia 2', is_default: true, exercise_count: 1, set_count: 4 },
    ],
    next_routine_id: 'b',
    plan_suggestion: { has_suggestion: false, changed: [] },
  });
});

test('GET /routines: perfil mudou → plan_suggestion com changed', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...inputs, fitnessLevel: 'AVANÇADO' }));
  t.mock.method(workoutRepository, 'listRoutines', async () => []);
  t.mock.method(workoutRepository, 'lastRoutineId', async () => null);
  const app = await build(t);
  const res = await call(app, 'GET', '/workouts/routines');
  assert.deepEqual(res.json().plan_suggestion, { has_suggestion: true, changed: ['fitness_level'] });
  assert.equal(res.json().next_routine_id, null);
});

test('GET /routines/:id: detalhe com carga numérica; alheia → 404; id inválido → 400', async (t) => {
  const get = t.mock.method(workoutRepository, 'getRoutine', async () => routineRow);
  const app = await build(t);
  const res = await call(app, 'GET', `/workouts/routines/${ID}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().exercises[0].sets, [{ set_number: 1, weight_kg: 40.5 }, { set_number: 2, weight_kg: null }]);
  assert.deepEqual(get.mock.calls[0].arguments, [USER, ID]);

  get.mock.mockImplementation(async () => null);
  assert.equal((await call(app, 'GET', `/workouts/routines/${ID}`)).statusCode, 404);
  assert.equal((await call(app, 'GET', '/workouts/routines/nope')).statusCode, 400);
});

test('POST /routines 201: nome aparado, exercícios visíveis', async (t) => {
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const create = t.mock.method(workoutRepository, 'createRoutine', async () => ID);
  t.mock.method(workoutRepository, 'getRoutine', async () => routineRow);
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/routines', validRoutine);
  assert.equal(res.statusCode, 201);
  const [userId, data] = create.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.equal(data.name, 'Peito');
  assert.equal(res.json().id, ID);
});

test('POST /routines: weight_kg null chega null, 0 e 5 chegam como número (sem coerceTypes)', async (t) => {
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const create = t.mock.method(workoutRepository, 'createRoutine', async () => ID);
  t.mock.method(workoutRepository, 'getRoutine', async () => routineRow);
  const app = await build(t);
  const sets = [{ weight_kg: null }, { weight_kg: 0 }, { weight_kg: 5 }];
  const res = await call(app, 'POST', '/workouts/routines', { ...validRoutine, exercises: [{ ...validRoutine.exercises[0], sets }] });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(create.mock.calls[0].arguments[1].exercises[0].sets, sets);
});

test('POST /routines 400: limites, regras cruzadas e exercício alheio', async (t) => {
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const create = t.mock.method(workoutRepository, 'createRoutine', async () => ID);
  const app = await build(t);
  const ex = validRoutine.exercises[0];
  const bad = [
    { name: '' },
    { name: '   ' },
    { name: 'x'.repeat(101) },
    { exercises: [] },
    { exercises: Array(21).fill(ex) },
    { exercises: [{ ...ex, exercise_id: 'nope' }] },
    { exercises: [{ ...ex, reps_min: 0 }] },
    { exercises: [{ ...ex, reps_max: 101 }] },
    { exercises: [{ ...ex, reps_min: 13, reps_max: 12 }] },
    { exercises: [{ ...ex, rest_sec: -1 }] },
    { exercises: [{ ...ex, rest_sec: 601 }] },
    { exercises: [{ ...ex, sets: [] }] },
    { exercises: [{ ...ex, sets: Array(11).fill({ weight_kg: null }) }] },
    { exercises: [{ ...ex, sets: [{ weight_kg: -1 }] }] },
    { exercises: [{ ...ex, sets: [{ weight_kg: 1000 }] }] },
  ];
  for (const override of bad) {
    const res = await call(app, 'POST', '/workouts/routines', { ...validRoutine, ...override });
    assert.equal(res.statusCode, 400, JSON.stringify(override).slice(0, 80));
  }
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 0);
  const res = await call(app, 'POST', '/workouts/routines', validRoutine);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { error: 'exercise not found' });
  assert.equal(create.mock.callCount(), 0);
});

test('PUT /routines/:id: alheia → 404; própria → 200', async (t) => {
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const update = t.mock.method(workoutRepository, 'updateRoutine', async () => false);
  t.mock.method(workoutRepository, 'getRoutine', async () => routineRow);
  const app = await build(t);
  assert.equal((await call(app, 'PUT', `/workouts/routines/${ID}`, validRoutine)).statusCode, 404);
  update.mock.mockImplementation(async () => true);
  const res = await call(app, 'PUT', `/workouts/routines/${ID}`, validRoutine);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(update.mock.calls[1].arguments.slice(0, 2), [USER, ID]);
});

test('DELETE /routines/:id: alheia → 404; própria → 204', async (t) => {
  const del = t.mock.method(workoutRepository, 'deleteRoutine', async () => false);
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/workouts/routines/${ID}`)).statusCode, 404);
  del.mock.mockImplementation(async () => true);
  assert.equal((await call(app, 'DELETE', `/workouts/routines/${ID}`)).statusCode, 204);
});

test('POST /plan/accept troca em modo replace; /plan/dismiss grava basis', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...inputs, fitnessLevel: 'AVANÇADO' }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  const setBasis = t.mock.method(workoutRepository, 'setPlanBasis', async () => {});
  t.mock.method(workoutRepository, 'listRoutines', async () => []);
  t.mock.method(workoutRepository, 'lastRoutineId', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'POST', '/workouts/plan/accept')).statusCode, 200);
  assert.equal(save.mock.calls[0].arguments[3], 'replace');
  assert.equal((await call(app, 'POST', '/workouts/plan/dismiss')).statusCode, 200);
  assert.equal(setBasis.mock.calls[0].arguments[1].fitness_level, 'AVANÇADO');
});

test('exercícios: lista marca is_custom; criar valida grupo e nome; alheio → 404', async (t) => {
  t.mock.method(workoutRepository, 'listExercises', async () => [
    { id: 'c', name: 'Supino', muscle_group: 'Peito', owner_user_id: null },
    { id: 'm', name: 'Meu', muscle_group: 'Peito', owner_user_id: USER },
  ]);
  const create = t.mock.method(workoutRepository, 'createExercise', async () => ({ id: EX }));
  const update = t.mock.method(workoutRepository, 'updateExercise', async () => false);
  const del = t.mock.method(workoutRepository, 'deleteExercise', async () => false);
  const app = await build(t);

  assert.deepEqual((await call(app, 'GET', '/workouts/exercises')).json().exercises.map((e) => e.is_custom), [false, true]);
  assert.equal((await call(app, 'POST', '/workouts/exercises', { name: 'X', muscle_group: 'Pescoço' })).statusCode, 400);
  assert.equal((await call(app, 'POST', '/workouts/exercises', { name: '  ', muscle_group: 'Peito' })).statusCode, 400);
  const res = await call(app, 'POST', '/workouts/exercises', { name: ' Supino torto ', muscle_group: 'Peito' });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { id: EX, name: 'Supino torto', muscle_group: 'Peito', is_custom: true });
  assert.deepEqual(create.mock.calls[0].arguments, [USER, { name: 'Supino torto', muscle_group: 'Peito' }]);

  assert.equal((await call(app, 'PUT', `/workouts/exercises/${EX}`, { name: 'Y', muscle_group: 'Costas' })).statusCode, 404);
  assert.equal((await call(app, 'DELETE', `/workouts/exercises/${EX}`)).statusCode, 404);
  update.mock.mockImplementation(async () => true);
  del.mock.mockImplementation(async () => true);
  assert.equal((await call(app, 'PUT', `/workouts/exercises/${EX}`, { name: 'Y', muscle_group: 'Costas' })).statusCode, 200);
  assert.equal((await call(app, 'DELETE', `/workouts/exercises/${EX}`)).statusCode, 204);
});
