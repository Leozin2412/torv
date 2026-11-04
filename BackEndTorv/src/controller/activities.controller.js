const activitiesRepository = require('../repository/activities.repository');
const { currentStreak, isCalendarDay, localDayBounds } = require('../lib/activityStats');
const { activityPage } = require('../lib/activityPage');

const DEFAULT_LIMIT = 20;

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
    return reply.send(activityPage(rows, limit));
  }

  async getSummary(request, reply) {
    const { date, tz_offset_min: tzOffsetMin } = request.query;
    if (!isCalendarDay(date)) {
      return reply.status(400).send({ error: 'querystring/date must be a valid calendar date' });
    }
    const { from, before } = localDayBounds(date, tzOffsetMin);
    const userId = request.user.userId;
    const [dayCounts, caloriesBurned] = await Promise.all([
      activitiesRepository.dayCounts(userId, { before, tzOffsetMin }),
      activitiesRepository.caloriesBetween(userId, { from, before }),
    ]);
    return reply.send({ streak_days: currentStreak(dayCounts.map((r) => r.day), date), calories_burned: caloriesBurned });
  }
}

module.exports = new ActivitiesController();
