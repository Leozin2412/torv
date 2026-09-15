require('dotenv').config();
const path = require('path');
const fastify = require('fastify')({ logger: true });

fastify.addHook('onResponse', (request, reply, done) => {
  console.log(`${request.method} ${request.url} -> ${reply.statusCode} (${reply.elapsedTime.toFixed(1)}ms)`);
  done();
});

fastify.register(require('@fastify/cors'), {});
fastify.register(require('@fastify/multipart'));
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'profilePhotos'),
  prefix: '/uploads/',
});

fastify.register(require('./src/routes/auth.routes'), { prefix: '/auth' });
fastify.register(require('./src/routes/profile.routes'), { prefix: '/profile' });
fastify.register(require('./src/routes/diet.routes'), { prefix: '/diet' });

fastify.setErrorHandler((err, request, reply) => {
  fastify.log.error(err);
  reply.status(500).send({ error: 'An unexpected error occurred' });
});

const PORT = process.env.PORT || 3000;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server is running on ${address}`);
});
