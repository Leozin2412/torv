const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

// O middleware real valida JWT contra o JWKS do Supabase. Aqui todo request é do USER.
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '44444444-4444-4444-8444-444444444444';
const authPath = require.resolve('../../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const usersRepository = require('../../repository/users.repository');
const activitiesRepository = require('../../repository/activities.repository');

// publicUrl lê a env na chamada; o resto do app não precisa dela.
Object.assign(process.env, { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SECRET_KEY: 'test-key', SUPABASE_STORAGE_BUCKET: 'torv-photos' });
const PUB = 'https://proj.supabase.co/storage/v1/object/public/torv-photos';

async function build(t) {
  const app = Fastify();
  app.register(require('../users.routes'), { prefix: '/users' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const get = (app, url) => app.inject({ method: 'GET', url });
const QS = 'date=2026-10-14&tz_offset_min=-180';
const dc = (...pairs) => pairs.map(([day, count]) => ({ day, count }));
const profileRow = (over = {}) => ({
  user_id: OTHER, name: 'Bia', username: 'bia', photo_url: 'bia.jpg', fitness_level: 'INTERMEDIÁRIO', ...over,
});
const row = (i, extra = {}) => ({
  id: `id-${i}`, activity_type: 'STRENGTH', title: `Treino ${i}`, distance_m: null,
  start_time: new Date(Date.UTC(2026, 9, 14 - i, 20)), duration_sec: 3000, _count: { workout_sets: 3 }, ...extra,
});

function mocks(t, { shares = true, profile = profileRow(), dayCounts = [], rows = [] } = {}) {
  return {
    shares: t.mock.method(usersRepository, 'sharesGroup', async () => shares),
    profile: t.mock.method(usersRepository, 'getPublicProfile', async () => profile),
    days: t.mock.method(activitiesRepository, 'dayCounts', async () => dayCounts),
    list: t.mock.method(activitiesRepository, 'listActivities', async () => rows),
  };
}

test('GET /users/:id/profile: membro de grupo em comum → 200 com o contrato inteiro', async (t) => {
  const m = mocks(t, { dayCounts: dc(['2026-09-02', 1], ['2026-10-01', 2], ['2026-10-13', 1], ['2026-10-14', 3]) });
  const res = await get(await build(t), `/users/${OTHER}/profile?${QS}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    user: { id: OTHER, name: 'Bia', username: 'bia', photo_url: `${PUB}/bia.jpg`, fitness_level: 'INTERMEDIÁRIO' },
    is_me: false,
    streak: { current: 2, longest: 2 },
    month: { active_days: 3, activities: 6, active_days_delta: 2 },
    total_activities: 7,
    calendar: {
      start: '2025-10-12',
      end: '2026-10-14',
      days: [
        { date: '2026-09-02', count: 1 }, { date: '2026-10-01', count: 2 },
        { date: '2026-10-13', count: 1 }, { date: '2026-10-14', count: 3 },
      ],
    },
  });
  assert.deepEqual(m.shares.mock.calls[0].arguments, [USER, OTHER]);
  assert.equal(m.profile.mock.calls[0].arguments[0], OTHER);
  const [uid, opts] = m.days.mock.calls[0].arguments;
  assert.equal(uid, OTHER);
  assert.equal(opts.tzOffsetMin, -180);
  // Nada datado depois do fim do dia local de quem vê entra na conta (Review Focus 1).
  assert.equal(opts.before.toISOString(), '2026-10-15T03:00:00.000Z');
});

test('GET /users/:id/profile: o próprio usuário vê sem grupo (sharesGroup nem é chamado); is_me true', async (t) => {
  const m = mocks(t, { shares: false, profile: profileRow({ user_id: USER, name: 'Ana', username: 'ana', photo_url: null, fitness_level: null }) });
  const res = await get(await build(t), `/users/${USER}/profile?${QS}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().is_me, true);
  assert.deepEqual(res.json().user, { id: USER, name: 'Ana', username: 'ana', photo_url: null, fitness_level: null });
  assert.equal(m.shares.mock.callCount(), 0);
});

test('GET /users/:id/profile: UUID do próprio usuário em maiúsculas continua sendo "eu"', async (t) => {
  const m = mocks(t, { shares: false, profile: profileRow({ user_id: USER }) });
  const res = await get(await build(t), `/users/${USER.toUpperCase()}/profile?${QS}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().is_me, true);
  assert.equal(res.json().user.id, USER);
  assert.equal(m.shares.mock.callCount(), 0);
});

test('GET /users/:id/profile: sem grupo em comum ou inexistente → 404 sem nenhum dado (Review Focus 3)', async (t) => {
  for (const [label, shares, profile] of [['sem grupo', false, profileRow()], ['sem perfil', true, null], ['nenhum dos dois', false, null]]) {
    await t.test(label, async (st) => {
      mocks(st, { shares, profile, dayCounts: dc(['2026-10-14', 5]) });
      const res = await get(await build(st), `/users/${OTHER}/profile?${QS}`);
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.json(), { error: 'Not found' });
    });
  }
});

test('GET /users/:id/profile 400: data inválida, fuso fora da faixa e id fora do padrão nunca chegam ao banco', async (t) => {
  const m = mocks(t);
  const app = await build(t);
  for (const url of [
    `/users/${OTHER}/profile?date=2026-02-31&tz_offset_min=-180`,
    `/users/${OTHER}/profile?date=2026-1-01&tz_offset_min=-180`,
    `/users/${OTHER}/profile?date=2026-10-14`,
    `/users/${OTHER}/profile?date=2026-10-14&tz_offset_min=841`,
    `/users/${OTHER}/profile?date=2026-10-14&tz_offset_min=-841`,
    `/users/${OTHER}/profile?date=9999-12-31&tz_offset_min=-840`,
    `/users/${OTHER}/profile?date=0000-01-01&tz_offset_min=0`,
    `/users/abc/profile?${QS}`,
    `/users/urn:uuid:${OTHER}/profile?${QS}`,
  ]) {
    assert.equal((await get(app, url)).statusCode, 400, url);
  }
  assert.equal(m.days.mock.callCount() + m.profile.mock.callCount() + m.shares.mock.callCount(), 0);
});

test('GET /users/:id/profile: lista branca — campo extra vindo do repositório não vaza', async (t) => {
  mocks(t, { profile: { ...profileRow(), email: 'bia@torvtest.dev', weight_kg: 70, birth_date: new Date('1990-01-01') } });
  const body = (await get(await build(t), `/users/${OTHER}/profile?${QS}`)).json();
  assert.deepEqual(Object.keys(body.user).sort(), ['fitness_level', 'id', 'name', 'photo_url', 'username']);
  const raw = JSON.stringify(body);
  for (const k of ['email', 'weight_kg', 'birth_date']) assert.equal(raw.includes(k), false, k);
});

test('GET /users/:id/activities: membro → página dele; página cheia → next_before; sem filtro de tipo', async (t) => {
  const m = mocks(t, { rows: [row(0), row(1, { distance_m: '8445.10' })] });
  const res = await get(await build(t), `/users/${OTHER}/activities?limit=2&before=2026-10-15T00:00:00.000Z`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    activities: [
      { id: 'id-0', activity_type: 'STRENGTH', title: 'Treino 0', start_time: '2026-10-14T20:00:00.000Z', duration_sec: 3000, set_count: 3, distance_m: null },
      { id: 'id-1', activity_type: 'STRENGTH', title: 'Treino 1', start_time: '2026-10-13T20:00:00.000Z', duration_sec: 3000, set_count: 3, distance_m: 8445.1 },
    ],
    next_before: '2026-10-13T20:00:00.000Z',
  });
  const [uid, opts] = m.list.mock.calls[0].arguments;
  assert.equal(uid, OTHER);
  assert.equal(opts.limit, 2);
  assert.equal(opts.before.toISOString(), '2026-10-15T00:00:00.000Z');
  assert.equal(opts.type, undefined);
});

test('GET /users/:id/activities: sem grupo em comum → 404 e nenhuma atividade no corpo', async (t) => {
  mocks(t, { shares: false, rows: [row(0)] });
  const res = await get(await build(t), `/users/${OTHER}/activities`);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.json(), { error: 'Not found' });
});

test('GET /users/:id/activities 400: limit e before inválidos não chegam ao banco', async (t) => {
  const m = mocks(t);
  const app = await build(t);
  for (const qs of ['limit=0', 'limit=51', 'before=ontem', 'before=2026-10-01T10:00:00-03']) {
    assert.equal((await get(app, `/users/${OTHER}/activities?${qs}`)).statusCode, 400, qs);
  }
  assert.equal(m.list.mock.callCount(), 0);
});
