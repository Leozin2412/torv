const test = require('node:test');
const assert = require('node:assert/strict');

// Prisma falso (o client real é um Proxy que o mock.method não alcança): registra as chamadas do teste em andamento.
let calls = null;
const ACTIVITY = '66666666-6666-4666-8666-666666666666';
const w = (name, ret) => async (args) => { calls.order?.push(name); calls.writes.push([name, args]); return typeof ret === 'function' ? ret(args) : ret; };
const fakePrisma = {
  workout_routines: { findFirst: async (args) => { calls.findFirst.push(args); return calls.routine; } },
  $executeRaw: async (query) => {
    calls.executeRaw.push(query);
    const sql = query.sql ?? '';
    calls.order?.push(/pg_advisory_xact_lock/.test(sql) ? 'lock' : /INSERT INTO group_rankings/.test(sql) ? 'recompute' : 'executeRaw');
    return calls.count;
  },
  $transaction: async (fn) => fn(fakePrisma),
  exercises: { findMany: async () => [] },
  activities: {
    create: w('activities.create', { id: ACTIVITY }),
    findFirst: async () => calls.activity,
    count: async (args) => { calls.order?.push('count'); calls.counts.push(args); return calls.dayCount; },
    update: w('activities.update', {}),
    deleteMany: w('activities.deleteMany', () => ({ count: calls.deleted })),
  },
  workout_sets: {
    createMany: w('workout_sets.createMany', {}),
    deleteMany: w('workout_sets.deleteMany', {}),
    update: w('workout_sets.update', {}),
  },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const workoutRepository = require('../workout.repository');

const USER = '11111111-1111-4111-8111-111111111111';
const ROUTINE = '22222222-2222-4222-8222-222222222222';
const SUPINO = '33333333-3333-4333-8333-333333333333';
const REMADA = '55555555-5555-4555-8555-555555555555';

// O casamento posição + exercício + nº da série acontece no SQL; o teste ao vivo (QA) cobre o efeito no banco.
test('updateRoutineWeights: um UPDATE só, preso à rotina e ao dono, com as séries em VALUES', async () => {
  calls = { findFirst: [], executeRaw: [], routine: { id: ROUTINE }, count: 2 };
  const updated = await workoutRepository.updateRoutineWeights(USER, ROUTINE, [
    { position: 1, exercise_id: SUPINO, set_number: 2, weight_kg: 65 },
    { position: 2, exercise_id: REMADA, set_number: 1, weight_kg: null },
  ]);
  assert.equal(updated, 2);
  assert.deepEqual(calls.findFirst[0].where, { id: ROUTINE, user_id: USER });
  assert.equal(calls.executeRaw.length, 1);
  const [query] = calls.executeRaw;
  const sql = query.sql.replace(/\s+/g, ' ');
  assert.match(sql, /UPDATE routine_exercise_sets AS rs SET weight_kg = v\.weight_kg/);
  assert.match(sql, /wr\.id = \?::uuid AND wr\.user_id = \?::uuid/);
  assert.match(sql, /re\.position = v\.position AND re\.exercise_id = v\.exercise_id AND rs\.set_number = v\.set_number/);
  assert.deepEqual(query.values, [1, SUPINO, 2, 65, 2, REMADA, 1, null, ROUTINE, USER]);
});

test('updateRoutineWeights: rotina de outro usuário (ou inexistente) → null, sem UPDATE', async () => {
  calls = { findFirst: [], executeRaw: [], routine: null, count: 0 };
  const sets = [{ position: 1, exercise_id: SUPINO, set_number: 1, weight_kg: 40 }];
  assert.equal(await workoutRepository.updateRoutineWeights(USER, ROUTINE, sets), null);
  assert.equal(calls.executeRaw.length, 0);
});

const SET_A = '77777777-7777-4777-8777-777777777777';
const SET_B = '88888888-8888-4888-8888-888888888888';
const fresh = (over = {}) => ({ findFirst: [], executeRaw: [], writes: [], counts: [], order: [], routine: null, count: 0, dayCount: 0, ...over });

test('createSession: grava atividade e séries e recalcula o ranking na MESMA transação', async () => {
  calls = fresh();
  const id = await workoutRepository.createSession(USER, {
    routine_id: null,
    started_at: new Date('2026-10-06T12:00:00Z'),
    duration_sec: 600,
    sets: [{ exercise_id: SUPINO, position: 1, set_number: 1, duration_sec: 30, rest_before_sec: null, weight_kg: 20 }],
  });
  assert.equal(id, ACTIVITY);
  assert.deepEqual(calls.writes.map(([n]) => n), ['activities.create', 'workout_sets.createMany']);
  assert.equal(calls.executeRaw.length, 2, 'o lock e o recompute');
  assert.match(calls.executeRaw[0].sql, /pg_advisory_xact_lock/);
  assert.match(calls.executeRaw[1].sql, /INSERT INTO group_rankings/);
  assert.deepEqual(calls.executeRaw[1].values, [USER]);
});

test('deleteSession: só do dono e só STRENGTH; apagou → recalcula o ranking; não achou → não recalcula', async () => {
  calls = fresh({ deleted: 1 });
  assert.equal(await workoutRepository.deleteSession(USER, ACTIVITY), true);
  const [name, args] = calls.writes[0];
  assert.equal(name, 'activities.deleteMany');
  assert.deepEqual(args.where, { id: ACTIVITY, user_id: USER, activity_type: 'STRENGTH' });
  assert.equal(calls.executeRaw.length, 1);
  assert.deepEqual(calls.executeRaw[0].values, [USER]);

  calls = fresh({ deleted: 0 });
  assert.equal(await workoutRepository.deleteSession(USER, ACTIVITY), false);
  assert.equal(calls.executeRaw.length, 0);
});

test('updateSession: atividade de outro usuário → notFound, sem escrita', async () => {
  calls = fresh({ activity: null });
  assert.deepEqual(await workoutRepository.updateSession(USER, ACTIVITY, { duration_sec: 600, sets: [{ id: SET_A, duration_sec: 30 }] }), { notFound: true });
  assert.equal(calls.writes.length, 0);
});

test('updateSession: id de série que não é da atividade → badSet, sem escrita', async () => {
  calls = fresh({ activity: { workout_sets: [{ id: SET_A }] } });
  const out = await workoutRepository.updateSession(USER, ACTIVITY, { duration_sec: 600, sets: [{ id: SET_B, duration_sec: 30 }] });
  assert.deepEqual(out, { badSet: true });
  assert.equal(calls.writes.length, 0);
});

test('updateSession: atualiza as listadas, apaga as não listadas, nunca cria, e NÃO recalcula o ranking', async () => {
  calls = fresh({ activity: { workout_sets: [{ id: SET_A }, { id: SET_B }] } });
  const out = await workoutRepository.updateSession(USER, ACTIVITY, { duration_sec: 900, sets: [{ id: SET_A, duration_sec: 45, weight_kg: 22.5 }] });
  assert.deepEqual(out, { ok: true });
  const byName = Object.fromEntries(calls.writes.map(([n, a]) => [n, a]));
  assert.deepEqual(byName['activities.update'], { where: { id: ACTIVITY }, data: { duration_sec: 900 } });
  assert.deepEqual(byName['workout_sets.deleteMany'].where, { activity_id: ACTIVITY, id: { notIn: [SET_A] } });
  assert.deepEqual(byName['workout_sets.update'], { where: { id: SET_A }, data: { duration_sec: 45, weight_kg: 22.5 } });
  assert.equal(calls.writes.some(([n]) => n === 'workout_sets.createMany'), false);
  assert.equal(calls.executeRaw.length, 0, 'a data não muda, então o ranking não muda');
});

test('updateSession: carga ausente grava null', async () => {
  calls = fresh({ activity: { workout_sets: [{ id: SET_A }] } });
  await workoutRepository.updateSession(USER, ACTIVITY, { duration_sec: 900, sets: [{ id: SET_A, duration_sec: 45 }] });
  assert.equal(calls.writes.find(([n]) => n === 'workout_sets.update')[1].data.weight_kg, null);
});

const session = (started_at) => ({
  routine_id: null,
  started_at: new Date(started_at),
  duration_sec: 600,
  sets: [{ exercise_id: SUPINO, position: 1, set_number: 1, duration_sec: 30, rest_before_sec: null, weight_kg: 20 }],
});

// Teto por dia UTC do started_at: protege o ranking dos grupos (activities_count e o 1o desempate).
test('createSession: conta os STRENGTH do usuario no dia UTC do started_at, ANTES de criar, e o 5o treino do dia passa', async () => {
  calls = fresh({ dayCount: 4 }); // ja ha 4: o novo e o 5o
  assert.equal(await workoutRepository.createSession(USER, session('2026-10-06T12:00:00Z')), ACTIVITY);
  assert.equal(calls.counts.length, 1);
  assert.deepEqual(calls.counts[0].where, {
    user_id: USER,
    activity_type: 'STRENGTH',
    start_time: { gte: new Date('2026-10-06T00:00:00Z'), lt: new Date('2026-10-07T00:00:00Z') },
  });
  assert.deepEqual(calls.writes.map(([n]) => n), ['activities.create', 'workout_sets.createMany']);
  assert.equal(calls.executeRaw.length, 2, 'lock + ranking recalculado na mesma transacao');
  assert.match(calls.executeRaw[1].sql, /INSERT INTO group_rankings/);
});

test('createSession: o 6o treino do mesmo dia UTC e recusado, sem escrever nem recalcular', async () => {
  calls = fresh({ dayCount: 5 });
  await assert.rejects(
    workoutRepository.createSession(USER, session('2026-10-06T12:00:00Z')),
    (err) => err.code === 'SESSION_DAY_LIMIT' && /too many sessions on that day/.test(err.message),
  );
  assert.equal(calls.writes.length, 0);
  assert.equal(calls.executeRaw.length, 1, 'so o lock: nao recalcula o ranking');
  assert.match(calls.executeRaw[0].sql, /pg_advisory_xact_lock/);
});

test('createSession: a contagem e do dia UTC do started_at; outro dia tem a propria janela', async () => {
  calls = fresh();
  await workoutRepository.createSession(USER, session('2026-10-06T23:59:59.999Z'));
  assert.deepEqual(calls.counts[0].where.start_time, { gte: new Date('2026-10-06T00:00:00Z'), lt: new Date('2026-10-07T00:00:00Z') });
  calls = fresh();
  await workoutRepository.createSession(USER, session('2026-10-07T00:00:00Z'));
  assert.deepEqual(calls.counts[0].where.start_time, { gte: new Date('2026-10-07T00:00:00Z'), lt: new Date('2026-10-08T00:00:00Z') });
});

// Sem o lock, uma rajada de POSTs paralelos conta 4 antes de qualquer insert e fura o teto (READ COMMITTED).
test('createSession: o advisory lock do usuario vem ANTES do count e do create, e o recompute por ultimo', async () => {
  calls = fresh();
  await workoutRepository.createSession(USER, session('2026-10-06T12:00:00Z'));
  assert.deepEqual(calls.order, ['lock', 'count', 'activities.create', 'workout_sets.createMany', 'recompute']);
});

test('createSession: o lock e parametrizado (userId como parametro ::text, nunca concatenado)', async () => {
  calls = fresh();
  await workoutRepository.createSession(USER, session('2026-10-06T12:00:00Z'));
  const [lock] = calls.executeRaw;
  assert.equal(lock.text, 'SELECT pg_advisory_xact_lock(hashtext($1::text))');
  assert.deepEqual(lock.values, [USER]);
  assert.ok(!lock.sql.includes(USER), 'o userId nao pode estar no texto do SQL');
});

test('createSession: teto estourado → o lock ja foi tomado, mas nada e escrito nem recalculado', async () => {
  calls = fresh({ dayCount: 5 });
  await assert.rejects(workoutRepository.createSession(USER, session('2026-10-06T12:00:00Z')), { code: 'SESSION_DAY_LIMIT' });
  assert.deepEqual(calls.order, ['lock', 'count']);
});
