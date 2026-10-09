const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://proj.supabase.co';
process.env.PUBLISHABLE_KEY = 'pk_test';
const authProvider = require('../authProvider');

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const gotrueSession = {
  access_token: 'at', refresh_token: 'rt', expires_at: 2000000000, expires_in: 3600, token_type: 'bearer',
  user: { id: 'u1', email: 'a@b.dev', user_metadata: { name: 'x' } },
};
const session = { access_token: 'at', refresh_token: 'rt', expires_at: 2000000000, user: { id: 'u1', email: 'a@b.dev' } };

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof authProvider.AuthError);
    assert.equal(err.code, code);
    assert.ok(!err.message.includes('secret-provider-detail'));
    return true;
  });
}

test('signIn: chama /token?grant_type=password com apikey e normaliza a sessão', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => json(200, gotrueSession));
  assert.deepEqual(await authProvider.signIn('a@b.dev', 'pw123456'), session);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://proj.supabase.co/auth/v1/token?grant_type=password');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.apikey, 'pk_test');
  assert.deepEqual(JSON.parse(init.body), { email: 'a@b.dev', password: 'pw123456' });
});

test('signIn: 400 invalid_credentials → INVALID_CREDENTIALS', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(400, { error_code: 'invalid_credentials', msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.signIn('a@b.dev', 'x'), 'INVALID_CREDENTIALS');
});

test('signIn: 5xx e falha de rede → PROVIDER', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(500, { msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.signIn('a@b.dev', 'x'), 'PROVIDER');
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await rejectsCode(authProvider.signIn('a@b.dev', 'x'), 'PROVIDER');
});

test('signUp: envia metadata em data e devolve sessão quando auto-confirma', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => json(200, gotrueSession));
  assert.deepEqual(await authProvider.signUp('a@b.dev', 'pw123456', { name: 'x' }), session);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://proj.supabase.co/auth/v1/signup');
  assert.deepEqual(JSON.parse(init.body), { email: 'a@b.dev', password: 'pw123456', data: { name: 'x' } });
});

test('signUp: sem access_token (confirmação de e-mail) → null', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(200, { id: 'u1', email: 'a@b.dev' }));
  assert.equal(await authProvider.signUp('a@b.dev', 'pw123456', {}), null);
});

test('signUp: e-mail já cadastrado → EMAIL_TAKEN; senha fraca → INVALID_INPUT', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(422, { error_code: 'user_already_exists', msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.signUp('a@b.dev', 'pw', {}), 'EMAIL_TAKEN');
  t.mock.method(globalThis, 'fetch', async () => json(422, { error_code: 'weak_password', msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.signUp('a@b.dev', 'pw', {}), 'INVALID_INPUT');
});

test('refresh: grant_type=refresh_token; 400 → INVALID_REFRESH', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => json(200, gotrueSession));
  assert.deepEqual(await authProvider.refresh('rt'), session);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://proj.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.deepEqual(JSON.parse(init.body), { refresh_token: 'rt' });
  t.mock.method(globalThis, 'fetch', async () => json(400, { error_code: 'refresh_token_not_found', msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.refresh('bad'), 'INVALID_REFRESH');
});

test('signOut: POST /logout com Bearer do usuário', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  await authProvider.signOut('at');
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://proj.supabase.co/auth/v1/logout');
  assert.equal(init.headers.Authorization, 'Bearer at');
});

test('sessão sem expires_at usa expires_in', async (t) => {
  const { expires_at, ...noExp } = gotrueSession;
  t.mock.method(globalThis, 'fetch', async () => json(200, noExp));
  const s = await authProvider.refresh('rt');
  const now = Math.floor(Date.now() / 1000);
  assert.ok(s.expires_at >= now + 3599 && s.expires_at <= now + 3601);
});

test('signIn: 400 email_not_confirmed → EMAIL_NOT_CONFIRMED; 429 → PROVIDER', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(400, { error_code: 'email_not_confirmed', msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.signIn('a@b.dev', 'pw123456'), 'EMAIL_NOT_CONFIRMED');
  t.mock.method(globalThis, 'fetch', async () => json(429, { error_code: 'over_request_rate_limit' }));
  await rejectsCode(authProvider.signIn('a@b.dev', 'pw123456'), 'PROVIDER');
});

test('verifyEmail: POST /verify type=email e normaliza a sessão', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => json(200, gotrueSession));
  assert.deepEqual(await authProvider.verifyEmail('a@b.dev', '123456'), session);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://proj.supabase.co/auth/v1/verify');
  assert.deepEqual(JSON.parse(init.body), { type: 'email', email: 'a@b.dev', token: '123456' });
});

