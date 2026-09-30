const { randomUUID } = require('node:crypto');
const prisma = require('../lib/prisma');

// Transação interativa + createMany com ids gerados aqui: nested create faria 1 INSERT por linha
// (~40 idas e voltas até o banco num plano de 5 dias).
const TX = { timeout: 15000 };

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

      const slugs = [...new Set(routines.flatMap((r) => r.exercises.map((e) => e.slug)))];
      const catalog = await tx.exercises.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
      const idBySlug = new Map(catalog.map((c) => [c.slug, c.id]));

      const routineRows = routines.map((r) => ({ id: randomUUID(), user_id: userId, name: r.name, is_default: true, position: r.position }));
      await tx.workout_routines.createMany({ data: routineRows });
      await insertExercises(tx, routines.map((r, i) => exerciseRows(routineRows[i].id, r.exercises.map((e) => ({
        exercise_id: idBySlug.get(e.slug),
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
}

module.exports = new WorkoutRepository();
