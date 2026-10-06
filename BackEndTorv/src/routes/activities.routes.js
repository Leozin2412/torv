const { Type } = require('@sinclair/typebox');
const activitiesController = require('../controller/activities.controller');
const authenticateToken = require('../middlewares/auth.middleware');

// Tipos que o app conhece. Tipo novo (cardio etc.): uma entrada aqui e em ACTIVITY_LABELS no front.
const ACTIVITY_TYPES = ['STRENGTH'];

const ErrorBody = Type.Object({ error: Type.String() });
const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));

const ActivityPage = Type.Object({
  activities: Type.Array(Type.Object({
    id: Type.String(),
    activity_type: Type.String(),
    title: Type.String(),
    start_time: Type.String(),
    duration_sec: Type.Integer(),
    set_count: Type.Integer(),
  })),
  next_before: Type.Union([Type.String(), Type.Null()]),
});

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
      description: 'Resumo do dia para a Home: streak (dias locais seguidos com treino STRENGTH; viva se treinou hoje ou ontem) e calorias do dia local. Dia local = start_time + tz_offset_min',
      tags: ['Activities'],
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        date: Type.String({ pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$', description: 'Dia local do cliente, YYYY-MM-DD' }),
        tz_offset_min: Type.Integer({ minimum: -840, maximum: 840, description: 'Minutos que o relógio local difere de UTC (BRT = -180)' }),
      }),
      response: { 200: Summary, ...errors(400, 401, 403) },
    },
  }, activitiesController.getSummary);
}

module.exports = activitiesRoutes;
