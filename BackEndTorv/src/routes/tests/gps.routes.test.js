const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Fastify = require('fastify');

const USER = '11111111-1111-4111-8111-111111111111';
const ROUTINE = '22222222-2222-4222-8222-222222222222';
const ACTIVITY = '66666666-6666-4666-8666-666666666666';
const authPath = require.resolve('../../middlewares/auth.middleware');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: async (request) => { request.user = { userId: USER }; } };

const gpsRepository = require('../../repository/gps.repository');
const profileRepository = require('../../repository/profile.repository');

const { points } = JSON.parse(fs.readFileSync(path.join(__dirname, '../../lib/tests/fixtures/run-sample.json'), 'utf8'));
// Dentro da janela de 72 h: começou 2 h atrás e terminou ~1h12 atrás.
const recent = () => new Date(Date.now() - 2 * 3600 * 1000).toISOString();
const body = (over = {}) => ({ activity_type: 'RUN', start_time: recent(), points, ...over });

async function build(t) {
  const app = Fastify();
  app.register(require('../gps.routes'), { prefix: '/activities/gps' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const call = (app, method, url, payload) => app.inject({ method, url, payload });

function mocks(t, over = {}) {
  return {
    weight: t.mock.method(profileRepository, 'getLatestMeasurement', async () => over.weight === undefined ? { weight_kg: '75.00' } : over.weight),
    routine: t.mock.method(gpsRepository, 'findGpsRoutine', async () => over.routine === undefined ? { id: ROUTINE, name: 'Corrida leve', activity_type: 'RUN' } : over.routine),
    byStart: t.mock.method(gpsRepository, 'findByStart', async () => over.existing ?? null),
    create: t.mock.method(gpsRepository, 'createGpsActivity', over.create ?? (async () => ACTIVITY)),
  };
}

test('POST /preview: calcula as métricas da amostra e não grava nada', async (t) => {
  const m = mocks(t);
  const res = await call(await build(t), 'POST', '/activities/gps/preview', body());
  assert.equal(res.statusCode, 200);
  const out = res.json();
  assert.equal(out.activity_type, 'RUN');
  assert.equal(out.distance_m, 8671.66);
  assert.equal(out.duration_sec, 2877);
  assert.equal(out.pace_sec_per_km, 332);
  assert.equal(out.calories, 726);
  assert.equal(out.splits.length, 9);
  assert.ok(out.route.length <= 500);
  assert.equal(m.create.mock.callCount(), 0);
  assert.equal(m.weight.mock.calls[0].arguments[0], USER);
});

test('POST /preview: sem peso cadastrado → calorias null (Review Focus 4)', async (t) => {
  mocks(t, { weight: null });
  const res = await call(await build(t), 'POST', '/activities/gps/preview', body());
  assert.equal(res.json().calories, null);
});

test('POST /: 201 com o detalhe; título do GPX aparado; vazio vira o nome da rotina', async (t) => {
  const m = mocks(t);
  const app = await build(t);
  const res = await call(app, 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE, title: '  Longão  ' });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().id, ACTIVITY);
  assert.equal(res.json().title, 'Longão');
  assert.equal(res.json().routine_id, ROUTINE);
  assert.deepEqual(m.routine.mock.calls[0].arguments, [USER, ROUTINE]);
  const [userId, data] = m.create.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.equal(data.routineId, ROUTINE);
  assert.equal(data.type, 'RUN');
  assert.ok(data.startTime instanceof Date);
  assert.equal(data.metrics.distance_m, 8671.66);
  const blank = await call(app, 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE, title: '   ' });
  assert.equal(blank.json().title, 'Corrida leve');
});

test('POST /: rotina inexistente, de outro usuário ou de musculação → 404 sem gravar', async (t) => {
  const m = mocks(t, { routine: null });
  const res = await call(await build(t), 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE });
  assert.equal(res.statusCode, 404);
  assert.equal(m.create.mock.callCount(), 0);
});

test('POST /: mesmo início já importado → 409 com o activity_id; corrida no insert (P2002) também (Review Focus 2)', async (t) => {
  mocks(t, { existing: ACTIVITY });
  const app = await build(t);
  const dup = await call(app, 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE });
  assert.equal(dup.statusCode, 409);
  assert.deepEqual(dup.json(), { error: 'Activity already imported', activity_id: ACTIVITY });

  await t.test('P2002', async (st) => {
    let seen = 0;
    mocks(st, { create: async () => { throw Object.assign(new Error('unique'), { code: 'P2002' }); } });
    st.mock.method(gpsRepository, 'findByStart', async () => (seen++ === 0 ? null : ACTIVITY));
    const race = await call(await build(st), 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE });
    assert.equal(race.statusCode, 409);
    assert.deepEqual(race.json(), { error: 'Activity already imported', activity_id: ACTIVITY });
  });
});

test('POST /: teto do dia → 400 com a mensagem do repositório', async (t) => {
  mocks(t, { create: async () => { throw Object.assign(new Error('too many sessions on that day'), { code: 'SESSION_DAY_LIMIT' }); } });
  const res = await call(await build(t), 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { error: 'too many sessions on that day' });
});

