const { Type } = require('@sinclair/typebox');
const dietController = require('../controller/diet.controller');
const authenticateToken = require('../middlewares/auth.middleware');

const dietSummarySchema = Type.Object({
  date: Type.String(),
  targets: Type.Object({
    daily_calories: Type.Number(),
    protein_g: Type.Number(),
    carbs_g: Type.Number(),
    fat_g: Type.Number(),
  }),
  consumed: Type.Object({
    calories: Type.Number(),
    protein_g: Type.Number(),
    carbs_g: Type.Number(),
    fat_g: Type.Number(),
  }),
  remaining: Type.Object({
    calories: Type.Number(),
    protein_g: Type.Number(),
    carbs_g: Type.Number(),
    fat_g: Type.Number(),
  }),
  logs: Type.Array(Type.Object({
    id: Type.String(),
    user_id: Type.String(),
    food_name: Type.String(),
    calories: Type.Number(),
    logged_date: Type.Any(),
    macros_json: Type.Any(),
  })),
});

async function dietRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  const summaryQuerystring = Type.Object({
    date: Type.Optional(Type.String({ description: 'YYYY-MM-DD, padrão: hoje' })),
  });

  const getDietSummarySchema = {
    description: 'Retorna o resumo nutricional (metas, consumido, restante) e os registros do dia',
    tags: ['Diet'],
    security: [{ bearerAuth: [] }],
    querystring: summaryQuerystring,
    response: {
      200: dietSummarySchema,
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.get('/summary', { schema: getDietSummarySchema }, dietController.getDietSummary);

  const getDietSchema = {
    description: 'Alias de /summary para compatibilidade retroativa',
    tags: ['Diet'],
    security: [{ bearerAuth: [] }],
    querystring: summaryQuerystring,
    response: {
      200: dietSummarySchema,
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.get('/', { schema: getDietSchema }, dietController.getDiet.bind(dietController));

  const addFoodLogSchema = {
    description: 'Registra um alimento consumido e retorna o resumo nutricional atualizado',
    tags: ['Diet'],
    security: [{ bearerAuth: [] }],
    body: Type.Object({
      food_name: Type.String(),
      calories: Type.Number(),
      macros_json: Type.Any({ description: 'Objeto com macros (ex: {protein, carbs, fat})' }),
      logged_date: Type.Optional(Type.String({ description: 'YYYY-MM-DD, padrão: hoje' })),
    }),
    response: {
      201: dietSummarySchema,
      400: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.post('/', { schema: addFoodLogSchema }, dietController.addFoodLog);

  const updateTargetsSchema = {
    description: 'Cria ou atualiza as metas nutricionais diárias do usuário',
    tags: ['Diet'],
    security: [{ bearerAuth: [] }],
    body: Type.Object({
      daily_calories: Type.Number(),
      protein_g: Type.Optional(Type.Number()),
      carbs_g: Type.Optional(Type.Number()),
      fat_g: Type.Optional(Type.Number()),
    }),
    response: {
      200: dietSummarySchema,
      400: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.put('/targets', { schema: updateTargetsSchema }, dietController.updateNutritionTargets);

  const logIdParams = Type.Object({
    logId: Type.String(),
  });

  const updateFoodLogSchema = {
    description: 'Atualiza um registro de alimento existente e retorna o resumo nutricional atualizado',
    tags: ['Diet'],
    security: [{ bearerAuth: [] }],
    params: logIdParams,
    body: Type.Object({
      food_name: Type.Optional(Type.String()),
      calories: Type.Optional(Type.Number()),
      macros_json: Type.Optional(Type.Any()),
    }),
    response: {
      200: dietSummarySchema,
      400: Type.Object({ error: Type.String() }),
      404: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.put('/:logId', { schema: updateFoodLogSchema }, dietController.updateFoodLog);

  const deleteFoodLogSchema = {
    description: 'Remove um registro de alimento e retorna o resumo nutricional atualizado',
    tags: ['Diet'],
    security: [{ bearerAuth: [] }],
    params: logIdParams,
    response: {
      200: dietSummarySchema,
      400: Type.Object({ error: Type.String() }),
      404: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.delete('/:logId', { schema: deleteFoodLogSchema }, dietController.deleteFoodLog);
}

module.exports = dietRoutes;
