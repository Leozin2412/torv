const { Type } = require('@sinclair/typebox');
const groups = require('../controller/groups.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { errors, IdParams } = require('./workout.schemas');
const S = require('./groups.schemas');

const tags = ['Groups'];
const security = [{ bearerAuth: [] }];

async function groupsRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.post('/', {
    schema: { description: 'Cria um grupo; o criador é o dono e o primeiro membro', tags, security, body: S.GroupBody, response: { 201: S.GroupDetail, ...errors(400, 401, 403) } },
  }, groups.create);

  fastify.get('/', {
    schema: { description: 'Meus grupos, com minha posição e pontos', tags, security, response: { 200: Type.Object({ groups: Type.Array(S.GroupListItem) }), ...errors(401, 403) } },
  }, groups.list);

  fastify.get('/discover', {
    schema: { description: 'Busca grupos públicos ainda não encerrados dos quais não sou membro', tags, security, querystring: S.DiscoverQuery, response: { 200: S.DiscoverResponse, ...errors(400, 401, 403) } },
  }, groups.discover);

  fastify.get('/:id', {
    schema: { description: 'Detalhe do grupo. Privado e não membro → 404', tags, security, params: IdParams, response: { 200: S.GroupDetail, ...errors(400, 401, 403, 404) } },
  }, groups.get);

  fastify.patch('/:id', {
    schema: { description: 'Dono: nome, visibilidade e período. Mudar o período recalcula o ranking', tags, security, params: IdParams, body: S.GroupPatchBody, response: { 200: S.GroupDetail, ...errors(400, 401, 403, 404) } },
  }, groups.update);

  fastify.delete('/:id', {
    schema: { description: 'Dono: apaga o grupo e a capa', tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, groups.remove);

  fastify.post('/:id/cover', {
    schema: {
      description: 'Dono: envia a capa (multipart/form-data, campo "photo", até 5 MB)',
      tags, security, params: IdParams,
      response: { 200: Type.Object({ cover_url: Type.String() }), ...errors(400, 401, 403, 404, 413) },
    },
  }, groups.uploadCover);

  fastify.get('/:id/ranking', {
    schema: { description: 'Ranking do grupo (só membro)', tags, security, params: IdParams, response: { 200: S.RankingResponse, ...errors(400, 401, 403, 404) } },
  }, groups.ranking);

  fastify.delete('/:id/members/:userId', {
    schema: { description: 'O dono remove um membro, ou o próprio usuário sai. O dono não sai', tags, security, params: S.MemberParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404, 409) } },
  }, groups.removeMember);
}

module.exports = groupsRoutes;
