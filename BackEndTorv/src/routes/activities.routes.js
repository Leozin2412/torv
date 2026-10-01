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

async function activitiesRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/', {
    schema: {
      description: 'Activities do usuário, mais recente primeiro. Próxima página: before = next_before da anterior',
      tags: ['Activities'],
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        type: Type.Optional(Type.Union(ACTIVITY_TYPES.map((t) => Type.Literal(t)))),
        before: Type.Optional(Type.String({ format: 'date-time' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: { 200: ActivityPage, ...errors(400, 401, 403) },
    },
  }, activitiesController.listActivities);
}

module.exports = activitiesRoutes;
