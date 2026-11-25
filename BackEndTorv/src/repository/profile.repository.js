const prisma = require('../lib/prisma');
const { encryptField, decryptField } = require('../lib/fieldCrypto');

const ctx = (column, userId) => ({ table: 'user_measurements', column, userId });
// Linha cifrada → números; o AAD amarra ao dono (userId do where).
const decryptMeasurement = (m, userId) => m && {
  ...m,
  weight_kg: decryptField(m.weight_kg, ctx('weight_kg', userId)),
  height_cm: decryptField(m.height_cm, ctx('height_cm', userId)),
};

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
    return { ...user, user_profiles, user_measurements: measurement ? [decryptMeasurement(measurement, userId)] : [] };
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

  async profileExists(userId) {
    return (await prisma.user_profiles.findUnique({ where: { user_id: userId }, select: { user_id: true } })) !== null;
  }

  async getProfileRow(userId) {
    return await prisma.user_profiles.findUnique({ where: { user_id: userId } });
  }

  async getLatestMeasurement(userId) {
    return decryptMeasurement(await prisma.user_measurements.findFirst({
      where: { user_id: userId },
      orderBy: { recorded_at: 'desc' },
    }), userId);
  }

  // Cadastro: o trigger só cria users; perfil, medida cifrada e streak vêm daqui, atômicos.
  // Reenvio de signup (conta não confirmada) atualiza o perfil e troca a medida em vez de duplicar.
  async saveSignupProfile(userId, { weight_kg, height_cm, ...profile }) {
    await prisma.$transaction(async (tx) => {
      await tx.user_profiles.upsert({ where: { user_id: userId }, create: { user_id: userId, ...profile }, update: profile });
      await tx.user_measurements.deleteMany({ where: { user_id: userId } });
      await tx.user_measurements.create({
        data: { user_id: userId, weight_kg: encryptField(weight_kg, ctx('weight_kg', userId)), height_cm: encryptField(height_cm, ctx('height_cm', userId)) },
      });
      await tx.user_streaks.upsert({ where: { user_id: userId }, create: { user_id: userId, current_streak: 0, longest_streak: 0 }, update: {} });
    });
  }

  async addMeasurement(userId, { weight_kg, height_cm }) {
    return await prisma.user_measurements.create({
      data: { user_id: userId, weight_kg: encryptField(weight_kg, ctx('weight_kg', userId)), height_cm: encryptField(height_cm, ctx('height_cm', userId)) },
    });
  }
}

module.exports = new ProfileRepository();
