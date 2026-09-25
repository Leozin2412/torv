const prisma = require('../lib/prisma');

class ProfileRepository {
  async getUserProfile(userId) {
    return await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_profiles: true,
        user_streaks: true,
        user_measurements: { orderBy: { recorded_at: 'desc' }, take: 1 },
      },
    });
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
