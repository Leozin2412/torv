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

// Código de 6 dígitos = 1M combinações: 5 falhas por e-mail em 15 min, além do limite por IP.
const codeFailures = createAttemptLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

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

    // Sem username o trigger gera um, então só checa quando veio.
    // ponytail: check-then-signup tem race; duas contas com o mesmo username ao mesmo tempo → a 2ª cai no 502 do trigger (unique). Fechar só se virar problema real.
    if (username && await profileRepository.usernameExists(username)) {
      return reply.status(409).send({ error: 'Username already taken', code: 'USERNAME_TAKEN' });
    }

    // Chaves = o que o trigger handle_new_user lê de raw_user_meta_data.
    const metadata = {
      name,
      username,
      birth_date,
      weight: v.measurement.weight_kg,
      height: v.measurement.height_cm,
      gender,
      fitness_level: v.profileData.fitness_level,
      goal: v.profileData.goal,
    };

    try {
      const session = await authProvider.signUp(email, password, metadata);
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
    const key = email.trim().toLowerCase();
    if (codeFailures.isBlocked(key)) return sendAuthError(request, reply, new authProvider.AuthError('RATE_LIMITED'));
    try {
      const session = await authProvider.verifyEmail(email, code);
      codeFailures.reset(key);
      return reply.status(200).send({ session });
    } catch (err) {
      if (err?.code === 'INVALID_CODE') codeFailures.fail(key);
      return sendAuthError(request, reply, err);
    }
  }

  async resendCode(request, reply) {
    try {
      await authProvider.resendSignup(request.body.email);
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
