const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const authProvider = require('../lib/authProvider');
const profileRepository = require('../repository/profile.repository');
const { AuthError } = authProvider;

const session = { access_token: 'at', refresh_token: 'rt', expires_at: 2000000000, user: { id: 'u1', email: 'a@b.dev' } };
const validRegister = {
  email: 'a@b.dev', password: 'pw123456', name: 'Ana Silva', username: 'ana',
  birth_date: '1995-04-10', weight_kg: 60.5, height_cm: 165, gender: 'Feminino',
  fitness_level: 'INICIANTE', goal: 'Perder Peso, Criar uma Rotina',
};

async function build(t) {
  t.mock.method(profileRepository, 'usernameExists', async () => false);
  const app = Fastify();
  app.register(require('./auth.routes'), { prefix: '/auth' });
  t.after(() => app.close());
  await app.ready();
  return app;
}

const post = (app, url, payload, headers) => app.inject({ method: 'POST', url, payload, headers });

test('register 201: mapeia metadata pro que handle_new_user lê', async (t) => {
  const signUp = t.mock.method(authProvider, 'signUp', async () => session);
  const app = await build(t);
  const res = await post(app, '/auth/register', validRegister);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { session, confirmation_required: false });
  const [email, password, data] = signUp.mock.calls[0].arguments;
  assert.equal(email, 'a@b.dev');
  assert.equal(password, 'pw123456');
  assert.deepEqual(data, {
    name: 'Ana Silva', username: 'ana', birth_date: '1995-04-10', weight: 60.5, height: 165,
    gender: 'Feminino', fitness_level: 'INICIANTE', goal: 'Perder Peso, Criar uma Rotina',
  });
});

test('register 201 sem sessão → confirmation_required', async (t) => {
  t.mock.method(authProvider, 'signUp', async () => null);
  const app = await build(t);
  const res = await post(app, '/auth/register', validRegister);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { session: null, confirmation_required: true });
});

test('register 400: campos inválidos não chegam no provedor', async (t) => {
  const signUp = t.mock.method(authProvider, 'signUp', async () => session);
  const bad = [
    { email: 'nope' },
    { password: '123' },
    { birth_date: '10/04/1995' },
    { birth_date: new Date().toISOString().slice(0, 10) },
    { birth_date: '1850-01-01' },
    { gender: 'toString' },
    { fitness_level: 'PRO' },
    { goal: 'Voar' },
    { weight_kg: 5 },
    { height_cm: 170.5 },
    { name: 'a'.repeat(101) },
    { username: 'a'.repeat(101) },
  ];
  const { name, ...noName } = validRegister;
  for (const patch of bad) {
    const app = await build(t); // app novo por caso: 11 requests estourariam o limite de 10/min
    const res = await post(app, '/auth/register', { ...validRegister, ...patch });
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
  }
  assert.equal((await post(await build(t), '/auth/register', noName)).statusCode, 400);
  assert.equal(signUp.mock.callCount(), 0);
});

test('register 409 / 502 mapeados sem vazar erro do provedor', async (t) => {
  const app = await build(t);
  t.mock.method(authProvider, 'signUp', async () => { throw new AuthError('EMAIL_TAKEN'); });
  let res = await post(app, '/auth/register', validRegister);
  assert.equal(res.statusCode, 409);
  t.mock.method(authProvider, 'signUp', async () => { throw new AuthError('PROVIDER'); });
  res = await post(app, '/auth/register', validRegister);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(Object.keys(res.json()), ['error']);
});

test('register 409 USERNAME_TAKEN: username já existe → não chama o provedor', async (t) => {
  const signUp = t.mock.method(authProvider, 'signUp', async () => session);
  const app = await build(t);
  const exists = t.mock.method(profileRepository, 'usernameExists', async () => true);
  const res = await post(app, '/auth/register', validRegister);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.json(), { error: 'Username already taken', code: 'USERNAME_TAKEN' });
  assert.equal(exists.mock.calls[0].arguments[0], 'ana');
  assert.equal(signUp.mock.callCount(), 0);
});

test('register sem username pula o pre-check (trigger gera um)', async (t) => {
  const signUp = t.mock.method(authProvider, 'signUp', async () => session);
  const app = await build(t);
  const exists = t.mock.method(profileRepository, 'usernameExists', async () => true);
  const { username, ...noUsername } = validRegister;
  const res = await post(app, '/auth/register', noUsername);
  assert.equal(res.statusCode, 201);
  assert.equal(exists.mock.callCount(), 0);
  assert.equal(signUp.mock.calls[0].arguments[2].username, undefined);
});

test('login 200 / 401 genérico / 400', async (t) => {
  const app = await build(t);
  t.mock.method(authProvider, 'signIn', async () => session);
  let res = await post(app, '/auth/login', { email: 'a@b.dev', password: 'pw123456' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { session });

  t.mock.method(authProvider, 'signIn', async () => { throw new AuthError('INVALID_CREDENTIALS'); });
  res = await post(app, '/auth/login', { email: 'a@b.dev', password: 'wrong' });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.json(), { error: 'Invalid email or password' });

  assert.equal((await post(app, '/auth/login', { email: 'a@b.dev' })).statusCode, 400);
});

test('refresh 200 / 401 / 400', async (t) => {
  const app = await build(t);
  const refresh = t.mock.method(authProvider, 'refresh', async () => session);
  let res = await post(app, '/auth/refresh', { refresh_token: 'rt' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { session });
  assert.equal(refresh.mock.calls[0].arguments[0], 'rt');

  t.mock.method(authProvider, 'refresh', async () => { throw new AuthError('INVALID_REFRESH'); });
  res = await post(app, '/auth/refresh', { refresh_token: 'bad' });
  assert.equal(res.statusCode, 401);

  assert.equal((await post(app, '/auth/refresh', {})).statusCode, 400);
});

test('logout 204 sempre, mesmo se o provedor falhar ou sem token', async (t) => {
  const app = await build(t);
  const signOut = t.mock.method(authProvider, 'signOut', async () => { throw new AuthError('PROVIDER'); });
  let res = await post(app, '/auth/logout', undefined, { authorization: 'Bearer at' });
  assert.equal(res.statusCode, 204);
  assert.equal(signOut.mock.calls[0].arguments[0], 'at');
  res = await post(app, '/auth/logout');
  assert.equal(res.statusCode, 204);
  assert.equal(signOut.mock.callCount(), 1);
});

test('rate limit: login 10/min por IP → 11ª é 429', async (t) => {
  t.mock.method(authProvider, 'signIn', async () => { throw new AuthError('INVALID_CREDENTIALS'); });
  const app = await build(t);
  for (let i = 0; i < 10; i++) {
    assert.equal((await post(app, '/auth/login', { email: 'a@b.dev', password: 'x' })).statusCode, 401);
  }
  assert.equal((await post(app, '/auth/login', { email: 'a@b.dev', password: 'x' })).statusCode, 429);
});

test('rate limit: refresh aguenta 30/min, 31ª é 429', async (t) => {
  t.mock.method(authProvider, 'refresh', async () => session);
  const app = await build(t);
  for (let i = 0; i < 30; i++) {
    assert.equal((await post(app, '/auth/refresh', { refresh_token: 'rt' })).statusCode, 200);
  }
  assert.equal((await post(app, '/auth/refresh', { refresh_token: 'rt' })).statusCode, 429);
});
