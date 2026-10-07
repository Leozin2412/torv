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

const groupsRepository = require('../repository/groups.repository');
const images = require('../lib/imageUpload');

const GID = '22222222-2222-4222-8222-222222222222';
const OTHER = '44444444-4444-4444-8444-444444444444';
const dbDate = (s) => new Date(`${s}T00:00:00Z`);
const baseGroup = (over = {}) => ({
  id: GID, name: 'Time', visibility: 'PUBLIC', cover_url: null, starts_at: dbDate('2026-10-01'), ends_at: null,
  tz_offset_min: -180, owner_id: USER, invite_token: 'AB3DK7MN', ...over,
});
const viewer = (over = {}) => ({ group: baseGroup(over.group), member_count: 3, is_member: true, my_invitation: null, ...over.rest });
const validBody = { name: '  Time  ', visibility: 'PUBLIC', starts_at: '2026-10-01', ends_at: null, tz_offset_min: -180 };

async function build(t) {
  const app = Fastify();
  app.register(require('@fastify/multipart'));
  app.register(require('./groups.routes'), { prefix: '/groups' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const call = (app, method, url, payload) => app.inject({ method, url, payload });

function multipart(filename, contentType, buffer) {
  const boundary = '----torvtest';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, buffer, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);

test('POST /groups: cria com nome aparado e datas como Date, devolve 201 com o detalhe do dono', async (t) => {
  const create = t.mock.method(groupsRepository, 'createGroup', async () => GID);
  t.mock.method(groupsRepository, 'getForViewer', async () => viewer());
  const app = await build(t);
  const res = await call(app, 'POST', '/groups', validBody);
  assert.equal(res.statusCode, 201);
  const [owner, data] = create.mock.calls[0].arguments;
  assert.equal(owner, USER);
  assert.equal(data.name, 'Time');
  assert.equal(data.starts_at.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(data.ends_at, null);
  const body = res.json();
  assert.equal(body.is_owner, true);
  assert.equal(body.invite_token, 'AB3DK7MN');
  assert.equal(body.starts_at, '2026-10-01');
  assert.equal(body.ends_at, null);
});

test('POST /groups: valida corpo (nome em branco, fim antes do início, data impossível, fuso fora da faixa, visibilidade)', async (t) => {
  const create = t.mock.method(groupsRepository, 'createGroup', async () => GID);
  const app = await build(t);
  for (const bad of [
    { ...validBody, name: '   ' },
    { ...validBody, ends_at: '2026-09-30' },
    { ...validBody, starts_at: '2026-02-31' },
    { ...validBody, tz_offset_min: 900 },
    { ...validBody, visibility: 'SECRET' },
    { ...validBody, name: '' },
  ]) {
    assert.equal((await call(app, 'POST', '/groups', bad)).statusCode, 400, JSON.stringify(bad));
  }
  assert.equal(create.mock.callCount(), 0);
});

test('GET /groups/:id: privado e não membro → 404; não dono não vê o invite_token', async (t) => {
  const get = t.mock.method(groupsRepository, 'getForViewer', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'GET', `/groups/${GID}`)).statusCode, 404);
  get.mock.mockImplementation(async () => viewer({ group: { owner_id: OTHER }, rest: { is_member: false } }));
  const res = await call(app, 'GET', `/groups/${GID}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().is_owner, false);
  assert.equal(res.json().invite_token, null);
});

test('GET /groups/:id: id que não é UUID (inclusive urn:uuid:) → 400', async (t) => {
  const app = await build(t);
  assert.equal((await call(app, 'GET', '/groups/abc')).statusCode, 400);
  assert.equal((await call(app, 'GET', `/groups/urn:uuid:${GID}`)).statusCode, 400);
});

test('PATCH /groups/:id: não dono → 404 sem tocar no banco; só nome → sem recalcular; mudar período → recalcula', async (t) => {
  const owned = t.mock.method(groupsRepository, 'getOwned', async () => null);
  const update = t.mock.method(groupsRepository, 'updateGroup', async () => {});
  t.mock.method(groupsRepository, 'getForViewer', async () => viewer());
  const app = await build(t);
  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { name: 'Novo' })).statusCode, 404);
  assert.equal(update.mock.callCount(), 0);

  owned.mock.mockImplementation(async () => baseGroup());
  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { name: ' Novo ' })).statusCode, 200);
  assert.deepEqual(update.mock.calls[0].arguments, [GID, { name: 'Novo' }, { recompute: false }]);

  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { ends_at: '2026-12-31' })).statusCode, 200);
  assert.equal(update.mock.calls[1].arguments[2].recompute, true);
  assert.equal(update.mock.calls[1].arguments[1].ends_at.toISOString(), '2026-12-31T00:00:00.000Z');

  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { ends_at: null })).statusCode, 200);
  assert.equal(update.mock.calls[2].arguments[1].ends_at, null); // volta a ser sem fim
});

test('PATCH /groups/:id: o fim novo é conferido contra o início que já existe', async (t) => {
  t.mock.method(groupsRepository, 'getOwned', async () => baseGroup()); // starts_at 2026-10-01
  const update = t.mock.method(groupsRepository, 'updateGroup', async () => {});
  const app = await build(t);
  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { ends_at: '2026-09-30' })).statusCode, 400);
  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, {})).statusCode, 400); // corpo vazio
  assert.equal(update.mock.callCount(), 0);
});

test('DELETE /groups/:id: dono → 204 e apaga a capa; não dono → 404', async (t) => {
  const del = t.mock.method(groupsRepository, 'deleteGroup', async () => null);
  const removed = t.mock.method(images, 'deleteImage', async () => {});
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/groups/${GID}`)).statusCode, 404);
  del.mock.mockImplementation(async () => ({ cover_url: 'group-x.png' }));
  assert.equal((await call(app, 'DELETE', `/groups/${GID}`)).statusCode, 204);
  assert.deepEqual(removed.mock.calls[0].arguments, ['group-x.png']);
});

