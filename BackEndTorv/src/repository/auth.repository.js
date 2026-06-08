const prisma = require('../lib/prisma');

class AuthRepository {
  async createUser(data) {
    return await prisma.users.create({
      data: {
        email: data.email,
        password_hash: data.password_hash,
        auth_provider: 'email',
        user_profiles: {
          create: {
            username: data.username,
            name: data.name,
            fitness_level: data.fitness_level,
            goal: data.goal,
            birth_date: data.birth_date || null,
            gender: data.gender,
          },
        },
        user_measurements: {
          create: {
            weight_kg: data.weight,
            height_cm: data.height,
          },
        },
        user_streaks: {
          create: {
            current_streak: 0,
            longest_streak: 0,
          },
        },
      },
      include: {
        user_profiles: true,
      },
    });
  }

  async findUserByEmail(email) {
    return await prisma.users.findUnique({
      where: { email },
      include: {
        user_profiles: true,
      },
    });
  }
}

module.exports = new AuthRepository();
