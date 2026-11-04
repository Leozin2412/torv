const test = require('node:test');
const assert = require('node:assert/strict');

const USER = '11111111-1111-4111-8111-111111111111';

// Prisma falso (o client real é um Proxy que o mock.method não alcança). `state` é recriado a cada teste.
let state;
const fakePrisma = {
  $queryRaw: async (strings, ...values) => {
    state.queryRaw.push({ sql: strings.join('?').replace(/\s+/g, ' '), values });
    return state.rows;
  },
  activities: {
    findMany: async (args) => { state.findMany.push(args); return []; },
  },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const repo = require('../activities.repository');

test('dayCounts: dias locais de QUALQUER tipo, com contagem, em ordem crescente, antes de `before`, sem LIMIT', async () => {
  state = { queryRaw: [], findMany: [], rows: [{ day: '2026-10-13', count: 2 }] };
  const before = new Date('2026-10-15T03:00:00Z');
  assert.deepEqual(await repo.dayCounts(USER, { before, tzOffsetMin: -180 }), [{ day: '2026-10-13', count: 2 }]);
  const [{ sql, values }] = state.queryRaw;
  assert.match(sql, /make_interval\(mins => \?::int\)/);
  assert.match(sql, /COUNT\(\*\)::int AS count/);
  assert.match(sql, /user_id = \?::uuid/);
  assert.match(sql, /start_time < \?::timestamptz/);
  assert.match(sql, /GROUP BY 1 ORDER BY 1/);
  assert.doesNotMatch(sql, /activity_type/);
  assert.doesNotMatch(sql, /LIMIT/);
  assert.deepEqual(values, [-180, USER, before]);
});

test('listActivities: seleciona distance_m para o item da página', async () => {
  state = { queryRaw: [], findMany: [], rows: [] };
  await repo.listActivities(USER, { limit: 20 });
  assert.equal(state.findMany[0].select.distance_m, true);
  assert.equal(state.findMany[0].where.user_id, USER);
});
