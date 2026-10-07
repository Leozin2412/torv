const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const repo = require('../repository/groupInvitations.repository');
const { isValidToken } = require('../lib/groupRules');

const GID = '22222222-2222-4222-8222-222222222222';
const INV = '55555555-5555-4555-8555-555555555555';
const OTHER = '44444444-4444-4444-8444-444444444444';
const TOKEN = 'AB3DK7MN';
const dbDate = (s) => new Date(`${s}T00:00:00Z`);

// Os dois plugins no mesmo prefixo, como no server.js: garante que /groups/invitations/* e /groups/join/*
// não caem em /groups/:id (que recusaria com 400 por não ser UUID).
async function build(t) {
  const app = Fastify();
  app.register(require('@fastify/multipart'));
  app.register(require('./groups.routes'), { prefix: '/groups' });
  app.register(require('./groupInvitations.routes'), { prefix: '/groups' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const call = (app, method, url, payload) => app.inject({ method, url, payload });
const profile = (name, username, photo_url = null) => ({ id: OTHER, user_profiles: { name, username, photo_url } });

test('rotas estáticas não caem em /groups/:id', async (t) => {
  t.mock.method(repo, 'listReceived', async () => []);
  t.mock.method(repo, 'getJoinPreview', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'GET', '/groups/invitations/received')).statusCode, 200);
  assert.equal((await call(app, 'GET', `/groups/join/${TOKEN}`)).statusCode, 404); // 404 do preview, não 400 de UUID
});

test('POST /groups/:id/invitations: username aparado; códigos do repositório viram HTTP', async (t) => {
  const invite = t.mock.method(repo, 'inviteByUsername', async () => ({ id: INV }));
  const app = await build(t);
  const ok = await call(app, 'POST', `/groups/${GID}/invitations`, { username: '  ana ' });
  assert.equal(ok.statusCode, 201);
  assert.deepEqual(ok.json(), { id: INV });
  assert.deepEqual(invite.mock.calls[0].arguments, [USER, GID, 'ana']);
  for (const [code, status] of [['not_found', 404], ['already_member', 409], ['duplicate', 409], ['ended', 409]]) {
    invite.mock.mockImplementation(async () => ({ code }));
    assert.equal((await call(app, 'POST', `/groups/${GID}/invitations`, { username: 'ana' })).statusCode, status, code);
  }
  assert.equal((await call(app, 'POST', `/groups/${GID}/invitations`, { username: '   ' })).statusCode, 400);
  assert.equal((await call(app, 'POST', `/groups/${GID}/invitations`, {})).statusCode, 400);
});

test('POST /groups/:id/requests: grupo privado ou inexistente → 404; encerrado → 409', async (t) => {
  const req = t.mock.method(repo, 'createRequest', async () => ({ id: INV }));
  const app = await build(t);
  assert.equal((await call(app, 'POST', `/groups/${GID}/requests`)).statusCode, 201);
  assert.deepEqual(req.mock.calls[0].arguments, [USER, GID]);
  req.mock.mockImplementation(async () => ({ code: 'not_found' }));
  assert.equal((await call(app, 'POST', `/groups/${GID}/requests`)).statusCode, 404);
  req.mock.mockImplementation(async () => ({ code: 'ended' }));
  assert.equal((await call(app, 'POST', `/groups/${GID}/requests`)).statusCode, 409);
});

test('GET /groups/:id/requests: não dono → 404; dono recebe pedidos e convites separados', async (t) => {
  const pending = t.mock.method(repo, 'listPending', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'GET', `/groups/${GID}/requests`)).statusCode, 404);
  pending.mock.mockImplementation(async () => [
    { id: 'r1', kind: 'REQUEST', created_at: new Date('2026-10-05T10:00:00Z'), user: profile('Ana', 'ana', 'ana.jpg') },
    { id: 'i1', kind: 'INVITE', created_at: new Date('2026-10-05T11:00:00Z'), user: profile('Beto', 'beto') },
  ]);
  const res = await call(app, 'GET', `/groups/${GID}/requests`);
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.deepEqual(body.requests.map((r) => [r.id, r.username]), [['r1', 'ana']]);
  assert.deepEqual(body.invites.map((r) => [r.id, r.username]), [['i1', 'beto']]);
  assert.match(body.requests[0].photo_url, /\/uploads\/ana\.jpg$/);
  assert.equal(body.invites[0].photo_url, null);
});

test('GET /groups/invitations/received: convites pendentes com grupo e quem convidou', async (t) => {
  t.mock.method(repo, 'listReceived', async () => [{
    id: INV, created_at: new Date('2026-10-05T10:00:00Z'),
    group: { id: GID, name: 'Time', cover_url: 'group-a.png' },
    creator: { user_profiles: { name: 'Ana', username: 'ana', photo_url: null } },
  }]);
  const app = await build(t);
  const res = await call(app, 'GET', '/groups/invitations/received');
  const [inv] = res.json().invitations;
  assert.deepEqual([inv.id, inv.group.id, inv.group.name, inv.invited_by.username], [INV, GID, 'Time', 'ana']);
  assert.match(inv.group.cover_url, /\/uploads\/group-a\.png$/);
});

