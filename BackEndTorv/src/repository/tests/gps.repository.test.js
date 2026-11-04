const test = require('node:test');
const assert = require('node:assert/strict');

// Prisma falso: registra a ordem das chamadas (lock, contagem, inserts, recálculo) do teste em andamento.
let calls = null;
const ACTIVITY = '66666666-6666-4666-8666-666666666666';
const USER = '11111111-1111-4111-8111-111111111111';
const ROUTINE = '22222222-2222-4222-8222-222222222222';
const w = (name, ret) => async (args) => { calls.order.push(name); calls.writes.push([name, args]); return typeof ret === 'function' ? ret(args) : ret; };
const fakePrisma = {
  $executeRaw: async (query) => {
    calls.executeRaw.push(query);
    calls.order.push(/pg_advisory_xact_lock/.test(query.sql) ? 'lock' : /INSERT INTO group_rankings/.test(query.sql) ? 'recompute' : 'executeRaw');
    return 1;
  },
  $transaction: async (fn) => fn(fakePrisma),
  workout_routines: { findFirst: async (args) => { calls.reads.push(['routines.findFirst', args]); return calls.routine; } },
  activities: {
    count: async (args) => { calls.order.push('count'); calls.counts.push(args); return calls.dayCount; },
    create: w('activities.create', { id: ACTIVITY }),
    findFirst: async (args) => { calls.reads.push(['activities.findFirst', args]); return calls.activity; },
    updateMany: w('activities.updateMany', () => ({ count: calls.updated })),
    deleteMany: w('activities.deleteMany', () => ({ count: calls.deleted })),
  },
  activity_gps_data: { create: w('gps.create', {}) },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const repo = require('../gps.repository');

const fresh = (over = {}) => ({ order: [], writes: [], reads: [], executeRaw: [], counts: [], dayCount: 0, routine: null, activity: null, updated: 1, deleted: 1, ...over });
const metrics = {
  distance_m: 8671.66, duration_sec: 2877, elapsed_sec: 2882, pace_sec_per_km: 332, elevation_gain_m: 38.3,
  avg_hr: 151, max_hr: 169, avg_cadence: 175, calories: 726, splits: [{ km: 1, distance_m: 1000, duration_sec: 338 }], route: [[-10.5, -52.5]],
};
const input = { routineId: ROUTINE, type: 'RUN', title: 'Corrida', startTime: new Date('2026-10-06T12:00:00Z'), metrics };

test('findGpsRoutine: só rotina de GPS do próprio usuário', async () => {
  calls = fresh({ routine: { id: ROUTINE } });
  await repo.findGpsRoutine(USER, ROUTINE);
  assert.deepEqual(calls.reads[0][1].where, { id: ROUTINE, user_id: USER, activity_type: { in: ['RUN', 'WALK'] } });
});

test('findByStart: atividade de GPS do usuário no mesmo instante (nunca musculação)', async () => {
  calls = fresh({ activity: { id: ACTIVITY } });
  assert.equal(await repo.findByStart(USER, input.startTime), ACTIVITY);
  assert.deepEqual(calls.reads[0][1].where, { user_id: USER, start_time: input.startTime, activity_type: { not: 'STRENGTH' } });
  calls = fresh();
  assert.equal(await repo.findByStart(USER, input.startTime), null);
});

test('createGpsActivity: lock → teto (todos os tipos) → atividade → métricas → ranking, na mesma transação', async () => {
  calls = fresh({ dayCount: 4 });
  assert.equal(await repo.createGpsActivity(USER, input), ACTIVITY);
  assert.deepEqual(calls.order, ['lock', 'count', 'activities.create', 'gps.create', 'recompute']);
  assert.deepEqual(calls.counts[0].where, { user_id: USER, start_time: { gte: new Date('2026-10-06T00:00:00Z'), lt: new Date('2026-10-07T00:00:00Z') } });
  const [, act] = calls.writes.find(([n]) => n === 'activities.create');
  assert.deepEqual(act.data, {
    user_id: USER, activity_type: 'RUN', title: 'Corrida', start_time: input.startTime, routine_id: ROUTINE,
    duration_sec: 2877, distance_m: 8671.66, calories: 726,
  });
  const [, gps] = calls.writes.find(([n]) => n === 'gps.create');
  assert.deepEqual(gps.data, {
    activity_id: ACTIVITY, elapsed_sec: 2882, elevation_gain_m: 38.3, avg_hr: 151, max_hr: 169, avg_cadence: 175,
    splits: metrics.splits, route: metrics.route,
  });
});

test('createGpsActivity: 6a atividade do dia (de qualquer tipo) → SESSION_DAY_LIMIT, nada gravado nem recalculado', async () => {
  calls = fresh({ dayCount: 5 });
  await assert.rejects(repo.createGpsActivity(USER, input), { code: 'SESSION_DAY_LIMIT' });
  assert.deepEqual(calls.order, ['lock', 'count']);
});

test('getGpsActivity, renameGps e deleteGps: só do dono e só GPS; apagar recalcula o ranking', async () => {
  calls = fresh();
  await repo.getGpsActivity(USER, ACTIVITY);
  assert.deepEqual(calls.reads[0][1].where, { id: ACTIVITY, user_id: USER, activity_type: { in: ['RUN', 'WALK'] } });

  calls = fresh({ updated: 0 });
  assert.equal(await repo.renameGps(USER, ACTIVITY, 'Novo'), false);
  assert.deepEqual(calls.writes[0][1], { where: { id: ACTIVITY, user_id: USER, activity_type: { in: ['RUN', 'WALK'] } }, data: { title: 'Novo' } });

  calls = fresh({ deleted: 1 });
  assert.equal(await repo.deleteGps(USER, ACTIVITY), true);
  assert.deepEqual(calls.order, ['activities.deleteMany', 'recompute']);
  calls = fresh({ deleted: 0 });
  assert.equal(await repo.deleteGps(USER, ACTIVITY), false);
  assert.deepEqual(calls.order, ['activities.deleteMany']);
});