test('POST /groups/:id/cover: não dono → 404 antes de ler o arquivo', async (t) => {
  t.mock.method(groupsRepository, 'getOwned', async () => null);
  const read = t.mock.method(images, 'readImage', async () => ({ buffer: PNG, ext: '.png' }));
  const app = await build(t);
  const { payload, headers } = multipart('c.png', 'image/png', PNG);
  assert.equal((await app.inject({ method: 'POST', url: `/groups/${GID}/cover`, payload, headers })).statusCode, 404);
  assert.equal(read.mock.callCount(), 0);
});

test('POST /groups/:id/cover: grava com nome do servidor, troca a capa e apaga a antiga', async (t) => {
  t.mock.method(groupsRepository, 'getOwned', async () => baseGroup());
  const save = t.mock.method(images, 'saveImage', async () => {});
  const removed = t.mock.method(images, 'deleteImage', async () => {});
  const setCover = t.mock.method(groupsRepository, 'setCover', async () => 'group-old.png');
  const app = await build(t);
  const { payload, headers } = multipart('../../evil.png', 'image/png', PNG);
  const res = await app.inject({ method: 'POST', url: `/groups/${GID}/cover`, payload, headers });
  assert.equal(res.statusCode, 200);
  const [fileName] = save.mock.calls[0].arguments;
  assert.match(fileName, new RegExp(`^group-${GID}-\\d+-\\d+\\.png$`));
  assert.doesNotMatch(fileName, /evil/);
  assert.deepEqual(setCover.mock.calls[0].arguments, [GID, fileName]);
  assert.deepEqual(removed.mock.calls[0].arguments, ['group-old.png']);
  assert.match(res.json().cover_url, new RegExp(`/uploads/${fileName}$`));
});

