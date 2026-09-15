require('dotenv').config();
const path = require('path');
const Fastify = require('fastify');
const { LogController } = Fastify;
const fastify = Fastify({
  logger: true,
  logController: new LogController({ disableRequestLogging: true }),
});

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

if (process.env.NODE_ENV !== 'production') {
  fastify.register(require('@fastify/swagger'), {
    openapi: {
      info: {
        title: 'Torv API',
        description: 'API documentada automaticamente com Fastify e TypeBox',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
          },
        },
      },
    },
  });

  fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });
}

fastify.register(require('./src/routes/auth.routes'), { prefix: '/auth' });
fastify.register(require('./src/routes/profile.routes'), { prefix: '/profile' });
fastify.register(require('./src/routes/diet.routes'), { prefix: '/diet' });

fastify.setErrorHandler((err, request, reply) => {
  fastify.log.error(err);
  console.error(err);

  if (err.validation) {
    return reply.status(err.statusCode || 400).send({ error: err.message });
  }

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
