const profileController = require('../controller/profile.controller');
const authenticateToken = require('../middlewares/auth.middleware');

async function profileRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/', profileController.getProfile);
  fastify.post('/upload', profileController.uploadPhoto);
  fastify.put('/', profileController.updateProfile);
}

module.exports = profileRoutes;
