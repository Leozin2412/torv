const { Type } = require('@sinclair/typebox');
const authController = require('../controller/auth.controller');

const Session = Type.Object({
  access_token: Type.String(),
  refresh_token: Type.String(),
  expires_at: Type.Number({ description: 'unix seconds' }),
  user: Type.Object({ id: Type.String(), email: Type.String() }),
});
const ErrorBody = Type.Object({ error: Type.String() });
const ConflictBody = Type.Object({ error: Type.String(), code: Type.Union([Type.Literal('EMAIL_TAKEN'), Type.Literal('USERNAME_TAKEN')]) });
const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));

// Limite por IP do cliente: o GoTrue só vê o IP do backend, então o controle é nosso.
const perMinute = (max) => ({ rateLimit: { max, timeWindow: '1 minute' } });

async function authRoutes(fastify) {
  // Registrado dentro deste plugin → só vale pras rotas /auth/*. Default 30/min (refresh, logout).
  await fastify.register(require('@fastify/rate-limit'), { max: 30, timeWindow: '1 minute' });

  fastify.post('/register', {
    config: perMinute(10),
    schema: {
      description: 'Cria conta no provedor de auth; o trigger handle_new_user cria users/perfil/medida/streak',
      tags: ['Auth'],
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String({ minLength: 6 }),
        name: Type.String({ minLength: 1 }),
        username: Type.Optional(Type.String({ minLength: 1 })),
        birth_date: Type.String({ format: 'date', description: 'YYYY-MM-DD' }),
        weight_kg: Type.Number(),
        height_cm: Type.Number(),
        gender: Type.String({ description: 'Masculino | Feminino' }),
        fitness_level: Type.String({ description: 'INICIANTE | INTERMEDIÁRIO | AVANÇADO' }),
        goal: Type.String({ description: 'Objetivos separados por vírgula' }),
      }),
      response: {
        201: Type.Object({ session: Type.Union([Session, Type.Null()]), confirmation_required: Type.Boolean() }),
        409: ConflictBody,
        ...errors(400, 429, 502),
      },
    },
  }, authController.register);

  fastify.post('/login', {
    config: perMinute(10),
    schema: {
      description: 'Login com e-mail e senha. 401 genérico, não distingue usuário inexistente de senha errada',
      tags: ['Auth'],
      body: Type.Object({ email: Type.String({ minLength: 1 }), password: Type.String({ minLength: 1 }) }),
      response: { 200: Type.Object({ session: Session }), ...errors(400, 401, 429, 502) },
    },
  }, authController.login);

  fastify.post('/refresh', {
    schema: {
      description: 'Troca o refresh token por uma sessão nova',
      tags: ['Auth'],
      body: Type.Object({ refresh_token: Type.String({ minLength: 1 }) }),
      response: { 200: Type.Object({ session: Session }), ...errors(400, 401, 429, 502) },
    },
  }, authController.refresh);

  fastify.post('/logout', {
    schema: {
      description: 'Revoga a sessão no provedor (best-effort). Sempre 204',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      response: { 204: Type.Null(), ...errors(429) },
    },
  }, authController.logout);
}

module.exports = authRoutes;
