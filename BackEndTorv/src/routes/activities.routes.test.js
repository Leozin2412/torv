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
  assert.deepEqual(list.mock.calls[0].arguments, [USER, { type: undefined, from: undefined, before: undefined, limit: 20 }]);
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
    'from=ontem', 'from=2026-10-01', 'from=2026-10-01T10:00:00-03', 'from=2026-06-30T23:59:60Z',
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

test('GET /activities: from e before viram Date e chegam juntos ao repository', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => []);
  const app = await build(t);
  const res = await get(app, '/activities?from=2026-09-01T03:00:00.000Z&before=2026-10-01T03:00:00.000Z');
  assert.equal(res.statusCode, 200);
  const { from, before } = list.mock.calls[0].arguments[1];
  assert.ok(from instanceof Date && before instanceof Date);
  assert.deepEqual([from.toISOString(), before.toISOString()], ['2026-09-01T03:00:00.000Z', '2026-10-01T03:00:00.000Z']);
});

// /summary: o repository (mockado) devolve os dias LOCAIS com treino; a conversão UTC→local é do SQL.
async function summary(t, { days = [], calories = 0, qs = 'date=2026-10-06&tz_offset_min=-180' } = {}) {
  const strengthDays = t.mock.method(activitiesRepository, 'strengthDays', async () => days);
  const caloriesBetween = t.mock.method(activitiesRepository, 'caloriesBetween', async () => calories);
  const res = await get(await build(t), `/activities/summary?${qs}`);
  return { res, strengthDays, caloriesBetween };
}

test('GET /activities/summary: sem treino → streak 0, calorias 0', async (t) => {
  const { res } = await summary(t);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { streak_days: 0, calories_burned: 0 });
});

test('GET /activities/summary: treino hoje conta; dias seguidos somam', async (t) => {
  assert.equal((await summary(t, { days: ['2026-10-06'] })).res.json().streak_days, 1);
  assert.equal((await summary(t, { days: ['2026-10-06', '2026-10-05', '2026-10-04'] })).res.json().streak_days, 3);
});

test('GET /activities/summary: só ontem → streak viva a partir de ontem; anteontem sem ontem → 0', async (t) => {
  assert.equal((await summary(t, { days: ['2026-10-05', '2026-10-04'] })).res.json().streak_days, 2);
  assert.equal((await summary(t, { days: ['2026-10-04', '2026-10-03'] })).res.json().streak_days, 0);
});

test('GET /activities/summary: gap quebra a contagem; vira de mês e de ano', async (t) => {
  assert.equal((await summary(t, { days: ['2026-10-06', '2026-10-05', '2026-10-03', '2026-10-02'] })).res.json().streak_days, 2);
  const nye = await summary(t, { days: ['2027-01-01', '2026-12-31', '2026-12-30'], qs: 'date=2027-01-01&tz_offset_min=0' });
  assert.equal(nye.res.json().streak_days, 3);
});

test('GET /activities/summary: fuso — janela do dia local em UTC (23:30 BRT = 02:30Z do dia seguinte cai dentro)', async (t) => {
  const { strengthDays, caloriesBetween } = await summary(t, { calories: 250 });
  const [userId, opts] = strengthDays.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.equal(opts.tzOffsetMin, -180);
  assert.equal(opts.before.toISOString(), '2026-10-07T03:00:00.000Z');
  const [, win] = caloriesBetween.mock.calls[0].arguments;
  assert.deepEqual([win.from.toISOString(), win.before.toISOString()], ['2026-10-06T03:00:00.000Z', '2026-10-07T03:00:00.000Z']);
  assert.ok(new Date('2026-10-07T02:30:00Z') >= win.from && new Date('2026-10-07T02:30:00Z') < win.before);
  // Fuso positivo: dia local começa antes da meia-noite UTC.
  const plus = await summary(t, { qs: 'date=2026-10-06&tz_offset_min=540' });
  assert.equal(plus.caloriesBetween.mock.calls[0].arguments[1].from.toISOString(), '2026-10-05T15:00:00.000Z');
});

test('GET /activities/summary: calories_burned vem da soma do repository', async (t) => {
  const { res } = await summary(t, { calories: 480 });
  assert.equal(res.json().calories_burned, 480);
});

test('GET /activities/summary 400: date e tz_offset_min inválidos não chegam ao repository', async (t) => {
  const { strengthDays, caloriesBetween } = await summary(t, { qs: 'date=2026-10-06&tz_offset_min=0' });
  strengthDays.mock.resetCalls();
  caloriesBetween.mock.resetCalls();
  const app = await build(t);
  for (const qs of [
    '', 'tz_offset_min=0', 'date=2026-10-06', 'date=ontem&tz_offset_min=0', 'date=2026-1-6&tz_offset_min=0',
    'date=2026-10-06T00:00:00Z&tz_offset_min=0', 'date=2026-13-01&tz_offset_min=0', 'date=2026-00-10&tz_offset_min=0',
    'date=2026-02-31&tz_offset_min=0', 'date=2026-10-32&tz_offset_min=0',
    'date=2026-10-06&tz_offset_min=abc', 'date=2026-10-06&tz_offset_min=1.5', 'date=2026-10-06&tz_offset_min=841',
    'date=2026-10-06&tz_offset_min=-841',
  ]) {
    assert.equal((await get(app, `/activities/summary?${qs}`)).statusCode, 400, qs);
  }
  assert.equal(strengthDays.mock.callCount() + caloriesBetween.mock.callCount(), 0);
  for (const off of [-840, 840]) assert.equal((await get(app, `/activities/summary?date=2026-10-06&tz_offset_min=${off}`)).statusCode, 200);
});

test('GET /activities/summary: isolamento — user_id do cliente é ignorado, repository recebe só o do token', async (t) => {
  const { res, strengthDays, caloriesBetween } = await summary(t, { qs: 'date=2026-10-06&tz_offset_min=0&user_id=99999999-9999-4999-8999-999999999999' });
  assert.equal(res.statusCode, 200);
  assert.equal(strengthDays.mock.calls[0].arguments[0], USER);
  assert.equal(caloriesBetween.mock.calls[0].arguments[0], USER);
});
