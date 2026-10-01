const activitiesRepository = require('../repository/activities.repository');

const DEFAULT_LIMIT = 20;

class ActivitiesController {
  async listActivities(request, reply) {
    const { type, before, limit = DEFAULT_LIMIT } = request.query;
    const rows = await activitiesRepository.listActivities(request.user.userId, {
      type,
      before: before ? new Date(before) : undefined,
      limit,
    });
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
