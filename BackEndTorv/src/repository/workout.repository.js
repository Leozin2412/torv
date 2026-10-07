const { randomUUID } = require('node:crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const groupsRepository = require('./groups.repository');

// Transação interativa + createMany com ids gerados aqui: nested create faria 1 INSERT por linha
// (~40 idas e voltas até o banco num plano de 5 dias).
const TX = { timeout: 15000 };
// Teto de treinos STRENGTH por dia UTC do started_at. O ranking dos grupos desempata por activities_count, e cada POST
// cria uma atividade: sem teto, repetir POSTs com started_at diferentes no mesmo dia forjaria o desempate.
const MAX_SESSIONS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const visibleExercise = (userId) => ({ OR: [{ owner_user_id: null }, { owner_user_id: userId }] });

// exercises: [{ exercise_id, reps_min, reps_max, rest_sec, sets: [{ weight_kg }] }] → linhas das 2 tabelas.
function exerciseRows(routineId, exercises) {
  const exRows = [];
  const setRows = [];
  exercises.forEach((ex, i) => {
    const id = randomUUID();
    exRows.push({ id, routine_id: routineId, exercise_id: ex.exercise_id, position: i + 1, reps_min: ex.reps_min, reps_max: ex.reps_max, rest_sec: ex.rest_sec });
    ex.sets.forEach((s, j) => setRows.push({ routine_exercise_id: id, set_number: j + 1, weight_kg: s.weight_kg }));
  });
  return { exRows, setRows };
}

async function insertExercises(tx, rows) {
  await tx.routine_exercises.createMany({ data: rows.flatMap((r) => r.exRows) });
  await tx.routine_exercise_sets.createMany({ data: rows.flatMap((r) => r.setRows) });
}

const routineDetailSelect = {
  id: true,
  name: true,
  is_default: true,
  routine_exercises: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      exercise_id: true,
      position: true,
      reps_min: true,
      reps_max: true,
      rest_sec: true,
      exercise: { select: { name: true, muscle_group: true } },
      sets: { orderBy: { set_number: 'asc' }, select: { set_number: true, weight_kg: true } },
    },
  },
};

class WorkoutRepository {
  async getPlanInputs(userId) {
    const p = await prisma.user_profiles.findUnique({
      where: { user_id: userId },
      select: { gender: true, fitness_level: true, goal: true, workout_plan_basis: true },
    });
    return p && { gender: p.gender, fitnessLevel: p.fitness_level, goals: p.goal, savedBasis: p.workout_plan_basis };
  }

  // Regras do workoutGenerator.generatePlan: catálogo (owner_user_id NULL) na ordem de preferência e slots na ordem do dia.
  async getGeneratorRules() {
    const [catalog, slots] = await Promise.all([
      prisma.exercises.findMany({
        where: { owner_user_id: null },
        orderBy: { catalog_order: 'asc' },
        select: { id: true, slug: true, muscle_group: true, type: true, min_level: true },
      }),
      prisma.workout_template_slots.findMany({ orderBy: [{ days_per_week: 'asc' }, { day: 'asc' }, { position: 'asc' }] }),
    ]);
    return { catalog, slots };
  }

  // routines: saída do generatePlan (exercises com exercise_id).
  // mode 'create': só grava se o plano nunca foi gerado. 'replace': só se o basis mudou, e troca as
  // rotinas default. O UPDATE condicional trava a linha do perfil: a 2ª request concorrente reavalia o
  // WHERE, afeta 0 linhas e sai sem inserir (retorna false).
  async savePlan(userId, basis, routines, mode) {
    const json = JSON.stringify(basis);
    return prisma.$transaction(async (tx) => {
      const updated = mode === 'create'
        ? await tx.$executeRaw`UPDATE user_profiles SET workout_plan_basis = ${json}::jsonb WHERE user_id = ${userId}::uuid AND workout_plan_basis IS NULL`
        : await tx.$executeRaw`UPDATE user_profiles SET workout_plan_basis = ${json}::jsonb WHERE user_id = ${userId}::uuid AND workout_plan_basis IS DISTINCT FROM ${json}::jsonb`;
      if (updated === 0) return false;
      if (mode === 'replace') await tx.workout_routines.deleteMany({ where: { user_id: userId, is_default: true } });

      const routineRows = routines.map((r) => ({ id: randomUUID(), user_id: userId, name: r.name, is_default: true, position: r.position }));
      await tx.workout_routines.createMany({ data: routineRows });
      await insertExercises(tx, routines.map((r, i) => exerciseRows(routineRows[i].id, r.exercises.map((e) => ({
        exercise_id: e.exercise_id,
        reps_min: e.reps_min,
        reps_max: e.reps_max,
        rest_sec: e.rest_sec,
        sets: Array.from({ length: e.set_count }, () => ({ weight_kg: null })),
      })))));
      return true;
    }, TX);
  }

