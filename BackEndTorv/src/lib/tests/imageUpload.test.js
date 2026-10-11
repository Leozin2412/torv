const test = require('node:test');
const assert = require('node:assert/strict');
const { hasValidImageSignature, readImage, publicUrl, deleteImage, saveImage, IMAGE_MAX_BYTES } = require('../imageUpload');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);

test('hasValidImageSignature: bate o tipo declarado com os bytes', () => {
  assert.ok(hasValidImageSignature(JPEG, 'image/jpeg'));
  assert.ok(hasValidImageSignature(PNG, 'image/png'));
  assert.ok(hasValidImageSignature(WEBP, 'image/webp'));
  assert.ok(!hasValidImageSignature(PNG, 'image/jpeg'));
  assert.ok(!hasValidImageSignature(Buffer.from('<?php'), 'image/png'));
  assert.ok(!hasValidImageSignature(JPEG, 'image/gif'));
});

const fakeRequest = (data) => ({ file: async () => data });
const upload = (mimetype, buffer) => ({ mimetype, toBuffer: async () => buffer, file: { truncated: false } });

test('readImage: sem arquivo, tipo proibido e assinatura falsa → 400', async () => {
  assert.deepEqual(await readImage(fakeRequest(undefined)), { error: 'No image file provided', status: 400 });
  assert.equal((await readImage(fakeRequest(upload('application/pdf', JPEG)))).status, 400);
  assert.equal((await readImage(fakeRequest(upload('image/png', JPEG)))).status, 400);
});

test('readImage: imagem válida devolve buffer e extensão', async () => {
  const out = await readImage(fakeRequest(upload('image/png', PNG)));
  assert.equal(out.ext, '.png');
  assert.equal(out.buffer, PNG);
});

test('readImage: arquivo maior que o limite (truncado ou erro do multipart) → 413', async () => {
  const truncated = { mimetype: 'image/png', toBuffer: async () => PNG, file: { truncated: true } };
  assert.equal((await readImage(fakeRequest(truncated), { maxBytes: 10 })).status, 413);
  const throwing = { mimetype: 'image/png', file: {}, toBuffer: async () => { const e = new Error('big'); e.code = 'FST_REQ_FILE_TOO_LARGE'; throw e; } };
  assert.equal((await readImage(fakeRequest(throwing), { maxBytes: 10 })).status, 413);
});

test('readImage: repassa maxBytes ao multipart; padrão é 4 MB', async () => {
  let seen;
  const req = { file: async (opts) => { seen = opts; return undefined; } };
  await readImage(req, { maxBytes: 123 });
  assert.deepEqual(seen, { limits: { fileSize: 123 } });
  await readImage(req);
  assert.equal(IMAGE_MAX_BYTES, 4 * 1024 * 1024);
  assert.deepEqual(seen, { limits: { fileSize: IMAGE_MAX_BYTES } });
});

const URL = 'https://proj.supabase.co';
const KEY = 'sb_secret_SEGREDO';
const BUCKET = 'torv-photos';

// Env + fetch falsos por teste; nenhuma chamada de rede real.
function stubStorage(t, respond = () => ({ status: 200 })) {
  const saved = { ...process.env };
  Object.assign(process.env, { SUPABASE_URL: URL, SUPABASE_SECRET_KEY: KEY, SUPABASE_STORAGE_BUCKET: BUCKET });
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, ...init });
    const { status } = respond();
    return { ok: status >= 200 && status < 300, status, text: async () => `corpo com ${KEY}` };
  };
  t.after(() => { global.fetch = realFetch; process.env = saved; });
  return calls;
}

test('saveImage: POST no bucket com chaves e Content-Type da extensão', async (t) => {
  const calls = stubStorage(t);
  await saveImage('a b.png', PNG);
  await saveImage('c.JPG', JPEG);
  await saveImage('d.webp', WEBP);
  await saveImage('e.bin', PNG);
  assert.equal(calls[0].url, `${URL}/storage/v1/object/${BUCKET}/a%20b.png`);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].body, PNG);
  assert.deepEqual(calls[0].headers, { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'image/png' });
  assert.deepEqual(calls.slice(1).map((c) => c.headers['Content-Type']), ['image/jpeg', 'image/webp', 'application/octet-stream']);
});

test('saveImage: não-2xx lança só com o status, sem vazar chave, URL ou corpo', async (t) => {
  stubStorage(t, () => ({ status: 403 }));
  await assert.rejects(saveImage('a.png', PNG), (err) => {
    assert.equal(err.message, 'Image upload failed with status 403');
    assert.ok(!err.message.includes(KEY) && !err.message.includes(URL) && !err.message.includes('corpo'));
    return true;
  });
});

test('deleteImage: ignora nulo, usa só o basename, 404 é sucesso, outro erro lança', async (t) => {
  let status = 200;
  const calls = stubStorage(t, () => ({ status }));
  await deleteImage(null);
  await deleteImage('');
  assert.equal(calls.length, 0);
  await deleteImage('../../etc/x y.jpg');
  assert.equal(calls[0].url, `${URL}/storage/v1/object/${BUCKET}/x%20y.jpg`);
  assert.equal(calls[0].method, 'DELETE');
  assert.deepEqual(calls[0].headers, { apikey: KEY, Authorization: `Bearer ${KEY}` });
  status = 404;
  await deleteImage('gone.jpg');
  status = 500;
  await assert.rejects(deleteImage('a.jpg'), (err) => err.message === 'Image delete failed with status 500' && !err.message.includes(KEY));
});

test('env ausente: erro claro na chamada, sem valores', async (t) => {
  stubStorage(t);
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_URL;
  await assert.rejects(saveImage('a.png', PNG), /Missing storage env: SUPABASE_URL, SUPABASE_SECRET_KEY/);
  await assert.rejects(deleteImage('a.png'), /Missing storage env/);
  assert.throws(() => publicUrl('a.png'), /Missing storage env/);
  assert.equal(publicUrl(null), null); // sem nome nem precisa de env
});

test('publicUrl: URL pública do bucket ou null', (t) => {
  stubStorage(t);
  assert.equal(publicUrl('a.jpg'), `${URL}/storage/v1/object/public/${BUCKET}/a.jpg`);
  assert.equal(publicUrl(null), null);
  assert.equal(publicUrl(''), null);
});
