const { Type } = require('@sinclair/typebox');
const users = require('../controller/users.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { errors, IdParams } = require('./workout.schemas');
const { ActivityPage, LocalDayQuery } = require('./activities.schemas');

const tags = ['Users'];
const security = [{ bearerAuth: [] }];
const Nullable = (schema) => Type.Union([schema, Type.Null()]);

// Lista branca: o Fastify só serializa o que está aqui.
const MemberProfile = Type.Object({
  user: Type.Object({
    id: Type.String(),
    name: Type.String(),
    username: Type.String(),
    photo_url: Nullable(Type.String()),
    fitness_level: Nullable(Type.String()),
  }),
  is_me: Type.Boolean(),
  streak: Type.Object({ current: Type.Integer(), longest: Type.Integer() }),
  month: Type.Object({ active_days: Type.Integer(), activities: Type.Integer(), active_days_delta: Type.Integer() }),
  total_activities: Type.Integer(),
  calendar: Type.Object({
    start: Type.String(),
    end: Type.String(),
    days: Type.Array(Type.Object({ date: Type.String(), count: Type.Integer() })),
  }),
});

async function usersRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/:id/profile', {
    schema: {
      description: 'Perfil de membro: o próprio usuário ou quem divide um grupo com ele (senão 404). Streak, mês e calendário no dia local de quem vê',
      tags, security, params: IdParams, querystring: LocalDayQuery,
      response: { 200: MemberProfile, ...errors(400, 401, 403, 404) },
    },
  }, users.profile);

  fastify.get('/:id/activities', {
    schema: {
      description: 'Histórico de um membro (mesma regra de acesso), mais recente primeiro. Próxima página: before = next_before',
      tags, security, params: IdParams,
      querystring: Type.Object({
        before: Type.Optional(Type.String({ format: 'date-time' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: { 200: ActivityPage, ...errors(400, 401, 403, 404) },
    },
  }, users.activities);
}

module.exports = usersRoutes;
