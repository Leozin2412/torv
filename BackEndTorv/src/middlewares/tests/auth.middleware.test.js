const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://example.supabase.co';
const authenticateToken = require('../auth.middleware');

const reply = () => {
  const r = { code: null, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.send = (b) => { r.body = b; return r; };
  return r;
};

// O resto dos testes substitui este middleware por um stub, então só aqui o jose real é carregado.
test('sem token → 401', async () => {
  const r = reply();
  await authenticateToken({ headers: {} }, r);
  assert.equal(r.code, 401);
});

test('token malformado → 403 (jose carrega via import() e rejeita antes de ir à rede)', async () => {
  const r = reply();
  await authenticateToken({ headers: { authorization: 'Bearer nao-e-um-jwt' } }, r);
  assert.equal(r.code, 403);
});
