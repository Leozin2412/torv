const test = require('node:test');
const assert = require('node:assert/strict');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '44444444-4444-4444-8444-444444444444';
const GROUP = '22222222-2222-4222-8222-222222222222';

// Prisma falso (o client real é um Proxy que o mock.method não alcança). `state` é recriado a cada teste.
let state;
const fresh = (over = {}) => ({ calls: [], executeRaw: [], queryRaw: [], members: [], rankings: [], group: null, ...over });
const rec = (name, ret) => async (args) => { state.calls.push([name, args]); return typeof ret === 'function' ? ret(args) : ret; };
const fakePrisma = {
  $executeRaw: async (q) => { state.executeRaw.push(q); return 1; },
  $queryRaw: async (strings, ...values) => { state.queryRaw.push({ sql: strings.join('?').replace(/\s+/g, ' '), values }); return state.queryRows ?? []; },
  $transaction: async (fn) => fn(fakePrisma),
  groups: {
    create: rec('groups.create', () => ({ id: GROUP })),
    findUnique: rec('groups.findUnique', () => state.group),
    findFirst: rec('groups.findFirst', () => state.group),
  },
  group_members: {
    create: rec('members.create', {}),
    findUnique: rec('members.findUnique', () => state.membership ?? null),
    findMany: rec('members.findMany', () => state.members),
    deleteMany: rec('members.deleteMany', () => ({ count: state.deleted ?? 1 })),
  },
  group_rankings: {
    create: rec('rankings.create', {}),
    findMany: rec('rankings.findMany', () => state.rankings),
    deleteMany: rec('rankings.deleteMany', { count: 1 }),
  },
  group_invitations: {
    findFirst: rec('invitations.findFirst', () => state.invitation ?? null),
  },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const repo = require('../groups.repository');

const sql = (q) => q.sql.replace(/\s+/g, ' ');

test('recomputeRanking: um UPSERT só, preso ao usuário, com dia local do fuso do grupo e janela por joined_at', async () => {
  state = fresh();
  await repo.recomputeRanking(fakePrisma, USER);
  assert.equal(state.executeRaw.length, 1);
  const [q] = state.executeRaw;
  assert.match(sql(q), /INSERT INTO group_rankings/);
  assert.match(sql(q), /make_interval\(mins => g\.tz_offset_min\)/);
  assert.match(sql(q), /a\.start_time >= gm\.joined_at/);
  assert.match(sql(q), /d\.local_day >= g\.starts_at AND \(g\.ends_at IS NULL OR d\.local_day <= g\.ends_at\)/);
  assert.match(sql(q), /COUNT\(DISTINCT d\.local_day\)/);
  assert.match(sql(q), /WHERE gm\.user_id = \?::uuid/);
  assert.match(sql(q), /ON CONFLICT \(group_id, user_id\) DO UPDATE/);
  assert.deepEqual(q.values, [USER]);
});

test('recomputeGroup: mesmo UPSERT, preso ao grupo', async () => {
  state = fresh();
  await repo.recomputeGroup(fakePrisma, GROUP);
  const [q] = state.executeRaw;
  assert.match(sql(q), /WHERE gm\.group_id = \?::uuid/);
  assert.deepEqual(q.values, [GROUP]);
});

test('createGroup: grupo, dono como membro e linha de ranking zerada', async () => {
  state = fresh();
  const id = await repo.createGroup(USER, { name: 'Time', visibility: 'PUBLIC', starts_at: new Date('2026-10-06'), ends_at: null, tz_offset_min: -180 });
  assert.equal(id, GROUP);
  assert.deepEqual(state.calls.map(([n]) => n), ['groups.create', 'members.create', 'rankings.create']);
  assert.equal(state.calls[0][1].data.owner_id, USER);
  assert.deepEqual(state.calls[1][1].data, { group_id: GROUP, user_id: USER });
  assert.deepEqual(state.calls[2][1].data, { group_id: GROUP, user_id: USER, total_points: 0, activities_count: 0 });
});

test('getForViewer: privado e não membro → null; público e não membro → vê, sem ser membro', async () => {
  state = fresh({ group: { id: GROUP, visibility: 'PRIVATE', owner_id: OTHER, _count: { group_members: 3 } }, membership: null });
  assert.equal(await repo.getForViewer(USER, GROUP), null);
  state = fresh({ group: { id: GROUP, visibility: 'PUBLIC', owner_id: OTHER, _count: { group_members: 3 } }, membership: null });
  const out = await repo.getForViewer(USER, GROUP);
  assert.equal(out.member_count, 3);
  assert.equal(out.is_member, false);
});

const member = (user_id, joined_at, rank) => ({
  user_id,
  joined_at: new Date(joined_at),
  user: { user_profiles: { name: user_id, username: user_id, photo_url: null }, group_rankings: rank ? [rank] : [] },
});

test('getRanking: só membro; quem não tem linha de ranking entra com zero; ordem por pontos', async () => {
  state = fresh({ membership: null });
  assert.equal(await repo.getRanking(USER, GROUP), null);

  state = fresh({
    membership: { user_id: USER },
    members: [
      member(USER, '2026-10-01', { total_points: 2, activities_count: 2 }),
      member(OTHER, '2026-10-02', { total_points: 5, activities_count: 6 }),
      member('c', '2026-10-03', null),
    ],
  });
  const out = await repo.getRanking(USER, GROUP);
  assert.deepEqual(out.map((r) => [r.user_id, r.position, r.total_points]), [[OTHER, 1, 5], [USER, 2, 2], ['c', 3, 0]]);
});

test('listMine: posição e pontos do usuário em cada grupo', async () => {
  state = fresh({
    rankings: [
      { group_id: GROUP, user_id: USER, total_points: 1, activities_count: 1 },
      { group_id: GROUP, user_id: OTHER, total_points: 4, activities_count: 4 },
    ],
  });
  const original = fakePrisma.group_members.findMany;
  fakePrisma.group_members.findMany = async (args) => {
    if (args.where.user_id) {
      return [{ group: { id: GROUP, name: 'Time', visibility: 'PUBLIC', cover_url: null, starts_at: new Date('2026-10-01'), ends_at: null, tz_offset_min: 0, owner_id: OTHER, _count: { group_members: 2 } } }];
    }
    return [{ group_id: GROUP, user_id: USER, joined_at: new Date('2026-10-01') }, { group_id: GROUP, user_id: OTHER, joined_at: new Date('2026-10-01') }];
  };
  try {
    const [g] = await repo.listMine(USER);
    assert.equal(g.member_count, 2);
    assert.equal(g.my_rank, 2);
    assert.equal(g.my_points, 1);
    assert.equal(g._count, undefined);
  } finally {
    fakePrisma.group_members.findMany = original;
  }
});

test('removeMember: sair, dono não sai, só o dono remove os outros', async () => {
  const owner = { owner_id: OTHER };
  state = fresh({ group: owner });
  assert.equal(await repo.removeMember(OTHER, GROUP, OTHER), 'owner_cannot_leave');
  state = fresh({ group: owner });
  assert.equal(await repo.removeMember(USER, GROUP, USER), 'ok');
  assert.deepEqual(state.calls.map(([n]) => n).slice(-2), ['members.deleteMany', 'rankings.deleteMany']);
  state = fresh({ group: owner });
  assert.equal(await repo.removeMember(USER, GROUP, 'c'), 'not_found'); // membro comum não remove outro
  state = fresh({ group: owner, deleted: 0 });
  assert.equal(await repo.removeMember(OTHER, GROUP, 'c'), 'not_found'); // alvo não é membro
  state = fresh({ group: null });
  assert.equal(await repo.removeMember(USER, GROUP, USER), 'not_found');
});

test('discover: escapa % e _ do termo, exclui meus grupos e pagina com limite + 1', async () => {
  state = fresh({ queryRows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
  const out = await repo.discover(USER, '50%_a', 0, 2);
  assert.equal(out.rows.length, 2);
  assert.equal(out.hasMore, true);
  const [q] = state.queryRaw;
  assert.match(q.sql, /g\.visibility = 'PUBLIC'/);
  assert.match(q.sql, /ILIKE \? ESCAPE/);
  assert.match(q.sql, /NOT EXISTS \(SELECT 1 FROM group_members m2/);
  assert.equal(q.values[0], '%50\\%\\_a%');
  assert.ok(q.values.includes(USER));
});
