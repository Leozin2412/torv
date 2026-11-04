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
        id: true, activity_type: true, title: true, start_time: true, duration_sec: true, distance_m: true,
        _count: { select: { workout_sets: true } },
      },
    });
  }

  // [{ day: 'YYYY-MM-DD', count }] dos dias LOCAIS (UTC + tzOffsetMin) com atividade de QUALQUER tipo antes de `before`
  // (UTC), em ordem crescente. Sem LIMIT: no máximo uma linha por dia de uso (~365 por ano).
  async dayCounts(userId, { before, tzOffsetMin }) {
    return prisma.$queryRaw`
      SELECT to_char((start_time AT TIME ZONE 'UTC') + make_interval(mins => ${tzOffsetMin}::int), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM activities
      WHERE user_id = ${userId}::uuid AND start_time IS NOT NULL AND start_time < ${before}::timestamptz
      GROUP BY 1 ORDER BY 1`;
  }

  // Soma de calories (null conta 0) de qualquer tipo em [from, before).
  async caloriesBetween(userId, { from, before }) {
    const { _sum } = await prisma.activities.aggregate({
      _sum: { calories: true },
      where: { user_id: userId, start_time: { gte: from, lt: before } },
    });
    return _sum.calories ?? 0;
  }
}

module.exports = new ActivitiesRepository();
