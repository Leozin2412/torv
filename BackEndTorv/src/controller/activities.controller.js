const activitiesRepository = require('../repository/activities.repository');

const DEFAULT_LIMIT = 20;
const DAY_MS = 86400000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// days: dias locais com treino, mais recente primeiro. Viva se treinou em `date` ou ontem; conta dias consecutivos para trás.
function streakFrom(days, dateMs) {
  let expected = days[0] === isoDay(dateMs) ? dateMs : dateMs - DAY_MS;
  let streak = 0;
  for (const day of days) {
    if (day !== isoDay(expected)) break;
    streak += 1;
    expected -= DAY_MS;
  }
  return streak;
}

class ActivitiesController {
  async listActivities(request, reply) {
    const { type, from, before, limit = DEFAULT_LIMIT } = request.query;
    const fromDate = from ? new Date(from) : undefined;
    const beforeDate = before ? new Date(before) : undefined;
    // O date-time do schema aceita formas que o Date do JS não parseia (fuso só com hora, segundo bissexto).
    for (const [name, date] of [['from', fromDate], ['before', beforeDate]]) {
      if (date && Number.isNaN(date.getTime())) {
        return reply.status(400).send({ error: `querystring/${name} must match format "date-time"` });
      }
    }
    const rows = await activitiesRepository.listActivities(request.user.userId, { type, from: fromDate, before: beforeDate, limit });
    return reply.send({
      activities: rows.map((a) => ({
        id: a.id,
        activity_type: a.activity_type,
        title: a.title ?? '',
        start_time: a.start_time.toISOString(),
        duration_sec: a.duration_sec ?? 0,
        set_count: a._count.workout_sets,
      })),
      // Página cheia: pode haver mais. O cliente manda isto como `before` na próxima chamada.
      next_before: rows.length === limit ? rows[rows.length - 1].start_time.toISOString() : null,
    });
  }

  async getSummary(request, reply) {
    const { date, tz_offset_min: tzOffsetMin } = request.query;
    const dateMs = Date.parse(`${date}T00:00:00Z`);
    // pattern aceita 2026-02-31; Date normaliza, então a ida e volta denuncia.
    if (Number.isNaN(dateMs) || isoDay(dateMs) !== date) {
      return reply.status(400).send({ error: 'querystring/date must be a valid calendar date' });
    }
    const from = new Date(dateMs - tzOffsetMin * 60000); // meia-noite local em UTC
    const before = new Date(from.getTime() + DAY_MS);
    const userId = request.user.userId;
    const [days, caloriesBurned] = await Promise.all([
      activitiesRepository.strengthDays(userId, { before, tzOffsetMin }),
      activitiesRepository.caloriesBetween(userId, { from, before }),
    ]);
    return reply.send({ streak_days: streakFrom(days, dateMs), calories_burned: caloriesBurned });
  }
}

module.exports = new ActivitiesController();
