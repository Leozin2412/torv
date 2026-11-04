const gpsRepository = require('../repository/gps.repository');
const profileRepository = require('../repository/profile.repository');
const { computeMetrics } = require('../lib/gpsMetrics');
const { checkPoints, checkWindow, checkPlausible } = require('../lib/gpsValidation');

const NOT_FOUND = { error: 'Not found' };
const DUPLICATE = 'Activity already imported';

// Pontos → métricas, com todas as regras que não dependem do banco. { error } ou { metrics, startTime }.
async function analyze(userId, body) {
  const startTime = new Date(body.start_time);
  // O date-time do schema aceita formas que o Date do JS não parseia (fuso só com hora, segundo bissexto).
  if (Number.isNaN(startTime.getTime())) return { error: 'body/start_time must match format "date-time"' };
  const checked = checkPoints(body.points);
  if (checked.error) return { error: checked.error };
  const elapsedSec = checked.points[checked.points.length - 1][0];
  const windowError = checkWindow(startTime.getTime(), elapsedSec);
  if (windowError) return { error: windowError };
  const measurement = await profileRepository.getLatestMeasurement(userId);
  const weightKg = measurement?.weight_kg == null ? null : Number(measurement.weight_kg);
  const metrics = computeMetrics(checked.points, { type: body.activity_type, weightKg });
  const implausible = checkPlausible(metrics);
  return implausible ? { error: implausible } : { metrics, startTime };
}

// Linha do banco → detalhe da API (mesmo formato da resposta da criação).
function detailFromRow(a) {
  const g = a.activity_gps_data;
  const distance = Number(a.distance_m);
  return {
    id: a.id,
    activity_type: a.activity_type,
    title: a.title ?? '',
    start_time: a.start_time.toISOString(),
    routine_id: a.routine_id,
    distance_m: distance,
    duration_sec: a.duration_sec,
    elapsed_sec: g.elapsed_sec,
    pace_sec_per_km: distance > 0 ? Math.round(a.duration_sec / (distance / 1000)) : null,
    elevation_gain_m: g.elevation_gain_m == null ? null : Number(g.elevation_gain_m),
    avg_hr: g.avg_hr,
    max_hr: g.max_hr,
    avg_cadence: g.avg_cadence,
    calories: a.calories,
    splits: g.splits,
    route: g.route,
  };
}

class GpsController {
  async preview(request, reply) {
    const { error, metrics, startTime } = await analyze(request.user.userId, request.body);
    if (error) return reply.status(400).send({ error });
    return reply.send({ activity_type: request.body.activity_type, start_time: startTime.toISOString(), ...metrics });
  }

  async create(request, reply) {
    const { userId } = request.user;
    const { routine_id: routineId, activity_type: type } = request.body;
    const routine = await gpsRepository.findGpsRoutine(userId, routineId);
    if (!routine) return reply.status(404).send(NOT_FOUND);
    const { error, metrics, startTime } = await analyze(userId, request.body);
    if (error) return reply.status(400).send({ error });
    const existing = await gpsRepository.findByStart(userId, startTime);
    if (existing) return reply.status(409).send({ error: DUPLICATE, activity_id: existing });
    const title = request.body.title?.trim() || routine.name;
    try {
      const id = await gpsRepository.createGpsActivity(userId, { routineId: routine.id, type, title, startTime, metrics });
      return reply.status(201).send({ id, title, routine_id: routine.id, activity_type: type, start_time: startTime.toISOString(), ...metrics });
    } catch (err) {
      // 400, não 409: o app trata como "não dá para salvar", igual à musculação.
      if (err.code === 'SESSION_DAY_LIMIT') return reply.status(400).send({ error: err.message });
      if (err.code !== 'P2002') throw err;
      // Corrida: outra request com o mesmo start_time gravou entre a checagem e o insert.
      const winner = await gpsRepository.findByStart(userId, startTime);
      return reply.status(409).send({ error: DUPLICATE, activity_id: winner ?? undefined });
    }
  }

  async get(request, reply) {
    const row = await gpsRepository.getGpsActivity(request.user.userId, request.params.id);
    return row ? reply.send(detailFromRow(row)) : reply.status(404).send(NOT_FOUND);
  }

  async rename(request, reply) {
    const { userId } = request.user;
    const { id } = request.params;
    const title = request.body.title.trim();
    if (!title) return reply.status(400).send({ error: 'title must not be blank' });
    if (!await gpsRepository.renameGps(userId, id, title)) return reply.status(404).send(NOT_FOUND);
    return reply.send(detailFromRow(await gpsRepository.getGpsActivity(userId, id)));
  }

  async remove(request, reply) {
    const ok = await gpsRepository.deleteGps(request.user.userId, request.params.id);
    return ok ? reply.status(204).send() : reply.status(404).send(NOT_FOUND);
  }
}

module.exports = new GpsController();
