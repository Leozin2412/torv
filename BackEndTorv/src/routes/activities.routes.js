const { Type } = require('@sinclair/typebox');
const activitiesController = require('../controller/activities.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { ACTIVITY_TYPES, ActivityPage, LocalDayQuery } = require('./activities.schemas');

const ErrorBody = Type.Object({ error: Type.String() });
const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));

const Summary = Type.Object({ streak_days: Type.Integer(), calories_burned: Type.Integer() });

async function activitiesRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/', {
    schema: {
      description: 'Activities do usuário, mais recente primeiro. Período: from (inclusivo) e before (exclusivo). Próxima página: before = next_before da anterior',
      tags: ['Activities'],
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        type: Type.Optional(Type.Union(ACTIVITY_TYPES.map((t) => Type.Literal(t)))),
        from: Type.Optional(Type.String({ format: 'date-time' })),
        before: Type.Optional(Type.String({ format: 'date-time' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: { 200: ActivityPage, ...errors(400, 401, 403) },
    },
  }, activitiesController.listActivities);

  // Antes de qualquer rota com :id.
  fastify.get('/summary', {
    schema: {
      description: 'Resumo do dia para a Home: streak (dias locais seguidos com atividade de qualquer tipo; viva se teve atividade hoje ou ontem) e calorias do dia local. Dia local = start_time + tz_offset_min',
      tags: ['Activities'],
      security: [{ bearerAuth: [] }],
      querystring: LocalDayQuery,
      response: { 200: Summary, ...errors(400, 401, 403) },
    },
  }, activitiesController.getSummary);
}

module.exports = activitiesRoutes;
