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

const profileRepository = require('../repository/profile.repository');

async function build(t) {
  const app = Fastify();
  app.register(require('./profile.routes'), { prefix: '/profile' });
  t.after(() => app.close());
  await app.ready();
  return app;
}

const userRow = (profile) => ({
  id: USER,
  email: 'ana@torvtest.dev',
  user_profiles: profile,
  user_streaks: null,
  user_measurements: [],
  workout_counts: { total: 0, month: 0 },
});
const baseProfile = {
  username: 'ana', name: 'Ana', fitness_level: 'INICIANTE', goal: 'Perder Peso',
  photo_url: null, birth_date: null, gender: 'Feminino',
};

test('GET /profile: welcome_pending = welcomed_at nulo', async (t) => {
  const get = t.mock.method(profileRepository, 'getUserProfile', async () => userRow({ ...baseProfile, welcomed_at: null }));
  const app = await build(t);
  let res = await app.inject({ method: 'GET', url: '/profile' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().welcome_pending, true);
  assert.equal(get.mock.calls[0].arguments[0], USER);

  get.mock.mockImplementation(async () => userRow({ ...baseProfile, welcomed_at: new Date() }));
  res = await app.inject({ method: 'GET', url: '/profile' });
  assert.equal(res.json().welcome_pending, false);
});

test('POST /profile/welcome: 204 e grava para o usuário do token (sem corpo ou com {})', async (t) => {
  const mark = t.mock.method(profileRepository, 'markWelcomed', async () => {});
  const app = await build(t);
  assert.equal((await app.inject({ method: 'POST', url: '/profile/welcome' })).statusCode, 204);
  assert.equal((await app.inject({ method: 'POST', url: '/profile/welcome', payload: {} })).statusCode, 204);
  assert.deepEqual(mark.mock.calls.map((c) => c.arguments), [[USER], [USER]]);
});
