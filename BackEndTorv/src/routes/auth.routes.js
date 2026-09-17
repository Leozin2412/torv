const { Type } = require('@sinclair/typebox');
const authController = require('../controller/auth.controller');

const userProfileSchema = Type.Union([
  Type.Object({
    user_id: Type.String(),
    username: Type.String(),
    name: Type.String(),
    fitness_level: Type.Union([Type.String(), Type.Null()]),
    goal: Type.Union([Type.String(), Type.Null()]),
    photo_url: Type.Union([Type.String(), Type.Null()]),
    birth_date: Type.Any(),
    gender: Type.Union([Type.String(), Type.Null()]),
  }),
  Type.Null(),
]);

async function authRoutes(fastify) {
  const registerSchema = {
    description: 'Registra um novo usuário',
    tags: ['Auth'],
    body: Type.Object({
      email: Type.String(),
      password: Type.String(),
      name: Type.String(),
      birth_date: Type.Optional(Type.String({ description: 'DD/MM/YYYY ou YYYY-MM-DD' })),
      weight: Type.Optional(Type.Number()),
      height: Type.Optional(Type.Number()),
      gender: Type.Optional(Type.String()),
      fitness_level: Type.Optional(Type.String()),
      goal: Type.Optional(Type.String()),
    }),
    response: {
      201: Type.Object({
        message: Type.String(),
        token: Type.String(),
        user: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.Union([Type.String(), Type.Null()]),
          username: Type.Union([Type.String(), Type.Null()]),
          photo_url: Type.Union([Type.String(), Type.Null()]),
          profile: userProfileSchema,
        }),
      }),
      400: Type.Object({ error: Type.String() }),
      409: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.post('/register', { schema: registerSchema }, authController.register);

  const loginSchema = {
    description: 'Autentica um usuário e retorna um token JWT',
    tags: ['Auth'],
    body: Type.Object({
      email: Type.String(),
      password: Type.String(),
    }),
    response: {
      200: Type.Object({
        message: Type.String(),
        token: Type.String(),
        user: Type.Object({
          id: Type.String(),
          email: Type.String(),
          name: Type.Union([Type.String(), Type.Null()]),
          username: Type.Union([Type.String(), Type.Null()]),
          photo_url: Type.Union([Type.String(), Type.Null()]),
          profile: userProfileSchema,
        }),
      }),
      400: Type.Object({ error: Type.String() }),
      401: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.post('/login', { schema: loginSchema }, authController.login);
}

module.exports = authRoutes;