test('verifyEmail: 200 sem access_token → PROVIDER', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(200, { id: 'u1' }));
  await rejectsCode(authProvider.verifyEmail('a@b.dev', '123456'), 'PROVIDER');
});

test('verifyEmail: 4xx → INVALID_CODE; 429/over_request_rate_limit → RATE_LIMITED; 5xx → PROVIDER', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(403, { error_code: 'otp_expired', msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.verifyEmail('a@b.dev', '123456'), 'INVALID_CODE');
  t.mock.method(globalThis, 'fetch', async () => json(422, { error_code: 'validation_failed' }));
  await rejectsCode(authProvider.verifyEmail('a@b.dev', '123456'), 'INVALID_CODE');
  t.mock.method(globalThis, 'fetch', async () => json(429, {}));
  await rejectsCode(authProvider.verifyEmail('a@b.dev', '123456'), 'RATE_LIMITED');
  t.mock.method(globalThis, 'fetch', async () => json(400, { error_code: 'over_request_rate_limit' }));
  await rejectsCode(authProvider.verifyEmail('a@b.dev', '123456'), 'RATE_LIMITED');
  t.mock.method(globalThis, 'fetch', async () => json(500, { msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.verifyEmail('a@b.dev', '123456'), 'PROVIDER');
});

test('resendSignup: POST /resend type=signup; 2xx ok', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => json(200, {}));
  assert.equal(await authProvider.resendSignup('a@b.dev'), undefined);
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://proj.supabase.co/auth/v1/resend');
  assert.deepEqual(JSON.parse(init.body), { type: 'signup', email: 'a@b.dev' });
});

test('resendSignup: 429/over_email_send_rate_limit é engolido e devolve o sinal swallowed', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(429, { error_code: 'over_email_send_rate_limit' }));
  assert.deepEqual(await authProvider.resendSignup('a@b.dev'), { swallowed: 'over_email_send_rate_limit' });
  t.mock.method(globalThis, 'fetch', async () => json(429, {}));
  assert.deepEqual(await authProvider.resendSignup('a@b.dev'), { swallowed: 'http_429' });
});

test('signUp: over_email_send_rate_limit → null (uniforme com cadastro novo); over_request_rate_limit continua erro', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(429, { error_code: 'over_email_send_rate_limit' }));
  assert.equal(await authProvider.signUp('a@b.dev', 'pw123456', {}), null);
  t.mock.method(globalThis, 'fetch', async () => json(429, { error_code: 'over_request_rate_limit' }));
  await rejectsCode(authProvider.signUp('a@b.dev', 'pw123456', {}), 'PROVIDER');
});

test('resendSignup: email_address_not_authorized, 5xx e rede → PROVIDER', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(400, { error_code: 'email_address_not_authorized', msg: 'secret-provider-detail' }));
  await rejectsCode(authProvider.resendSignup('a@b.dev'), 'PROVIDER');
  t.mock.method(globalThis, 'fetch', async () => json(500, {}));
  await rejectsCode(authProvider.resendSignup('a@b.dev'), 'PROVIDER');
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await rejectsCode(authProvider.resendSignup('a@b.dev'), 'PROVIDER');
});

test('resendSignup: outro 4xx (e-mail inexistente/já confirmado) → ok, com swallowed pro log', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => json(422, { error_code: 'user_not_found' }));
  assert.deepEqual(await authProvider.resendSignup('a@b.dev'), { swallowed: 'user_not_found' });
  t.mock.method(globalThis, 'fetch', async () => json(400, { error_code: 'email_exists' }));
  assert.deepEqual(await authProvider.resendSignup('a@b.dev'), { swallowed: 'email_exists' });
});