test('POST /preview 400: janela, ordem, faixa, tipo, velocidade e quantidade de pontos', async (t) => {
  mocks(t);
  const app = await build(t);
  const old = new Date(Date.now() - 73 * 3600 * 1000).toISOString();
  const fast = Array.from({ length: 61 }, (_, i) => [i * 10, -15 + (i * 83.4) / 111195.08, -47]); // 30 km/h por 10 min
  const cases = [
    [{ start_time: old }, 'start_time must be within the last 72 hours'],
    [{ points: [[1, -15, -47], [2, -15, -47]] }, 'invalid point at index 0'],
    [{ points: [[0, -15, -47], [9, -15, -47], [3, -15, -47]] }, 'points must be in chronological order'],
    [{ points: [[0, -15, -47], [9, 91, -47]] }, 'invalid point at index 1'],
    [{ points: fast }, 'speed not compatible with run or walk'],
    [{ points: [[0, -15, -47], [30, -15.0001, -47]] }, 'activity too short'],
  ];
  for (const [over, error] of cases) {
    const res = await call(app, 'POST', '/activities/gps/preview', body(over));
    assert.equal(res.statusCode, 400, error);
    assert.deepEqual(res.json(), { error }, error);
  }
  for (const over of [{ activity_type: 'RIDE' }, { points: [[0, -15, -47]] }, { points: Array(30001).fill([0, -15, -47]) }, { start_time: 'ontem' }]) {
    assert.equal((await call(app, 'POST', '/activities/gps/preview', body(over))).statusCode, 400, JSON.stringify(over).slice(0, 60));
  }
});

test('POST /preview: corpo acima de 2 MiB → 413, nunca 500 (Review Focus 5)', async (t) => {
  mocks(t);
  const huge = Array.from({ length: 30000 }, (_, i) => [i, -15.123456789012345, -47.123456789012345, 1234.5678901234, 150.000001, 85.000001]);
  const res = await call(await build(t), 'POST', '/activities/gps/preview', body({ points: huge }));
  assert.equal(res.statusCode, 413);
});

test('GET, PATCH e DELETE /:id: só do dono (null do repositório → 404); PATCH devolve o detalhe', async (t) => {
  const row = {
    id: ACTIVITY, activity_type: 'RUN', title: 'Corrida', start_time: new Date('2026-10-14T10:00:00Z'), routine_id: ROUTINE,
    distance_m: '8671.66', duration_sec: 2877, calories: 726,
    activity_gps_data: { elapsed_sec: 2882, elevation_gain_m: '38.3', avg_hr: 151, max_hr: 169, avg_cadence: 175, splits: [{ km: 1, distance_m: 1000, duration_sec: 338 }], route: [[-10.5, -52.5]] },
  };
  const get = t.mock.method(gpsRepository, 'getGpsActivity', async () => row);
  const rename = t.mock.method(gpsRepository, 'renameGps', async () => true);
  const del = t.mock.method(gpsRepository, 'deleteGps', async () => true);
  const app = await build(t);
  const res = await call(app, 'GET', `/activities/gps/${ACTIVITY}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    id: ACTIVITY, activity_type: 'RUN', title: 'Corrida', start_time: '2026-10-14T10:00:00.000Z', routine_id: ROUTINE,
    distance_m: 8671.66, duration_sec: 2877, elapsed_sec: 2882, pace_sec_per_km: 332, elevation_gain_m: 38.3,
    avg_hr: 151, max_hr: 169, avg_cadence: 175, calories: 726,
    splits: [{ km: 1, distance_m: 1000, duration_sec: 338 }], route: [[-10.5, -52.5]],
  });
  assert.deepEqual(get.mock.calls[0].arguments, [USER, ACTIVITY]);
  assert.equal((await call(app, 'PATCH', `/activities/gps/${ACTIVITY}`, { title: '  Novo  ' })).statusCode, 200);
  assert.deepEqual(rename.mock.calls[0].arguments, [USER, ACTIVITY, 'Novo']);
  assert.equal((await call(app, 'PATCH', `/activities/gps/${ACTIVITY}`, { title: '   ' })).statusCode, 400);
  assert.equal((await call(app, 'DELETE', `/activities/gps/${ACTIVITY}`)).statusCode, 204);
  assert.deepEqual(del.mock.calls[0].arguments, [USER, ACTIVITY]);

  get.mock.mockImplementation(async () => null);
  rename.mock.mockImplementation(async () => false);
  del.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'GET', `/activities/gps/${ACTIVITY}`)).statusCode, 404);
  assert.equal((await call(app, 'PATCH', `/activities/gps/${ACTIVITY}`, { title: 'X' })).statusCode, 404);
  assert.equal((await call(app, 'DELETE', `/activities/gps/${ACTIVITY}`)).statusCode, 404);
  assert.equal((await call(app, 'GET', '/activities/gps/nope')).statusCode, 400);
});

test('POST /preview: 31ª chamada no mesmo minuto → 429', async (t) => {
  mocks(t);
  const app = await build(t);
  const tiny = { activity_type: 'RUN', start_time: recent(), points: [[0, -15, -47]] }; // 400 rápido; conta para o limite igual
  let last;
  for (let i = 0; i < 31; i += 1) last = await call(app, 'POST', '/activities/gps/preview', tiny);
  assert.equal(last.statusCode, 429);
});
