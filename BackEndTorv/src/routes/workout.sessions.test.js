const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const workoutRepository = require('../repository/workout.repository');

const ID = '22222222-2222-4222-8222-222222222222';
const EX = '33333333-3333-4333-8333-333333333333';
const ACT = '44444444-4444-4444-8444-444444444444';
const startedAt = new Date(Date.now() - 3600 * 1000).toISOString();
const validSession = {
  routine_id: ID,
  started_at: startedAt,
  duration_sec: 3000,
  sets: [
    { exercise_id: EX, position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null },
    { exercise_id: EX, position: 1, set_number: 2, duration_sec: 38, rest_before_sec: 125 },
  ],
};

async function build(t) {
  const app = Fastify();
  app.register(require('./workout.routes'), { prefix: '/workouts' });
  t.after(() => app.close());
  await app.ready();
  return app;
}

const call = (app, method, url, payload) => app.inject({ method, url, payload });

test('POST /sessions 201: grava com started_at como Date', async (t) => {
  t.mock.method(workoutRepository, 'findSessionByStart', async () => null);
  const create = t.mock.method(workoutRepository, 'createSession', async () => ACT);
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/sessions', validSession);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { activity_id: ACT });
  const [userId, data] = create.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.ok(data.started_at instanceof Date);
  assert.equal(data.started_at.toISOString(), startedAt);
  assert.equal(data.sets.length, 2);
});

test('POST /sessions repetido → 200 com o mesmo id, sem inserir', async (t) => {
  t.mock.method(workoutRepository, 'findSessionByStart', async () => ACT);
  const create = t.mock.method(workoutRepository, 'createSession', async () => 'outro');
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/sessions', validSession);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { activity_id: ACT });
  assert.equal(create.mock.callCount(), 0);
});

test('POST /sessions: corrida no índice único (P2002) → 200 com o id que ganhou', async (t) => {
  const find = t.mock.method(workoutRepository, 'findSessionByStart', async () => null);
  t.mock.method(workoutRepository, 'createSession', async () => {
    find.mock.mockImplementation(async () => ACT);
    throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
  });
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/sessions', validSession);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { activity_id: ACT });
});

test('POST /sessions 400: limites e datas', async (t) => {
  t.mock.method(workoutRepository, 'findSessionByStart', async () => null);
  const create = t.mock.method(workoutRepository, 'createSession', async () => ACT);
  const app = await build(t);
  const set = validSession.sets[0];
  const bad = [
    { started_at: '2025-12-31T23:59:59Z' },
    { started_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
    { started_at: 'ontem' },
    { duration_sec: 0 },
    { duration_sec: 21601 },
    { sets: [] },
    { sets: Array(201).fill(set) },
    { sets: [{ ...set, position: 21 }] },
    { sets: [{ ...set, set_number: 11 }] },
    { sets: [{ ...set, duration_sec: 3601 }] },
    { sets: [{ ...set, rest_before_sec: 7201 }] },
    { sets: [{ ...set, exercise_id: 'nope' }] },
    { routine_id: 'nope' },
  ];
  for (const override of bad) {
    const res = await call(app, 'POST', '/workouts/sessions', { ...validSession, ...override });
    assert.equal(res.statusCode, 400, JSON.stringify(override).slice(0, 80));
  }
  assert.equal(create.mock.callCount(), 0);
});

test('GET /sessions: limite padrão 10, máx 50; datas em ISO', async (t) => {
  const list = t.mock.method(workoutRepository, 'listSessions', async () => [
    { id: ACT, title: 'Dia 1 — Corpo todo A', start_time: new Date(startedAt), duration_sec: 3000, _count: { workout_sets: 2 } },
  ]);
  const app = await build(t);
  const res = await call(app, 'GET', '/workouts/sessions');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { sessions: [{ id: ACT, title: 'Dia 1 — Corpo todo A', start_time: startedAt, duration_sec: 3000, set_count: 2 }] });
  assert.deepEqual(list.mock.calls[0].arguments, [USER, 10]);
  await call(app, 'GET', '/workouts/sessions?limit=5');
  assert.equal(list.mock.calls[1].arguments[1], 5);
  assert.equal((await call(app, 'GET', '/workouts/sessions?limit=51')).statusCode, 400);
});

test('GET /sessions/:id: própria → séries; alheia → 404', async (t) => {
  const get = t.mock.method(workoutRepository, 'getSession', async () => ({
    id: ACT, title: 'Treino livre', start_time: new Date(startedAt), duration_sec: 3000,
    workout_sets: [{ exercise_name: 'Exercício removido', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null }],
  }));
  const app = await build(t);
  const res = await call(app, 'GET', `/workouts/sessions/${ACT}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().sets[0].exercise_name, 'Exercício removido');
  assert.deepEqual(get.mock.calls[0].arguments, [USER, ACT]);
  get.mock.mockImplementation(async () => null);
  assert.equal((await call(app, 'GET', `/workouts/sessions/${ACT}`)).statusCode, 404);
});

// coerceTypes do Ajv: Union([X, Null]) num corpo coage null para o 1º ramo (ver 690c02f).
test('POST /sessions: null fica null, 0 fica 0 (rest_before_sec e routine_id)', async (t) => {
  t.mock.method(workoutRepository, 'findSessionByStart', async () => null);
  const create = t.mock.method(workoutRepository, 'createSession', async () => ACT);
  const app = await build(t);
  const sets = [
    { ...validSession.sets[0], rest_before_sec: null, duration_sec: 0 },
    { ...validSession.sets[1], rest_before_sec: 0 },
    { ...validSession.sets[1], set_number: 3, rest_before_sec: 7200 },
  ];
  assert.equal((await call(app, 'POST', '/workouts/sessions', { ...validSession, routine_id: null, sets })).statusCode, 201);
  const [, data] = create.mock.calls[0].arguments;
  assert.equal(data.routine_id, null);
  assert.deepEqual(data.sets.map((s) => [s.rest_before_sec, s.duration_sec]), [[null, 0], [0, 38], [7200, 38]]);

  const { routine_id, ...noRoutine } = validSession;
  assert.equal((await call(app, 'POST', '/workouts/sessions', noRoutine)).statusCode, 201);
  assert.equal(create.mock.calls[1].arguments[1].routine_id, undefined);

  for (const bad of [{ routine_id: '' }, { routine_id: 0 }, { sets: [{ ...sets[1], rest_before_sec: -1 }] }, { sets: [{ ...sets[1], rest_before_sec: 7201 }] }]) {
    assert.equal((await call(app, 'POST', '/workouts/sessions', { ...validSession, ...bad })).statusCode, 400, JSON.stringify(bad));
  }
  assert.equal(create.mock.callCount(), 2);
});
