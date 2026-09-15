const authController = require('../controller/auth.controller');

async function authRoutes(fastify) {
  fastify.post('/register', authController.register);
  fastify.post('/login', authController.login);
}

module.exports = authRoutes;
