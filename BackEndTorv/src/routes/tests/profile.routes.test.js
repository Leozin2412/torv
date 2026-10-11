const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

// O middleware real valida JWT contra o JWKS do Supabase. Aqui todo request é do USER.
const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const profileRepository = require('../../repository/profile.repository');
const images = require('../../lib/imageUpload');

// publicUrl lê a env na chamada; o resto do app não precisa dela.
Object.assign(process.env, { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SECRET_KEY: 'test-key', SUPABASE_STORAGE_BUCKET: 'torv-photos' });
const PUB = 'https://proj.supabase.co/storage/v1/object/public/torv-photos';

async function build(t) {
  const app = Fastify();
  app.register(require('@fastify/multipart'));
  app.register(require('../profile.routes'), { prefix: '/profile' });
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

test('GET /profile: photo_url vira a URL pública do bucket (ou null)', async (t) => {
  const get = t.mock.method(profileRepository, 'getUserProfile', async () => userRow({ ...baseProfile, photo_url: 'ana.jpg' }));
  const app = await build(t);
  assert.equal((await app.inject({ method: 'GET', url: '/profile' })).json().photo_url, `${PUB}/ana.jpg`);
  get.mock.mockImplementation(async () => userRow(baseProfile));
  assert.equal((await app.inject({ method: 'GET', url: '/profile' })).json().photo_url, null);
});

function multipart(contentType, buffer) {
  const boundary = '----torvtest';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="x"\r\nContent-Type: ${contentType}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, buffer, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
const upload = (app, buf = PNG, type = 'image/png') => app.inject({ method: 'POST', url: '/profile/upload', ...multipart(type, buf) });

test('POST /profile/upload: grava a nova, atualiza o banco e apaga a foto anterior', async (t) => {
  const order = [];
  const save = t.mock.method(images, 'saveImage', async () => { order.push('save'); });
  t.mock.method(profileRepository, 'getProfileRow', async () => { order.push('read'); return { photo_url: 'profile-old.jpg' }; });
  const update = t.mock.method(profileRepository, 'updatePhotoUrl', async () => { order.push('update'); });
  const removed = t.mock.method(images, 'deleteImage', async () => { order.push('delete'); });
  const app = await build(t);
  const res = await upload(app);
  assert.equal(res.statusCode, 200);
  const [fileName] = save.mock.calls[0].arguments;
  assert.match(fileName, new RegExp(`^profile-${USER}-\\d+-\\d+\\.png$`));
  assert.deepEqual(update.mock.calls[0].arguments, [USER, fileName]);
  assert.deepEqual(removed.mock.calls[0].arguments, ['profile-old.jpg']);
  assert.deepEqual(order, ['save', 'read', 'update', 'delete']); // anterior lido ANTES do update
  assert.equal(res.json().photo_url, `${PUB}/${fileName}`);
});

test('POST /profile/upload: falha ao apagar a anterior só é logada; sem anterior não apaga nada', async (t) => {
  t.mock.method(images, 'saveImage', async () => {});
  const row = t.mock.method(profileRepository, 'getProfileRow', async () => ({ photo_url: 'old.jpg' }));
  t.mock.method(profileRepository, 'updatePhotoUrl', async () => {});
  const removed = t.mock.method(images, 'deleteImage', async () => { throw new Error('storage down'); });
  const app = await build(t);
  assert.equal((await upload(app)).statusCode, 200);
  row.mock.mockImplementation(async () => ({ photo_url: null }));
  removed.mock.mockImplementation(async (name) => { assert.equal(name, null); });
  assert.equal((await upload(app)).statusCode, 200);
});

test('POST /profile/upload: tipo errado e arquivo acima de 4 MB são recusados sem gravar', async (t) => {
  const save = t.mock.method(images, 'saveImage', async () => {});
  const app = await build(t);
  assert.equal((await upload(app, PNG, 'application/pdf')).statusCode, 400);
  const big = Buffer.concat([PNG, Buffer.alloc(images.IMAGE_MAX_BYTES)]);
  assert.equal((await upload(app, big)).statusCode, 413);
  assert.equal(save.mock.callCount(), 0);
});

test('POST /profile/upload: Storage recusa (403) → 500 genérico, banco intocado, nada apagado', async (t) => {
  t.mock.method(images, 'saveImage', async () => { throw new Error('Image upload failed with status 403'); });
  const row = t.mock.method(profileRepository, 'getProfileRow', async () => ({ photo_url: 'old.jpg' }));
  const update = t.mock.method(profileRepository, 'updatePhotoUrl', async () => {});
  const removed = t.mock.method(images, 'deleteImage', async () => {});
  const app = await build(t);
  const res = await upload(app);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.json(), { error: 'Internal server error uploading photo' });
  assert.doesNotMatch(res.body, /403|test-key|supabase/);
  assert.equal(row.mock.callCount() + update.mock.callCount() + removed.mock.callCount(), 0);
});

test('POST /profile/upload: env do Storage ausente → 500 genérico, banco intocado', async (t) => {
  const saved = process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  t.after(() => { process.env.SUPABASE_SECRET_KEY = saved; });
  const update = t.mock.method(profileRepository, 'updatePhotoUrl', async () => {});
  const app = await build(t);
  const res = await upload(app);
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(res.body, /SUPABASE/);
  assert.equal(update.mock.callCount(), 0);
});

test('POST /profile/upload: banco falha depois de gravar → 500 e a foto anterior NÃO é apagada', async (t) => {
  t.mock.method(images, 'saveImage', async () => {});
  t.mock.method(profileRepository, 'getProfileRow', async () => ({ photo_url: 'old.jpg' }));
  t.mock.method(profileRepository, 'updatePhotoUrl', async () => { throw new Error('db down'); });
  const removed = t.mock.method(images, 'deleteImage', async () => {});
  const app = await build(t);
  assert.equal((await upload(app)).statusCode, 500);
  assert.equal(removed.mock.callCount(), 0);
});

test('POST /profile/upload: 2 arquivos (multipart global files:1) nunca gravam nada', async (t) => {
  const save = t.mock.method(images, 'saveImage', async () => {});
  const update = t.mock.method(profileRepository, 'updatePhotoUrl', async () => {});
  const app = Fastify();
  app.register(require('@fastify/multipart'), { limits: { fileSize: images.IMAGE_MAX_BYTES, files: 1 } }); // igual ao server.js
  app.register(require('../profile.routes'), { prefix: '/profile' });
  t.after(() => app.close());
  await app.ready();
  const one = multipart('image/png', PNG);
  const second = Buffer.from(`------torvtest\r\nContent-Disposition: form-data; name="b"; filename="y"\r\nContent-Type: image/png\r\n\r\n`);
  const payload = Buffer.concat([one.payload.subarray(0, one.payload.length - '------torvtest--\r\n'.length), second, PNG, Buffer.from('\r\n------torvtest--\r\n')]);
  const res = await app.inject({ method: 'POST', url: '/profile/upload', payload, headers: one.headers });
  assert.ok(res.statusCode >= 400, `status ${res.statusCode}`); // hoje 500 (ERR_STREAM_PREMATURE_CLOSE); 4xx seria o ideal
  assert.equal(save.mock.callCount() + update.mock.callCount(), 0);
});
