const { Type } = require('@sinclair/typebox');
const gps = require('../controller/gps.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { errors, IdParams } = require('./workout.schemas');
const S = require('./gps.schemas');

const tags = ['Activities'];
const security = [{ bearerAuth: [] }];
// 30.000 pontos compactos ≈ 1,2 MB de JSON: o padrão do Fastify (1 MiB) não cabe. A Vercel aceita até 4,5 MB.
const BODY_LIMIT = 2 * 1024 * 1024;
// O cálculo é a parte cara: freia rajada. Por IP, como nos convites (o rate-limit roda antes da autenticação).
const computeLimit = { rateLimit: { max: 30, timeWindow: '1 minute' } };

async function gpsRoutes(fastify) {
  await fastify.register(require('@fastify/rate-limit'), { global: false });
  fastify.addHook('preHandler', authenticateToken);

  fastify.post('/preview', {
    bodyLimit: BODY_LIMIT,
    config: computeLimit,
    schema: {
      description: 'Calcula as métricas dos pontos de um .gpx (lido no app) sem gravar nada',
      tags, security, body: S.PreviewBody,
      response: { 200: S.GpsMetrics, ...errors(400, 401, 403, 413, 429) },
    },
  }, gps.preview);

  fastify.post('/', {
    bodyLimit: BODY_LIMIT,
    config: computeLimit,
    schema: {
      description: 'Importa uma corrida ou caminhada numa rotina de GPS. Mesmo início de outra importação → 409 com o activity_id',
      tags, security, body: S.CreateBody,
      response: { 201: S.GpsActivityDetail, 409: S.Conflict, ...errors(400, 401, 403, 404, 413, 429) },
    },
  }, gps.create);

  fastify.get('/:id', {
    schema: { description: 'Detalhe de uma atividade de GPS (só do dono)', tags, security, params: IdParams, response: { 200: S.GpsActivityDetail, ...errors(400, 401, 403, 404) } },
  }, gps.get);

  fastify.patch('/:id', {
    schema: { description: 'Renomeia (a data e as métricas não mudam)', tags, security, params: IdParams, body: S.TitleBody, response: { 200: S.GpsActivityDetail, ...errors(400, 401, 403, 404) } },
  }, gps.rename);

  fastify.delete('/:id', {
    schema: { description: 'Apaga e recalcula o ranking dos grupos', tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, gps.remove);
}

module.exports = gpsRoutes;
