const usersRepository = require('../repository/users.repository');
const activitiesRepository = require('../repository/activities.repository');
const images = require('../lib/imageUpload');
const { buildProfileStats, isCalendarDay, localDayBounds } = require('../lib/activityStats');
const { activityPage } = require('../lib/activityPage');

const NOT_FOUND = { error: 'Not found' };
const DEFAULT_LIMIT = 20;

// O próprio usuário, ou quem divide pelo menos um grupo com ele agora. Negado e inexistente respondem o mesmo 404.
const canView = (viewerId, targetId) => viewerId === targetId || usersRepository.sharesGroup(viewerId, targetId);

// Checagem e leitura vão juntas ao banco (1 ida em vez de 3); nada sai na resposta antes de o acesso ser confirmado.
class UsersController {
  async profile(request, reply) {
    const { userId } = request.user;
    const id = request.params.id.toLowerCase();
    const { date, tz_offset_min: tzOffsetMin } = request.query;
    if (!isCalendarDay(date)) {
      return reply.status(400).send({ error: 'querystring/date must be a valid calendar date' });
    }
    const { before } = localDayBounds(date, tzOffsetMin);
    const [allowed, profile, dayCounts] = await Promise.all([
      canView(userId, id),
      usersRepository.getPublicProfile(id),
      activitiesRepository.dayCounts(id, { before, tzOffsetMin }),
    ]);
    if (!allowed || !profile) return reply.status(404).send(NOT_FOUND);
    return reply.send({
      user: {
        id,
        name: profile.name,
        username: profile.username,
        photo_url: images.publicUrl(profile.photo_url),
        fitness_level: profile.fitness_level,
      },
      is_me: id === userId,
      ...buildProfileStats(dayCounts, date),
    });
  }

  async activities(request, reply) {
    const { userId } = request.user;
    const id = request.params.id.toLowerCase();
    const { before, limit = DEFAULT_LIMIT } = request.query;
    const beforeDate = before ? new Date(before) : undefined;
    if (beforeDate && Number.isNaN(beforeDate.getTime())) {
      return reply.status(400).send({ error: 'querystring/before must match format "date-time"' });
    }
    const [allowed, rows] = await Promise.all([
      canView(userId, id),
      activitiesRepository.listActivities(id, { before: beforeDate, limit }),
    ]);
    if (!allowed) return reply.status(404).send(NOT_FOUND);
    return reply.send(activityPage(rows, limit));
  }
}

module.exports = new UsersController();
