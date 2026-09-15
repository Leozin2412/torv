const { Type } = require('@sinclair/typebox');
const profileController = require('../controller/profile.controller');
const authenticateToken = require('../middlewares/auth.middleware');

async function profileRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  const getProfileSchema = {
    description: 'Retorna o perfil completo do usuário autenticado',
    tags: ['Profile'],
    security: [{ bearerAuth: [] }],
    response: {
      200: Type.Object({
        id: Type.String(),
        email: Type.String(),
        username: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        fitness_level: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        goal: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        photo_url: Type.Union([Type.String(), Type.Null()]),
        birth_date: Type.Any(),
        gender: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        streak: Type.Number(),
        longest_streak: Type.Number(),
        workouts_in_month: Type.Number(),
        followers: Type.Number(),
        following: Type.Number(),
        total_workouts: Type.Number(),
      }),
      404: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.get('/', { schema: getProfileSchema }, profileController.getProfile);

  const uploadPhotoSchema = {
    description: 'Faz upload de uma nova foto de perfil (multipart/form-data, campo "photo")',
    tags: ['Profile'],
    security: [{ bearerAuth: [] }],
    response: {
      200: Type.Object({ message: Type.String(), photo_url: Type.String() }),
      400: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.post('/upload', { schema: uploadPhotoSchema }, profileController.uploadPhoto);

  const updateProfileSchema = {
    description: 'Atualiza username e/ou goal do perfil do usuário autenticado',
    tags: ['Profile'],
    security: [{ bearerAuth: [] }],
    body: Type.Object({
      username: Type.Optional(Type.String()),
      goal: Type.Optional(Type.String()),
    }),
    response: {
      200: Type.Object({
        message: Type.String(),
        profile: Type.Object({
          user_id: Type.String(),
          username: Type.String(),
          name: Type.String(),
          fitness_level: Type.Union([Type.String(), Type.Null()]),
          goal: Type.Union([Type.String(), Type.Null()]),
          photo_url: Type.Union([Type.String(), Type.Null()]),
          birth_date: Type.Any(),
          gender: Type.Union([Type.String(), Type.Null()]),
        }),
      }),
      400: Type.Object({ error: Type.String() }),
      409: Type.Object({ error: Type.String() }),
      500: Type.Object({ error: Type.String() }),
    },
  };

  fastify.put('/', { schema: updateProfileSchema }, profileController.updateProfile);
}

module.exports = profileRoutes;
