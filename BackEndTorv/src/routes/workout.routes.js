const { Type } = require('@sinclair/typebox');
const workoutController = require('../controller/workout.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const {
  errors, IdParams, RoutineBody, RoutineList, RoutineDetail,
  ExerciseBody, Exercise, SessionBody, SessionSummary, SessionDetail,
} = require('./workout.schemas');

const tags = ['Workouts'];
const security = [{ bearerAuth: [] }];

async function workoutRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/routines', {
    schema: {
      description: 'Lista as rotinas do usuário. Gera o plano default na primeira chamada (workout_plan_basis NULL)',
      tags, security,
      response: { 200: RoutineList, ...errors(401, 403) },
    },
  }, workoutController.listRoutines);

  fastify.get('/routines/:id', {
    schema: { tags, security, params: IdParams, response: { 200: RoutineDetail, ...errors(400, 401, 403, 404) } },
  }, workoutController.getRoutine);

  fastify.post('/routines', {
    schema: { tags, security, body: RoutineBody, response: { 201: RoutineDetail, ...errors(400, 401, 403) } },
  }, workoutController.createRoutine);

  fastify.put('/routines/:id', {
    schema: {
      description: 'Substitui nome, exercícios e séries da rotina',
      tags, security, params: IdParams, body: RoutineBody,
      response: { 200: RoutineDetail, ...errors(400, 401, 403, 404) },
    },
  }, workoutController.updateRoutine);

  fastify.delete('/routines/:id', {
    schema: { tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, workoutController.deleteRoutine);

  fastify.post('/plan/accept', {
    schema: {
      description: 'Troca as rotinas default pelas geradas com o perfil atual. Sem sugestão pendente: não muda nada',
      tags, security,
      response: { 200: RoutineList, ...errors(401, 403) },
    },
  }, workoutController.acceptPlan);

  fastify.post('/plan/dismiss', {
    schema: { tags, security, response: { 200: Type.Object({ message: Type.String() }), ...errors(401, 403) } },
  }, workoutController.dismissPlan);

  fastify.get('/exercises', {
    schema: { tags, security, response: { 200: Type.Object({ exercises: Type.Array(Exercise) }), ...errors(401, 403) } },
  }, workoutController.listExercises);

  fastify.post('/exercises', {
    schema: { tags, security, body: ExerciseBody, response: { 201: Exercise, ...errors(400, 401, 403) } },
  }, workoutController.createExercise);

  fastify.put('/exercises/:id', {
    schema: { tags, security, params: IdParams, body: ExerciseBody, response: { 200: Exercise, ...errors(400, 401, 403, 404) } },
  }, workoutController.updateExercise);

  fastify.delete('/exercises/:id', {
    schema: { tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, workoutController.deleteExercise);

  fastify.post('/sessions', {
    schema: {
      description: 'Grava um treino finalizado. Mesmo started_at de novo → 200 com o id existente',
      tags, security, body: SessionBody,
      response: { 200: Type.Object({ activity_id: Type.String() }), 201: Type.Object({ activity_id: Type.String() }), ...errors(400, 401, 403) },
    },
  }, workoutController.createSession);

  fastify.get('/sessions', {
    schema: {
      tags, security,
      querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })) }),
      response: { 200: Type.Object({ sessions: Type.Array(SessionSummary) }), ...errors(400, 401, 403) },
    },
  }, workoutController.listSessions);

  fastify.get('/sessions/:id', {
    schema: { tags, security, params: IdParams, response: { 200: SessionDetail, ...errors(400, 401, 403, 404) } },
  }, workoutController.getSession);
}

module.exports = workoutRoutes;