  async setPlanBasis(userId, basis) {
    await prisma.user_profiles.update({ where: { user_id: userId }, data: { workout_plan_basis: basis } });
  }

  async listRoutines(userId) {
    return prisma.workout_routines.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { position: 'asc' }, { created_at: 'asc' }],
      select: { id: true, name: true, is_default: true, routine_exercises: { select: { _count: { select: { sets: true } } } } },
    });
  }

  async lastRoutineId(userId) {
    const last = await prisma.activities.findFirst({
      where: { user_id: userId, activity_type: 'STRENGTH', routine_id: { not: null } },
      orderBy: { start_time: 'desc' },
      select: { routine_id: true },
    });
    return last?.routine_id ?? null;
  }

  // Rotinas com treino desde `since` (selo "Concluído" na lista de rotinas).
  async recentRoutineIds(userId, since) {
    const rows = await prisma.activities.findMany({
      where: { user_id: userId, activity_type: 'STRENGTH', routine_id: { not: null }, start_time: { gte: since } },
      distinct: ['routine_id'],
      select: { routine_id: true },
    });
    return rows.map((r) => r.routine_id);
  }

  async getRoutine(userId, id) {
    return prisma.workout_routines.findFirst({ where: { id, user_id: userId }, select: routineDetailSelect });
  }

  async countVisibleExercises(userId, ids) {
    return prisma.exercises.count({ where: { id: { in: ids }, ...visibleExercise(userId) } });
  }

  async createRoutine(userId, { name, exercises }) {
    const id = randomUUID();
    await prisma.$transaction(async (tx) => {
      const { _max } = await tx.workout_routines.aggregate({ where: { user_id: userId }, _max: { position: true } });
      await tx.workout_routines.create({ data: { id, user_id: userId, name, position: (_max.position ?? 0) + 1 } });
      await insertExercises(tx, [exerciseRows(id, exercises)]);
    }, TX);
    return id;
  }

  // Substitui todos os exercícios/séries. false = rotina não é do usuário.
  async updateRoutine(userId, id, { name, exercises }) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.workout_routines.updateMany({ where: { id, user_id: userId }, data: { name } });
      if (count === 0) return false;
      await tx.routine_exercises.deleteMany({ where: { routine_id: id } });
      await insertExercises(tx, [exerciseRows(id, exercises)]);
      return true;
    }, TX);
  }

  // Um UPDATE só (cada ida ao banco custa ~200 ms; 1 por série estourava o timeout com rotina grande).
  // Muda a série que ainda bate com a rotina atual (posição + exercício + nº da série): rotina editada no meio
  // do treino não recebe carga no lugar errado. O dono também vai no WHERE. null = rotina não é do usuário.
  async updateRoutineWeights(userId, routineId, sets) {
    const routine = await prisma.workout_routines.findFirst({ where: { id: routineId, user_id: userId }, select: { id: true } });
    if (!routine) return null;
    const values = sets.map((s) => Prisma.sql`(${s.position}::int, ${s.exercise_id}::uuid, ${s.set_number}::int, ${s.weight_kg}::numeric)`);
    return prisma.$executeRaw(Prisma.sql`
      UPDATE routine_exercise_sets AS rs
      SET weight_kg = v.weight_kg
      FROM routine_exercises AS re, workout_routines AS wr,
        (VALUES ${Prisma.join(values)}) AS v(position, exercise_id, set_number, weight_kg)
      WHERE rs.routine_exercise_id = re.id
        AND re.routine_id = wr.id
        AND wr.id = ${routineId}::uuid
        AND wr.user_id = ${userId}::uuid
        AND re.position = v.position
        AND re.exercise_id = v.exercise_id
        AND rs.set_number = v.set_number`);
  }

  async deleteRoutine(userId, id) {
    const { count } = await prisma.workout_routines.deleteMany({ where: { id, user_id: userId } });
    return count > 0;
  }

  async listExercises(userId) {
    return prisma.exercises.findMany({
      where: visibleExercise(userId),
      orderBy: [{ muscle_group: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, muscle_group: true, owner_user_id: true },
    });
  }

  async createExercise(userId, { name, muscle_group }) {
    return prisma.exercises.create({ data: { name, muscle_group, owner_user_id: userId }, select: { id: true } });
  }

  // Só exercício próprio: catálogo tem owner_user_id NULL e nunca casa.
  async updateExercise(userId, id, { name, muscle_group }) {
    const { count } = await prisma.exercises.updateMany({ where: { id, owner_user_id: userId }, data: { name, muscle_group } });
    return count > 0;
  }

  async deleteExercise(userId, id) {
    const { count } = await prisma.exercises.deleteMany({ where: { id, owner_user_id: userId } });
    return count > 0;
  }

  async findSessionByStart(userId, startedAt) {
    const row = await prisma.activities.findFirst({
      where: { user_id: userId, activity_type: 'STRENGTH', start_time: startedAt },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  // Rotina/exercício que não é do usuário (ou foi apagado no meio do treino) não é vinculado nem
  // tem o nome exposto: vira "Treino livre" / "Exercício removido".
  async createSession(userId, { routine_id, started_at, duration_sec, sets }) {
    const ids = [...new Set(sets.map((s) => s.exercise_id))];
    const [routine, exercises] = await Promise.all([
      routine_id ? prisma.workout_routines.findFirst({ where: { id: routine_id, user_id: userId }, select: { id: true, name: true } }) : null,
      prisma.exercises.findMany({ where: { id: { in: ids }, ...visibleExercise(userId) }, select: { id: true, name: true } }),
    ]);
    const nameById = new Map(exercises.map((e) => [e.id, e.name]));

    return prisma.$transaction(async (tx) => {
      // Contagem na mesma transação do insert, antes dele. A idempotência por started_at exato vem antes, no controller.
      const dayStart = new Date(Math.floor(started_at.getTime() / DAY_MS) * DAY_MS);
      const sameDay = await tx.activities.count({
        where: { user_id: userId, activity_type: 'STRENGTH', start_time: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) } },
      });
      if (sameDay >= MAX_SESSIONS_PER_DAY) {
        throw Object.assign(new Error('too many sessions on that day'), { code: 'SESSION_DAY_LIMIT' });
      }
      const activity = await tx.activities.create({
        data: {
          user_id: userId,
          activity_type: 'STRENGTH',
          title: routine?.name ?? 'Treino livre',
          start_time: started_at,
          duration_sec,
          routine_id: routine?.id ?? null,
        },
        select: { id: true },
      });
      await tx.workout_sets.createMany({
        data: sets.map((s) => ({
          activity_id: activity.id,
          exercise_id: nameById.has(s.exercise_id) ? s.exercise_id : null,
          exercise_name: nameById.get(s.exercise_id) ?? 'Exercício removido',
          position: s.position,
          set_number: s.set_number,
          duration_sec: s.duration_sec,
          rest_before_sec: s.rest_before_sec,
          weight_kg: s.weight_kg ?? null,
        })),
      });
      // Ranking dos grupos do usuário, na mesma transação: ou grava treino e pontos, ou nenhum dos dois.
      await groupsRepository.recomputeRanking(tx, userId);
      return activity.id;
    }, TX);
  }

  async getSession(userId, id) {
    return prisma.activities.findFirst({
      where: { id, user_id: userId, activity_type: 'STRENGTH' },
      select: {
        id: true,
        title: true,
        start_time: true,
        duration_sec: true,
        workout_sets: {
          orderBy: [{ position: 'asc' }, { set_number: 'asc' }],
          select: { id: true, exercise_name: true, position: true, set_number: true, duration_sec: true, rest_before_sec: true, weight_kg: true },
        },
      },
    });
  }

  // Só duração e carga das séries; started_at, rotina, título, exercício e posição ficam como estão.
  // As séries não listadas são apagadas (é assim que se remove uma série); nunca cria série.
  // A data não muda, então o ranking não muda: sem recomputeRanking aqui.
  // ponytail: 1 UPDATE por série dentro da transação (até 200); trocar por UPDATE ... FROM (VALUES ...) se pesar.
  async updateSession(userId, id, { duration_sec, sets }) {
    return prisma.$transaction(async (tx) => {
      const activity = await tx.activities.findFirst({
        where: { id, user_id: userId, activity_type: 'STRENGTH' },
        select: { workout_sets: { select: { id: true } } },
      });
      if (!activity) return { notFound: true };
      const own = new Set(activity.workout_sets.map((s) => s.id));
      if (sets.some((s) => !own.has(s.id))) return { badSet: true };

      await tx.activities.update({ where: { id }, data: { duration_sec } });
      await tx.workout_sets.deleteMany({ where: { activity_id: id, id: { notIn: sets.map((s) => s.id) } } });
      for (const s of sets) {
        await tx.workout_sets.update({ where: { id: s.id }, data: { duration_sec: s.duration_sec, weight_kg: s.weight_kg ?? null } });
      }
      return { ok: true };
    }, TX);
  }

  // Apagar muda os pontos: o ranking é recalculado na mesma transação (dia com 2 treinos mantém o ponto).
  async deleteSession(userId, id) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.activities.deleteMany({ where: { id, user_id: userId, activity_type: 'STRENGTH' } });
      if (count === 0) return false;
      await groupsRepository.recomputeRanking(tx, userId);
      return true;
    }, TX);
  }
}

module.exports = new WorkoutRepository();
