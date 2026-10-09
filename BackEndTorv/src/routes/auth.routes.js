const { Type } = require('@sinclair/typebox');
const authController = require('../controller/auth.controller');

// E-mail <= 254 (RFC 5321): sem teto, a chave do limiter e o corpo repassado ao provedor viram vetor de memória/banda.
const Email = () => Type.String({ format: 'email', maxLength: 254 });

const Session = Type.Object({
  access_token: Type.String(),
  refresh_token: Type.String(),
  expires_at: Type.Number({ description: 'unix seconds' }),
  user: Type.Object({ id: Type.String(), email: Type.String() }),
});
// code opcional (não Union): Union + coerceTypes do Ajv quebra a serialização.
const ErrorBody = Type.Object({ error: Type.String(), code: Type.Optional(Type.String()) });
const ConflictBody = Type.Object({ error: Type.String(), code: Type.Union([Type.Literal('EMAIL_TAKEN'), Type.Literal('USERNAME_TAKEN')]) });
const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));

// Limite por IP do cliente: o GoTrue só vê o IP do backend, então o controle é nosso.
const perMinute = (max) => ({ rateLimit: { max, timeWindow: '1 minute' } });

async function authRoutes(fastify) {
  // ponytail: chave = request.ip. Atrás de proxy/LB todo mundo vira o IP do proxy; configurar trustProxy no deploy.
  // Registrado dentro deste plugin → só vale pras rotas /auth/*. Default 30/min (refresh, logout).
  await fastify.register(require('@fastify/rate-limit'), { max: 30, timeWindow: '1 minute' });

  fastify.post('/register', {
    config: perMinute(10),
    schema: {
      description: 'Cria conta no provedor de auth; o trigger handle_new_user cria users/perfil/medida/streak',
      tags: ['Auth'],
      body: Type.Object({
        email: Email(),
        password: Type.String({ minLength: 6, maxLength: 128 }),
        name: Type.String({ minLength: 1, maxLength: 100 }),
        username: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
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
      description: 'Login com e-mail e senha. 401 genérico, não distingue usuário inexistente de senha errada. 403 com code EMAIL_NOT_CONFIRMED só depois da senha certa',
      tags: ['Auth'],
      body: Type.Object({ email: Type.String({ minLength: 1, maxLength: 254 }), password: Type.String({ minLength: 1, maxLength: 128 }) }),
      response: { 200: Type.Object({ session: Session }), ...errors(400, 401, 403, 429, 502) },
    },
  }, authController.login);

  fastify.post('/verify-email', {
    config: perMinute(10),
    schema: {
      description: 'Confirma o e-mail com o código de 6 dígitos e devolve a sessão. 400 com code INVALID_CODE (errado ou expirado); 429 após 5 falhas por e-mail em 15 min',
      tags: ['Auth'],
      body: Type.Object({
        email: Email(),
        code: Type.String({ pattern: '^[0-9]{6}$' }),
      }),
      response: { 200: Type.Object({ session: Session }), ...errors(400, 429, 502) },
    },
  }, authController.verifyEmail);

  fastify.post('/resend-code', {
    config: perMinute(5),
    schema: {
      description: 'Reenvia o código de confirmação. 204 uniforme: não revela se o e-mail existe (4xx e 429 do provedor também viram 204). 429 RATE_LIMITED só vem do nosso cooldown de 60 s por e-mail (conta existindo ou não) ou do limite por IP',
      tags: ['Auth'],
      body: Type.Object({ email: Email() }),
      response: { 204: Type.Null(), ...errors(400, 429, 502) },
    },
  }, authController.resendCode);

  fastify.post('/refresh', {
    schema: {
      description: 'Troca o refresh token por uma sessão nova',
      tags: ['Auth'],
      body: Type.Object({ refresh_token: Type.String({ minLength: 1, maxLength: 512 }) }),
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
