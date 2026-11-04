const prisma = require('../lib/prisma');

class ProfileRepository {
  // Queries em paralelo (1 RTT) em vez do include, que o Prisma roda em sequência. Mesmo shape do include.
  // Streak e contagens saíram: o app lê de GET /users/:id/profile (lib/activityStats).
  async getUserProfile(userId) {
    const [user, user_profiles, measurement] = await Promise.all([
      prisma.users.findUnique({ where: { id: userId } }),
      prisma.user_profiles.findUnique({ where: { user_id: userId } }),
      prisma.user_measurements.findFirst({ where: { user_id: userId }, orderBy: { recorded_at: 'desc' } }),
    ]);
    if (!user) return null;
    return { ...user, user_profiles, user_measurements: measurement ? [measurement] : [] };
  }

  // Só a 1ª vez grava: repetir não muda o horário.
  async markWelcomed(userId) {
    await prisma.user_profiles.updateMany({ where: { user_id: userId, welcomed_at: null }, data: { welcomed_at: new Date() } });
  }

  async updatePhotoUrl(userId, photoUrl) {
    return await prisma.user_profiles.update({
      where: { user_id: userId },
      data: { photo_url: photoUrl },
    });
  }

  async updateProfile(userId, data) {
    return await prisma.user_profiles.update({
      where: { user_id: userId },
      data,
    });
  }

  async usernameExists(username) {
    return (await prisma.user_profiles.count({ where: { username } })) > 0;
  }

  async getProfileRow(userId) {
    return await prisma.user_profiles.findUnique({ where: { user_id: userId } });
  }

  async getLatestMeasurement(userId) {
    return await prisma.user_measurements.findFirst({
      where: { user_id: userId },
      orderBy: { recorded_at: 'desc' },
    });
  }

  async addMeasurement(userId, { weight_kg, height_cm }) {
    return await prisma.user_measurements.create({
      data: { user_id: userId, weight_kg, height_cm },
    });
  }
}

module.exports = new ProfileRepository();
