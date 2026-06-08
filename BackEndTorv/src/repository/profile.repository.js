const prisma = require('../lib/prisma');

class ProfileRepository {
  async getUserProfile(userId) {
    return await prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_profiles: true,
        user_streaks: true,
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
}

module.exports = new ProfileRepository();
