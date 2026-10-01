const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

// O middleware real valida JWT contra o JWKS do Supabase. Aqui todo request é do USER.
const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const activitiesRepository = require('../repository/activities.repository');

async function build(t) {
  const app = Fastify();
  app.register(require('./activities.routes'), { prefix: '/activities' });
  t.after(() => app.close());
  await app.ready();
  return app;
}

const get = (app, url) => app.inject({ method: 'GET', url });
const row = (i, extra = {}) => ({
  id: `id-${i}`, activity_type: 'STRENGTH', title: `Treino ${i}`,
  start_time: new Date(Date.UTC(2026, 8, 30 - i, 20)), duration_sec: 3000, _count: { workout_sets: 3 }, ...extra,
});

test('GET /activities: limit padrão 20, sem filtro; página incompleta → next_before null', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => [
    row(0),
    row(1, { title: null, duration_sec: null, _count: { workout_sets: 0 } }),
  ]);
  const app = await build(t);
  const res = await get(app, '/activities');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    activities: [
      { id: 'id-0', activity_type: 'STRENGTH', title: 'Treino 0', start_time: '2026-09-30T20:00:00.000Z', duration_sec: 3000, set_count: 3 },
      { id: 'id-1', activity_type: 'STRENGTH', title: '', start_time: '2026-09-29T20:00:00.000Z', duration_sec: 0, set_count: 0 },
    ],
    next_before: null,
  });
  assert.deepEqual(list.mock.calls[0].arguments, [USER, { type: undefined, before: undefined, limit: 20 }]);
});

test('GET /activities: página cheia → next_before = start_time do último; type/before/limit repassados', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => [row(0), row(1)]);
  const app = await build(t);
  const res = await get(app, '/activities?type=STRENGTH&limit=2&before=2026-10-01T00:00:00.000Z');
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().next_before, '2026-09-29T20:00:00.000Z');
  const [userId, opts] = list.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.equal(opts.type, 'STRENGTH');
  assert.equal(opts.limit, 2);
  assert.ok(opts.before instanceof Date);
  assert.equal(opts.before.toISOString(), '2026-10-01T00:00:00.000Z');
});

test('GET /activities 400: type, limit e before inválidos não chegam ao repository', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => []);
  const app = await build(t);
  for (const qs of [
    'type=RUN', 'type=strength', 'limit=0', 'limit=51', 'limit=abc', 'before=ontem', 'before=2026-10-01',
    // Passam no date-time do ajv-formats, mas o Date do JS não parseia (fuso só com hora, segundo bissexto). %2B = '+'.
    'before=2026-10-01T10:00:00-03', 'before=2026-06-30T23:59:60Z', 'before=2026-10-01T02:59:60%2B03:00',
  ]) {
    assert.equal((await get(app, `/activities?${qs}`)).statusCode, 400, qs);
  }
  assert.equal(list.mock.callCount(), 0);
});

test('GET /activities: user_id vindo do cliente é ignorado', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => []);
  const app = await build(t);
  const res = await get(app, '/activities?user_id=99999999-9999-4999-8999-999999999999');
  assert.equal(res.statusCode, 200);
  assert.equal(list.mock.calls[0].arguments[0], USER);
});
