const authProvider = require('../lib/authProvider');
const profileRepository = require('../repository/profile.repository');
const { validateProfileUpdate } = require('../lib/profileValidation');
const { GENDERS, ageOn } = require('../lib/nutritionCalculator');
const { createAttemptLimiter } = require('../lib/attemptLimiter');

const STATUS = {
  INVALID_CREDENTIALS: 401, INVALID_REFRESH: 401, EMAIL_TAKEN: 409, INVALID_INPUT: 400, PROVIDER: 502,
  EMAIL_NOT_CONFIRMED: 403, INVALID_CODE: 400, RATE_LIMITED: 429,
};
// Códigos que o cliente precisa distinguir pelo corpo (mesmo status, ações diferentes).
const WITH_CODE = new Set(['EMAIL_TAKEN', 'EMAIL_NOT_CONFIRMED', 'INVALID_CODE', 'RATE_LIMITED']);

// Código de 6 dígitos = 1M combinações: 5 tentativas por e-mail em 15 min, além do limite por IP.
// ponytail: contadores em memória, por instância. Em serverless (várias instâncias) pedem contador no Postgres (upsert atômico); o backstop de hoje é o rate limit do GoTrue + expiração do código.
const codeFailures = createAttemptLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
// Cooldown de reenvio por e-mail, independente de a conta existir (o GoTrue só limita contas reais, e isso vazaria a existência).
const resendCooldown = createAttemptLimiter({ max: 1, windowMs: 60 * 1000 });
const emailKey = (email) => email.trim().toLowerCase();

// Nunca loga body (senha) nem tokens: só o código do erro tipado.
function sendAuthError(request, reply, err) {
  if (!(err instanceof authProvider.AuthError)) throw err;
  if (err.code === 'PROVIDER') request.log.warn({ code: err.code }, 'auth provider failure');
  const body = WITH_CODE.has(err.code) ? { error: err.message, code: err.code } : { error: err.message };
  return reply.status(STATUS[err.code]).send(body);
}

class AuthController {
  async register(request, reply) {
    const { email, password, name, username, birth_date, weight_kg, height_cm, gender, fitness_level, goal } = request.body;

    const v = validateProfileUpdate({ goal, fitness_level, weight_kg, height_cm });
    if (v.error) return reply.status(400).send({ error: v.error });
    if (!Object.hasOwn(GENDERS, gender)) return reply.status(400).send({ error: 'gender must be Masculino or Feminino' });
    const age = ageOn(birth_date, new Date());
    if (!(age >= 10 && age <= 120)) return reply.status(400).send({ error: 'birth_date must give an age between 10 and 120' });

    // Pre-check evita criar conta à toa; a corrida entre dois cadastros cai no P2002 do saveSignupProfile (409 + conta desfeita).
    if (username && await profileRepository.usernameExists(username)) {
      return reply.status(409).send({ error: 'Username already taken', code: 'USERNAME_TAKEN' });
    }

    try {
      const { session, userId, swallowed } = await authProvider.signUp(email, password);
      if (swallowed) request.log.warn({ error_code: swallowed }, 'register swallowed provider error');
      // Sem userId (reenvio engolido): a conta já existe e o perfil foi gravado no 1º cadastro.
      if (userId) {
        try {
          await profileRepository.saveSignupProfile(userId, {
            username: username ?? `user_${userId.slice(0, 8)}`,
            name,
            birth_date: new Date(birth_date),
            gender,
            fitness_level: v.profileData.fitness_level,
            goal: v.profileData.goal,
            weight_kg: v.measurement.weight_kg,
            height_cm: v.measurement.height_cm,
          });
        } catch (err) {
          // Conta sem perfil é inutilizável: desfaz o signup. Log só com código, nunca corpo/e-mail/senha/id.
          await authProvider.deleteUser(userId).catch((e) => request.log.error({ code: e.code }, 'register rollback failed'));
          // Qualquer P2002 aqui é username: as outras chaves únicas são user_id (upsert) e uuid aleatório. O Prisma manda meta.target null, então não dá pra checar o campo.
          if (err.code === 'P2002') {
            return reply.status(409).send({ error: 'Username already taken', code: 'USERNAME_TAKEN' });
          }
          request.log.error({ code: err.code }, 'register profile save failed');
          return sendAuthError(request, reply, new authProvider.AuthError('PROVIDER'));
        }
      }
      return reply.status(201).send({ session, confirmation_required: session === null });
    } catch (err) {
      return sendAuthError(request, reply, err);
    }
  }

  async login(request, reply) {
    try {
      const session = await authProvider.signIn(request.body.email, request.body.password);
      return reply.status(200).send({ session });
    } catch (err) {
      return sendAuthError(request, reply, err);
    }
  }

  async verifyEmail(request, reply) {
    const { email, code } = request.body;
    const key = emailKey(email);
    if (codeFailures.isBlocked(key)) return sendAuthError(request, reply, new authProvider.AuthError('RATE_LIMITED'));
    // Reserva a tentativa antes do await: rajada paralela não passa do teto. Só o sucesso devolve (reset); qualquer erro do provedor consome.
    codeFailures.fail(key);
    try {
      const session = await authProvider.verifyEmail(email, code);
      codeFailures.reset(key);
      return reply.status(200).send({ session });
    } catch (err) {
      return sendAuthError(request, reply, err);
    }
  }

  async resendCode(request, reply) {
    const key = emailKey(request.body.email);
    if (resendCooldown.isBlocked(key)) return sendAuthError(request, reply, new authProvider.AuthError('RATE_LIMITED'));
    resendCooldown.fail(key);
    try {
      const result = await authProvider.resendSignup(request.body.email);
      if (result?.swallowed) request.log.warn({ error_code: result.swallowed }, 'resend swallowed provider error');
      return reply.status(204).send();
    } catch (err) {
      return sendAuthError(request, reply, err);
    }
  }

  async refresh(request, reply) {
    try {
      const session = await authProvider.refresh(request.body.refresh_token);
      return reply.status(200).send({ session });
    } catch (err) {
      return sendAuthError(request, reply, err);
    }
  }

  // Revogação no GoTrue é best-effort: o cliente apaga a sessão local de qualquer jeito.
  async logout(request, reply) {
    const [scheme, token] = (request.headers.authorization || '').split(' ');
    if (scheme === 'Bearer' && token) {
      await authProvider.signOut(token).catch((err) => request.log.warn({ code: err.code }, 'logout revoke failed'));
    }
    return reply.status(204).send();
  }
}

module.exports = new AuthController();
