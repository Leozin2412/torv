const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authRepository = require('../repository/auth.repository');

class AuthController {
  async register(request, reply) {
    try {
      const { email, password, name, birth_date, weight, height, gender, fitness_level, goal } = request.body;

      if (!email || !password || !name) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      const existingUser = await authRepository.findUserByEmail(email);
      if (existingUser) {
        return reply.status(409).send({ error: 'User already exists with this email' });
      }

      let parsedBirthDate = null;
      if (birth_date) {
        if (birth_date.includes('/')) {
          const [day, month, year] = birth_date.split('/');
          parsedBirthDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
        } else {
          parsedBirthDate = new Date(birth_date);
        }

        if (isNaN(parsedBirthDate.getTime())) {
          return reply.status(400).send({ error: 'Invalid birth_date format' });
        }
      }

      const password_hash = await bcrypt.hash(password, 10);
      const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

      const user = await authRepository.createUser({
        email, password_hash, username, name,
        birth_date: parsedBirthDate, weight, height, gender, fitness_level, goal,
      });

      reply.status(201).send({ message: 'User registered successfully', userId: user.id });
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error during registration' });
    }
  }

  async login(request, reply) {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({ error: 'Missing email or password' });
      }

      const user = await authRepository.findUserByEmail(email);
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'uma_frase_longa_com_letras_numeros_e_simbolos_bem_aleatorios',
        { expiresIn: '7d' }
      );

      const photoUrl = user.user_profiles?.photo_url
        ? `${request.protocol}://${request.headers.host}/uploads/${user.user_profiles.photo_url}`
        : null;

      reply.status(200).send({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_profiles ? user.user_profiles.name : null,
          username: user.user_profiles ? user.user_profiles.username : null,
          photo_url: photoUrl,
          profile: user.user_profiles,
        },
      });
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error during login' });
    }
  }
}

module.exports = new AuthController();
