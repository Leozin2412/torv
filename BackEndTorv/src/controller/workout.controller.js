const workoutRepository = require('../repository/workout.repository');
const { ensureDefaultPlan, planSuggestion, acceptPlan, dismissPlan, nextRoutineId } = require('../lib/workoutPlan');
const { checkRoutineBody, checkExerciseBody, checkSessionBody } = require('../lib/workoutValidation');

// Recurso de outro usuário (ou do catálogo tratado como próprio) → 404, nunca 403: não revela que existe.
const NOT_FOUND = { error: 'Not found' };

function routineSummary(r) {
  return {
    id: r.id,
    name: r.name,
    is_default: r.is_default,
    exercise_count: r.routine_exercises.length,
    set_count: r.routine_exercises.reduce((n, e) => n + e._count.sets, 0),
  };
}

function routineDetail(r) {
  return {
    id: r.id,
    name: r.name,
    is_default: r.is_default,
    exercises: r.routine_exercises.map((e) => ({
      id: e.id,
      exercise_id: e.exercise_id,
      name: e.exercise.name,
      muscle_group: e.exercise.muscle_group,
      position: e.position,
      reps_min: e.reps_min,
      reps_max: e.reps_max,
      rest_sec: e.rest_sec,
      sets: e.sets.map((s) => ({ set_number: s.set_number, weight_kg: s.weight_kg == null ? null : Number(s.weight_kg) })),
    })),
  };
}

// Janela do selo "Concluído": treino feito nos últimos 7 dias (corridos, relógio do servidor).
const RECENT_MS = 7 * 24 * 3600 * 1000;

async function routinesPayload(userId, inputs) {
  const [routines, last, recent] = await Promise.all([
    workoutRepository.listRoutines(userId),
    workoutRepository.lastRoutineId(userId),
    workoutRepository.recentRoutineIds(userId, new Date(Date.now() - RECENT_MS)),
  ]);
  const done = new Set(recent);
  return {
    routines: routines.map((r) => ({ ...routineSummary(r), completed_recently: done.has(r.id) })),
    next_routine_id: nextRoutineId(routines, last),
    plan_suggestion: planSuggestion(inputs),
  };
}

// Corpo já passou pelo schema; aqui entram as regras cruzadas e a visibilidade dos exercícios.
async function prepareRoutine(userId, body) {
  const error = checkRoutineBody(body);
  if (error) return { error };
  const ids = [...new Set(body.exercises.map((e) => e.exercise_id))];
  if (await workoutRepository.countVisibleExercises(userId, ids) !== ids.length) return { error: 'exercise not found' };
  return { data: { name: body.name.trim(), exercises: body.exercises } };
}

function prepareExercise(body) {
  const error = checkExerciseBody(body);
  return error ? { error } : { data: { name: body.name.trim(), muscle_group: body.muscle_group } };
}

class WorkoutController {
  async listRoutines(request, reply) {
    const { userId } = request.user;
    const inputs = await ensureDefaultPlan(userId);
    return reply.send(await routinesPayload(userId, inputs));
  }

  async getRoutine(request, reply) {
    const routine = await workoutRepository.getRoutine(request.user.userId, request.params.id);
    return routine ? reply.send(routineDetail(routine)) : reply.status(404).send(NOT_FOUND);
  }

  async createRoutine(request, reply) {
    const { userId } = request.user;
    const { error, data } = await prepareRoutine(userId, request.body);
    if (error) return reply.status(400).send({ error });
    const id = await workoutRepository.createRoutine(userId, data);
    return reply.status(201).send(routineDetail(await workoutRepository.getRoutine(userId, id)));
  }

  async updateRoutine(request, reply) {
    const { userId } = request.user;
    const { id } = request.params;
    const { error, data } = await prepareRoutine(userId, request.body);
    if (error) return reply.status(400).send({ error });
    if (!await workoutRepository.updateRoutine(userId, id, data)) return reply.status(404).send(NOT_FOUND);
    return reply.send(routineDetail(await workoutRepository.getRoutine(userId, id)));
  }

  async deleteRoutine(request, reply) {
    const deleted = await workoutRepository.deleteRoutine(request.user.userId, request.params.id);
    return deleted ? reply.status(204).send() : reply.status(404).send(NOT_FOUND);
  }

  async acceptPlan(request, reply) {
    const { userId } = request.user;
    await acceptPlan(userId);
    return reply.send(await routinesPayload(userId, await workoutRepository.getPlanInputs(userId)));
  }

  async dismissPlan(request, reply) {
    await dismissPlan(request.user.userId);
    return reply.send({ message: 'Plan suggestion dismissed' });
  }

  async listExercises(request, reply) {
    const rows = await workoutRepository.listExercises(request.user.userId);
    return reply.send({
      exercises: rows.map((e) => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, is_custom: e.owner_user_id !== null })),
    });
  }

  async createExercise(request, reply) {
    const { error, data } = prepareExercise(request.body);
    if (error) return reply.status(400).send({ error });
    const { id } = await workoutRepository.createExercise(request.user.userId, data);
    return reply.status(201).send({ id, ...data, is_custom: true });
  }

  async updateExercise(request, reply) {
    const { error, data } = prepareExercise(request.body);
    if (error) return reply.status(400).send({ error });
    const { id } = request.params;
    const updated = await workoutRepository.updateExercise(request.user.userId, id, data);
    return updated ? reply.send({ id, ...data, is_custom: true }) : reply.status(404).send(NOT_FOUND);
  }

  async deleteExercise(request, reply) {
    const deleted = await workoutRepository.deleteExercise(request.user.userId, request.params.id);
    return deleted ? reply.status(204).send() : reply.status(404).send(NOT_FOUND);
  }

  // Idempotente por started_at: reenvio depois de falha de rede devolve 200 com o mesmo id,
  // sem inserir de novo (streak/ranking contam uma vez só).
  async createSession(request, reply) {
    const { userId } = request.user;
    const error = checkSessionBody(request.body);
    if (error) return reply.status(400).send({ error });
    const startedAt = new Date(request.body.started_at);

    const existing = await workoutRepository.findSessionByStart(userId, startedAt);
    if (existing) return reply.send({ activity_id: existing });
    try {
      const id = await workoutRepository.createSession(userId, { ...request.body, started_at: startedAt });
      return reply.status(201).send({ activity_id: id });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
      // Corrida: outra request com o mesmo started_at gravou entre o check e o insert.
      return reply.send({ activity_id: await workoutRepository.findSessionByStart(userId, startedAt) });
    }
  }

  async getSession(request, reply) {
    const s = await workoutRepository.getSession(request.user.userId, request.params.id);
    if (!s) return reply.status(404).send(NOT_FOUND);
    return reply.send({ id: s.id, title: s.title, start_time: s.start_time.toISOString(), duration_sec: s.duration_sec, sets: s.workout_sets });
  }
}

module.exports = new WorkoutController();
