const activitiesRepository = require('../repository/activities.repository');

const DEFAULT_LIMIT = 20;

class ActivitiesController {
  async listActivities(request, reply) {
    const { type, before, limit = DEFAULT_LIMIT } = request.query;
    // O date-time do schema aceita formas que o Date do JS não parseia (fuso só com hora, segundo bissexto).
    const beforeDate = before ? new Date(before) : undefined;
    if (beforeDate && Number.isNaN(beforeDate.getTime())) {
      return reply.status(400).send({ error: 'querystring/before must match format "date-time"' });
    }
    const rows = await activitiesRepository.listActivities(request.user.userId, { type, before: beforeDate, limit });
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
}

module.exports = new ActivitiesController();
