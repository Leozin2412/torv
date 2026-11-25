const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const newKey = () => crypto.randomBytes(32).toString('base64');
process.env.DATA_ENCRYPTION_KEY = newKey();
const { encryptField, decryptField, assertKey } = require('../fieldCrypto');

const USER = '11111111-1111-4111-8111-111111111111';
const ctx = { table: 'user_measurements', column: 'weight_kg', userId: USER };
const FORMAT = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

test('ida e volta: número, decimal, array e objeto', () => {
  const route = Array.from({ length: 500 }, (_, i) => [-23.5 + i / 1e5, -46.6]);
  for (const v of [165, 60.5, route, [{ km: 1, distance_m: 1000, duration_sec: 300 }], { age: 30, weight_kg: 60.5 }]) {
    const c = encryptField(v, ctx);
    assert.match(c, FORMAT);
    assert.deepEqual(decryptField(c, ctx), v);
  }
});

test('null e undefined não são cifrados', () => {
  assert.equal(encryptField(null, ctx), null);
  assert.equal(encryptField(undefined, ctx), null);
  assert.equal(decryptField(null, ctx), null);
});

test('IV aleatório: o mesmo valor cifra diferente', () => {
  assert.notEqual(encryptField(60.5, ctx), encryptField(60.5, ctx));
});

test('AAD: outra coluna, tabela ou usuário não decifra', () => {
  const c = encryptField(60.5, ctx);
  assert.throws(() => decryptField(c, { ...ctx, column: 'height_cm' }));
  assert.throws(() => decryptField(c, { ...ctx, table: 'nutrition_targets' }));
  assert.throws(() => decryptField(c, { ...ctx, userId: '22222222-2222-4222-8222-222222222222' }));
});

test('adulterado, versão desconhecida ou lixo → erro sem vazar conteúdo', () => {
  const c = encryptField(60.5, ctx);
  const [v, iv, tag, ct] = c.split('.');
  const flippedTag = [v, iv, (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1), ct].join('.');
  for (const bad of [flippedTag, 'v2' + c.slice(2), 'v1.x', '60.5']) {
    assert.throws(() => decryptField(bad, ctx), (err) =>
      !err.message.includes(bad) && !err.message.includes(USER) && !err.message.includes('60.5'));
  }
});

test('chave trocada não decifra', (t) => {
  const c = encryptField(60.5, ctx);
  const saved = process.env.DATA_ENCRYPTION_KEY;
  t.after(() => { process.env.DATA_ENCRYPTION_KEY = saved; });
  process.env.DATA_ENCRYPTION_KEY = newKey();
  assert.throws(() => decryptField(c, ctx));
});

test('assertKey: ausente, curta ou inválida → erro que não mostra o valor', (t) => {
  const saved = process.env.DATA_ENCRYPTION_KEY;
  t.after(() => { process.env.DATA_ENCRYPTION_KEY = saved; });
  assert.doesNotThrow(() => assertKey());
  for (const bad of [undefined, '', crypto.randomBytes(16).toString('base64'), 'não-é-base64!!']) {
    if (bad === undefined) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = bad;
    assert.throws(() => assertKey(), (err) => /DATA_ENCRYPTION_KEY/.test(err.message) && (!bad || !err.message.includes(bad)));
  }
});

test('chave com espaço ou quebra de linha nas pontas funciona; 33 bytes continua recusada', (t) => {
  const saved = process.env.DATA_ENCRYPTION_KEY;
  t.after(() => { process.env.DATA_ENCRYPTION_KEY = saved; });
  const c = encryptField(60.5, ctx);
  process.env.DATA_ENCRYPTION_KEY = ` ${saved}\r\n`;
  assert.doesNotThrow(() => assertKey());
  assert.equal(decryptField(c, ctx), 60.5);
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(33).toString('base64') + '\n';
  assert.throws(() => assertKey(), /DATA_ENCRYPTION_KEY/);
});

test('tag truncada e IV de tamanho errado são recusados', () => {
  const [v, iv, tag, ct] = encryptField(60.5, ctx).split('.');
  const cut = (b64, n) => Buffer.from(b64, 'base64url').subarray(0, n).toString('base64url');
  for (const bad of [[v, iv, cut(tag, 4), ct], [v, iv, cut(tag, 15), ct], [v, cut(iv, 8), tag, ct], [v, iv + 'AAAA', tag, ct]]) {
    assert.throws(() => decryptField(bad.join('.'), ctx), /^Error: falha ao decifrar campo$/);
  }
});
