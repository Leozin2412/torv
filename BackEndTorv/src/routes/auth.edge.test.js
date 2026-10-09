// Bordas de verify-email / resend-code que auth.routes.test.js não cobre (QA round 1, confirmação de e-mail).
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const authProvider = require('../lib/authProvider');
const { AuthError } = authProvider;

const session = { access_token: 'at', refresh_token: 'rt', expires_at: 2000000000, user: { id: 'u1', email: 'a@b.dev' } };

async function build(t) {
  const app = Fastify();
  app.register(require('./auth.routes'), { prefix: '/auth' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const post = (app, url, payload) => app.inject({ method: 'POST', url, payload });

test('verify-email 400: code com espaço, quebra de linha ou dígitos não-ASCII não chega no provedor', async (t) => {
  const verify = t.mock.method(authProvider, 'verifyEmail', async () => session);
  const app = await build(t);
  for (const code of [' 123456', '123456 ', '123 456', '123456\n', '12345\n', '１２３４５６', '', '12345', '1234567', '12345a']) {
    const res = await post(app, '/auth/verify-email', { email: 'edge1@b.dev', code });
    assert.equal(res.statusCode, 400, JSON.stringify(code));
    assert.notEqual(res.json().code, 'INVALID_CODE', 'validação não pode se passar por código errado');
  }
  assert.equal(verify.mock.callCount(), 0);
});

test('verify-email / resend-code 400: corpo vazio, {} e campos nulos não chegam no provedor', async (t) => {
  const verify = t.mock.method(authProvider, 'verifyEmail', async () => session);
  const resend = t.mock.method(authProvider, 'resendSignup', async () => {});
  const app = await build(t);
  for (const payload of [undefined, {}, { email: null, code: null }, { email: 'edge2@b.dev' }, { code: '123456' }]) {
    assert.equal((await post(app, '/auth/verify-email', payload)).statusCode, 400, JSON.stringify(payload));
  }
  for (const payload of [undefined, {}, { email: null }, { email: '' }]) {
    assert.equal((await post(app, '/auth/resend-code', payload)).statusCode, 400, JSON.stringify(payload));
  }
  assert.equal(verify.mock.callCount(), 0);
  assert.equal(resend.mock.callCount(), 0);
});

test('verify-email / resend-code 400: e-mail com espaços ao redor ou interno é rejeitado (formato)', async (t) => {
  const verify = t.mock.method(authProvider, 'verifyEmail', async () => session);
  const resend = t.mock.method(authProvider, 'resendSignup', async () => {});
  const app = await build(t);
  for (const email of [' a@b.dev', 'a@b.dev ', 'a @b.dev', 'a@b .dev']) {
    assert.equal((await post(app, '/auth/verify-email', { email, code: '123456' })).statusCode, 400, email);
    assert.equal((await post(app, '/auth/resend-code', { email })).statusCode, 400, email);
  }
  assert.equal(verify.mock.callCount() + resend.mock.callCount(), 0);
});

test('verify-email: maiúsculas e minúsculas do mesmo e-mail dividem o mesmo contador', async (t) => {
  const verify = t.mock.method(authProvider, 'verifyEmail', async () => { throw new AuthError('INVALID_CODE'); });
  const app = await build(t);
  const codes = [['Mix@B.dev', 400], ['MIX@b.dev', 400], ['mix@B.DEV', 400], ['mix@b.dev', 400], ['Mix@b.dev', 400], ['mix@b.dev', 429]];
  for (const [email, expected] of codes) {
    assert.equal((await post(app, '/auth/verify-email', { email, code: '000000' })).statusCode, expected, email);
  }
  assert.equal(verify.mock.callCount(), 5);
});

// A tentativa é reservada antes do await (anti-rajada), então qualquer erro do provedor consome (decisão do Security S2).
test('verify-email: PROVIDER e RATE_LIMITED do provedor também consomem tentativa; a 6ª não chama o provedor', async (t) => {
  const verify = t.mock.method(authProvider, 'verifyEmail', async () => { throw new AuthError('PROVIDER'); });
  const app = await build(t);
  const body = { email: 'count@b.dev', code: '000000' };
  for (let i = 0; i < 3; i++) assert.equal((await post(app, '/auth/verify-email', body)).statusCode, 502);
  verify.mock.mockImplementation(async () => { throw new AuthError('RATE_LIMITED'); });
  for (let i = 0; i < 2; i++) assert.equal((await post(app, '/auth/verify-email', body)).statusCode, 429);
  verify.mock.mockImplementation(async () => session);
  assert.equal((await post(app, '/auth/verify-email', body)).statusCode, 429);
  assert.equal(verify.mock.callCount(), 5);
});

test('verify-email: 429 bloqueado leva code RATE_LIMITED e não vaza o código certo (provedor não é chamado)', async (t) => {
  const verify = t.mock.method(authProvider, 'verifyEmail', async () => { throw new AuthError('INVALID_CODE'); });
  const app = await build(t);
  for (let i = 0; i < 5; i++) await post(app, '/auth/verify-email', { email: 'lock@b.dev', code: '000000' });
  verify.mock.mockImplementation(async () => session); // mesmo se o código agora fosse o certo
  const res = await post(app, '/auth/verify-email', { email: 'lock@b.dev', code: '123456' });
  assert.equal(res.statusCode, 429);
  assert.deepEqual(res.json(), { error: 'Too many requests', code: 'RATE_LIMITED' });
  assert.equal(verify.mock.callCount(), 5);
});

test('resend-code: e-mail em maiúsculas passa ao provedor e a resposta 204 vem sem corpo', async (t) => {
  const resend = t.mock.method(authProvider, 'resendSignup', async () => {});
  const app = await build(t);
  const res = await post(app, '/auth/resend-code', { email: 'Ana@B.dev' });
  assert.equal(res.statusCode, 204);
  assert.equal(res.body, '');
  assert.equal(resend.mock.calls[0].arguments[0], 'Ana@B.dev');
});
