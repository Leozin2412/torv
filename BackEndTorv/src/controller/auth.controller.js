const authProvider = require('../lib/authProvider');
const profileRepository = require('../repository/profile.repository');
const { validateProfileUpdate } = require('../lib/profileValidation');
const { GENDERS, ageOn } = require('../lib/nutritionCalculator');

const STATUS = { INVALID_CREDENTIALS: 401, INVALID_REFRESH: 401, EMAIL_TAKEN: 409, INVALID_INPUT: 400, PROVIDER: 502 };

// Nunca loga body (senha) nem tokens: só o código do erro tipado.
function sendAuthError(request, reply, err) {
  if (!(err instanceof authProvider.AuthError)) throw err;
  if (err.code === 'PROVIDER') request.log.warn({ code: err.code }, 'auth provider failure');
  const body = err.code === 'EMAIL_TAKEN' ? { error: err.message, code: err.code } : { error: err.message };
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