test('POST /groups/invitations/:id/accept e /decline: repassa a ação; terceiros e já resolvidos', async (t) => {
  const resolve = t.mock.method(repo, 'resolve', async (_u, _i, action) => ({ group_id: GID, status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' }));
  const app = await build(t);
  const a = await call(app, 'POST', `/groups/invitations/${INV}/accept`);
  assert.equal(a.statusCode, 200);
  assert.deepEqual(a.json(), { group_id: GID, status: 'ACCEPTED' });
  assert.deepEqual(resolve.mock.calls[0].arguments, [USER, INV, 'accept']);
  assert.equal((await call(app, 'POST', `/groups/invitations/${INV}/decline`)).json().status, 'DECLINED');
  resolve.mock.mockImplementation(async () => ({ code: 'not_found' })); // não é o convidado nem o dono: 404, não 403
  assert.equal((await call(app, 'POST', `/groups/invitations/${INV}/accept`)).statusCode, 404);
  resolve.mock.mockImplementation(async () => ({ code: 'not_pending' }));
  assert.equal((await call(app, 'POST', `/groups/invitations/${INV}/accept`)).statusCode, 409);
  resolve.mock.mockImplementation(async () => ({ code: 'ended' }));
  assert.equal((await call(app, 'POST', `/groups/invitations/${INV}/accept`)).statusCode, 409);
});

test('DELETE /groups/invitations/:id: cancelar o que não é meu → 404', async (t) => {
  const cancel = t.mock.method(repo, 'cancel', async () => true);
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/groups/invitations/${INV}`)).statusCode, 204);
  cancel.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'DELETE', `/groups/invitations/${INV}`)).statusCode, 404);
});

test('POST /groups/:id/invite-link: gera token válido; repete se colidir; não dono → 404', async (t) => {
  let attempts = 0;
  const set = t.mock.method(repo, 'setInviteToken', async () => {
    attempts += 1;
    if (attempts === 1) { const e = new Error('unique'); e.code = 'P2002'; throw e; }
    return true;
  });
  const app = await build(t);
  const res = await call(app, 'POST', `/groups/${GID}/invite-link`);
  assert.equal(res.statusCode, 200);
  assert.ok(isValidToken(res.json().token));
  assert.equal(set.mock.callCount(), 2);
  assert.equal(set.mock.calls[1].arguments[2], res.json().token);
  set.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'POST', `/groups/${GID}/invite-link`)).statusCode, 404);
});

test('DELETE /groups/:id/invite-link: revoga (token nulo)', async (t) => {
  const set = t.mock.method(repo, 'setInviteToken', async () => true);
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/invite-link`)).statusCode, 204);
  assert.deepEqual(set.mock.calls[0].arguments, [USER, GID, null]);
  set.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/invite-link`)).statusCode, 404);
});

test('GET /groups/join/:token: normaliza (minúsculas, espaços); formato inválido → 404 sem consultar o banco', async (t) => {
  const preview = t.mock.method(repo, 'getJoinPreview', async () => ({
    group: { id: GID, name: 'Time', cover_url: null, starts_at: dbDate('2026-10-01'), ends_at: null, tz_offset_min: 0 },
    member_count: 3, is_member: false,
  }));
  const app = await build(t);
  const res = await call(app, 'GET', `/groups/join/${encodeURIComponent(' ab3dk7mn ')}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(preview.mock.calls[0].arguments, [USER, TOKEN]);
  assert.deepEqual(res.json(), {
    group: { id: GID, name: 'Time', cover_url: null, starts_at: '2026-10-01', ends_at: null, tz_offset_min: 0, member_count: 3 },
    is_member: false, ended: false,
  });
  const before = preview.mock.callCount();
  for (const bad of ['0O1IL234', 'ABC', 'AB3DK7MNP', '%00']) {
    assert.equal((await call(app, 'GET', `/groups/join/${bad}`)).statusCode, 404, bad);
  }
  assert.equal(preview.mock.callCount(), before);
});

test('GET /groups/join/:token: grupo encerrado vem com ended = true; link revogado → 404', async (t) => {
  const preview = t.mock.method(repo, 'getJoinPreview', async () => ({
    group: { id: GID, name: 'Time', cover_url: null, starts_at: dbDate('2020-01-01'), ends_at: dbDate('2020-02-01'), tz_offset_min: 0 },
    member_count: 3, is_member: false,
  }));
  const app = await build(t);
  assert.equal((await call(app, 'GET', `/groups/join/${TOKEN}`)).json().ended, true);
  preview.mock.mockImplementation(async () => null); // revogado ou regenerado: o token antigo não existe mais
  assert.equal((await call(app, 'GET', `/groups/join/${TOKEN}`)).statusCode, 404);
});

test('POST /groups/join/:token: entra; encerrado e já membro → 409; revogado ou formato inválido → 404', async (t) => {
  const join = t.mock.method(repo, 'joinByToken', async () => ({ group_id: GID }));
  const app = await build(t);
  const ok = await call(app, 'POST', `/groups/join/${TOKEN.toLowerCase()}`);
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json(), { group_id: GID });
  assert.deepEqual(join.mock.calls[0].arguments, [USER, TOKEN]);
  for (const [code, status] of [['ended', 409], ['already_member', 409], ['not_found', 404]]) {
    join.mock.mockImplementation(async () => ({ code }));
    assert.equal((await call(app, 'POST', `/groups/join/${TOKEN}`)).statusCode, status, code);
  }
  const before = join.mock.callCount();
  assert.equal((await call(app, 'POST', '/groups/join/curto')).statusCode, 404);
  assert.equal(join.mock.callCount(), before);
});