test('POST /groups/:id/cover: não é imagem, assinatura falsa e arquivo grande são recusados sem gravar', async (t) => {
  t.mock.method(groupsRepository, 'getOwned', async () => baseGroup());
  const save = t.mock.method(images, 'saveImage', async () => {});
  const app = await build(t);
  const go = (filename, type, buf) => {
    const m = multipart(filename, type, buf);
    return app.inject({ method: 'POST', url: `/groups/${GID}/cover`, payload: m.payload, headers: m.headers });
  };
  assert.equal((await go('a.pdf', 'application/pdf', PNG)).statusCode, 400);
  assert.equal((await go('a.png', 'image/png', Buffer.from('<?php echo 1;'))).statusCode, 400);
  assert.equal(save.mock.callCount(), 0);
  // limite: o controller pede 5 MB ao multipart
  const read = t.mock.method(images, 'readImage', async () => ({ error: 'Image is too large', status: 413 }));
  assert.equal((await go('b.png', 'image/png', PNG)).statusCode, 413);
  assert.deepEqual(read.mock.calls[0].arguments[1], { maxBytes: 5 * 1024 * 1024 });
});

test('GET /groups/:id/ranking: não membro → 404; membro → linhas com posição e "sou eu"', async (t) => {
  const rank = t.mock.method(groupsRepository, 'getRanking', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'GET', `/groups/${GID}/ranking`)).statusCode, 404);
  rank.mock.mockImplementation(async () => [
    { position: 1, user_id: OTHER, joined_at: new Date(), name: 'Ana', username: 'ana', photo_url: 'ana.jpg', total_points: 5, activities_count: 6 },
    { position: 2, user_id: USER, joined_at: new Date(), name: 'Eu', username: 'eu', photo_url: null, total_points: 2, activities_count: 2 },
  ]);
  const res = await call(app, 'GET', `/groups/${GID}/ranking`);
  assert.equal(res.statusCode, 200);
  const { ranking } = res.json();
  assert.deepEqual(ranking.map((r) => [r.position, r.is_me]), [[1, false], [2, true]]);
  assert.match(ranking[0].photo_url, /\/uploads\/ana\.jpg$/);
  assert.equal(ranking[1].photo_url, null);
  assert.equal(ranking[0].joined_at, undefined);
});

test('GET /groups: lista meus grupos com posição e pontos', async (t) => {
  t.mock.method(groupsRepository, 'listMine', async () => [{ ...baseGroup(), member_count: 4, my_rank: 2, my_points: 7 }]);
  const app = await build(t);
  const res = await call(app, 'GET', '/groups');
  assert.equal(res.statusCode, 200);
  const [g] = res.json().groups;
  assert.deepEqual([g.id, g.member_count, g.my_rank, g.my_points, g.is_owner, g.starts_at], [GID, 4, 2, 7, true, '2026-10-01']);
  assert.equal(g.invite_token, undefined);
});

test('GET /groups/discover: repassa q e cursor, calcula next_cursor', async (t) => {
  const discover = t.mock.method(groupsRepository, 'discover', async () => ({
    rows: [{ id: GID, name: 'Time', cover_url: null, starts_at: dbDate('2026-10-01'), ends_at: null, tz_offset_min: 0, member_count: 3 }],
    hasMore: true,
  }));
  const app = await build(t);
  const res = await call(app, 'GET', '/groups/discover?q=tim&cursor=20');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(discover.mock.calls[0].arguments, [USER, 'tim', 20, 20]);
  assert.equal(res.json().next_cursor, 40);
  assert.equal((await call(app, 'GET', '/groups/discover?cursor=-1')).statusCode, 400);
});

test('DELETE /groups/:id/members/:userId: repassa o resultado como HTTP', async (t) => {
  const remove = t.mock.method(groupsRepository, 'removeMember', async () => 'ok');
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/members/${OTHER}`)).statusCode, 204);
  assert.deepEqual(remove.mock.calls[0].arguments, [USER, GID, OTHER]);
  remove.mock.mockImplementation(async () => 'owner_cannot_leave');
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/members/${USER}`)).statusCode, 409);
  remove.mock.mockImplementation(async () => 'not_found');
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/members/${OTHER}`)).statusCode, 404);
});
