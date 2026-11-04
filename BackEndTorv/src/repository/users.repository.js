const prisma = require('../lib/prisma');

class UsersRepository {
  // Só o que o perfil de membro mostra: nada de e-mail, corpo, idade ou objetivo.
  getPublicProfile(userId) {
    return prisma.user_profiles.findUnique({
      where: { user_id: userId },
      select: { user_id: true, name: true, username: true, photo_url: true, fitness_level: true },
    });
  }

  // true se os dois são membros de pelo menos um grupo em comum agora.
  async sharesGroup(viewerId, targetId) {
    const row = await prisma.group_members.findFirst({
      where: { user_id: targetId, group: { group_members: { some: { user_id: viewerId } } } },
      select: { group_id: true },
    });
    return row !== null;
  }
}

module.exports = new UsersRepository();
