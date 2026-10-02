const prisma = require('../lib/prisma');

class ActivitiesRepository {
  // Mais recente primeiro. Sem start_time não dá para pôr no histórico, então fica de fora (gte/lt já excluem NULL).
  // ponytail: cursor só por start_time (único por usuário em STRENGTH); com outro tipo, empate é possível → (start_time, id).
  async listActivities(userId, { type, from, before, limit }) {
    return prisma.activities.findMany({
      where: {
        user_id: userId,
        ...(type && { activity_type: type }),
        start_time: from || before ? { ...(from && { gte: from }), ...(before && { lt: before }) } : { not: null },
      },
      orderBy: { start_time: 'desc' },
      take: limit,
      select: {
        id: true, activity_type: true, title: true, start_time: true, duration_sec: true,
        _count: { select: { workout_sets: true } },
      },
    });
  }
}

module.exports = new ActivitiesRepository();
