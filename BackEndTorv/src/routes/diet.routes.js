const dietController = require('../controller/diet.controller');
const authenticateToken = require('../middlewares/auth.middleware');

async function dietRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/summary', dietController.getDietSummary);
  fastify.get('/', dietController.getDiet);
  fastify.post('/', dietController.addFoodLog);
  fastify.put('/targets', dietController.updateNutritionTargets);
  fastify.put('/:logId', dietController.updateFoodLog);
  fastify.delete('/:logId', dietController.deleteFoodLog);
}

module.exports = dietRoutes;
