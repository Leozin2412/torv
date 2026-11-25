const prisma = require('../lib/prisma');
const { encryptField, decryptField } = require('../lib/fieldCrypto');
const groupsRepository = require('./groups.repository');
const { serializePerUser, lockAndCheckDailyCap } = require('./activityWrites');

const TX = { timeout: 15000 };
const GPS = { activity_type: { in: ['RUN', 'WALK'] } };
const DETAIL_SELECT = {
  id: true, activity_type: true, title: true, start_time: true, routine_id: true,
  distance_m: true, duration_sec: true, calories: true,
  activity_gps_data: {
    select: { elapsed_sec: true, elevation_gain_m: true, avg_hr: true, max_hr: true, avg_cadence: true, splits: true, route: true },
  },
};

const ctx = (column, userId) => ({ table: 'activity_gps_data', column, userId });
const GPS_ENCRYPTED = ['avg_hr', 'max_hr', 'splits', 'route'];
const mapGps = (g, fn) => Object.fromEntries(GPS_ENCRYPTED.map((c) => [c, fn(g[c], c)]));

class GpsRepository {
  // Rotina de corrida ou caminhada do usuário; null = não existe, é de outro usuário ou é de musculação.
  findGpsRoutine(userId, routineId) {
    return prisma.workout_routines.findFirst({
      where: { id: routineId, user_id: userId, ...GPS },
      select: { id: true, name: true, activity_type: true },
    });
  }

  // Deduplicação: a atividade de GPS do usuário que começa exatamente nesse instante (índice único parcial no banco).
  async findByStart(userId, startTime) {
    const row = await prisma.activities.findFirst({
      where: { user_id: userId, start_time: startTime, activity_type: { not: 'STRENGTH' } },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  // Mesma fila, lock e teto da musculação. Atividade, métricas e ranking na MESMA transação: ou grava tudo, ou nada.
  async createGpsActivity(userId, { routineId, type, title, startTime, metrics }) {
    return serializePerUser(userId, () => prisma.$transaction(async (tx) => {
      await lockAndCheckDailyCap(tx, userId, startTime);
      const activity = await tx.activities.create({
        data: {
          user_id: userId,
          activity_type: type,
          title,
          start_time: startTime,
          routine_id: routineId,
          duration_sec: metrics.duration_sec, // em movimento
          distance_m: metrics.distance_m,
          calories: metrics.calories,
        },
        select: { id: true },
      });
      await tx.activity_gps_data.create({
        data: {
          activity_id: activity.id,
          elapsed_sec: metrics.elapsed_sec,
          elevation_gain_m: metrics.elevation_gain_m,
          ...mapGps(metrics, (v, c) => encryptField(v, ctx(c, userId))),
          avg_cadence: metrics.avg_cadence,
        },
      });
      await groupsRepository.recomputeRanking(tx, userId);
      return activity.id;
    }, TX));
  }

  async getGpsActivity(userId, id) {
    const a = await prisma.activities.findFirst({ where: { id, user_id: userId, ...GPS }, select: DETAIL_SELECT });
    if (!a?.activity_gps_data) return a;
    return { ...a, activity_gps_data: { ...a.activity_gps_data, ...mapGps(a.activity_gps_data, (v, c) => decryptField(v, ctx(c, userId))) } };
  }

  // Renomear não muda a data: o ranking não muda.
  async renameGps(userId, id, title) {
    const { count } = await prisma.activities.updateMany({ where: { id, user_id: userId, ...GPS }, data: { title } });
    return count > 0;
  }

  // Apagar muda o ranking: recalcula na mesma transação. activity_gps_data sai junto (cascade).
  async deleteGps(userId, id) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.activities.deleteMany({ where: { id, user_id: userId, ...GPS } });
      if (count) await groupsRepository.recomputeRanking(tx, userId);
      return count > 0;
    }, TX);
  }
}

module.exports = new GpsRepository();
