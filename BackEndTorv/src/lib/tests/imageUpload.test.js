const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hasValidImageSignature, readImage, publicUrl, deleteImage } = require('../imageUpload');

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

test('readImage: repassa maxBytes ao multipart', async () => {
  let seen;
  await readImage({ file: async (opts) => { seen = opts; return undefined; } }, { maxBytes: 123 });
  assert.deepEqual(seen, { limits: { fileSize: 123 } });
});

test('publicUrl: monta a URL absoluta ou null', () => {
  const req = { protocol: 'http', headers: { host: 'localhost:3000' } };
  assert.equal(publicUrl(req, 'a.jpg'), 'http://localhost:3000/uploads/a.jpg');
  assert.equal(publicUrl(req, null), null);
});

test('deleteImage: ignora nulo e arquivo ausente, e não sai da pasta de uploads', async () => {
  await deleteImage(null);
  await deleteImage('nao-existe-xyz.jpg');
  const outside = path.join(os.tmpdir(), 'torv-outside.txt');
  fs.writeFileSync(outside, 'x');
  await deleteImage(`../../../../${outside}`); // basename() descarta o caminho
  assert.ok(fs.existsSync(outside));
  fs.rmSync(outside);
});
