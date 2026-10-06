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

  // Dias locais distintos (YYYY-MM-DD, mais recente primeiro) com treino STRENGTH antes de `before` (UTC). Local = UTC + tzOffsetMin.
  // ponytail: LIMIT 1000 dias → streak maior que isso trunca; subir se algum dia importar.
  async strengthDays(userId, { before, tzOffsetMin }) {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT to_char((start_time AT TIME ZONE 'UTC') + make_interval(mins => ${tzOffsetMin}::int), 'YYYY-MM-DD') AS day
      FROM activities
      WHERE user_id = ${userId}::uuid AND activity_type = 'STRENGTH' AND start_time < ${before}::timestamptz
      ORDER BY day DESC LIMIT 1000`;
    return rows.map((r) => r.day);
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
