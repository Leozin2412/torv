const { Type } = require('@sinclair/typebox');
const c = require('../controller/groupInvitations.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { errors, IdParams } = require('./workout.schemas');
const S = require('./groups.schemas');

const tags = ['Groups'];
const security = [{ bearerAuth: [] }];
const joinLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };
// Convite por username diferencia usuário existente de inexistente (201/409 vs 404): o limite freia a varredura de usernames.
const inviteLimit = { rateLimit: { max: 30, timeWindow: '1 minute' } };

async function groupInvitationsRoutes(fastify) {
  await fastify.register(require('@fastify/rate-limit'), { global: false });
  fastify.addHook('preHandler', authenticateToken);

  fastify.post('/:id/invitations', {
    config: inviteLimit,
    schema: { description: 'Dono convida por username exato', tags, security, params: IdParams, body: S.InviteBody, response: { 201: S.IdResponse, ...errors(400, 401, 403, 404, 409, 429) } },
  }, c.invite);

  fastify.post('/:id/requests', {
    schema: { description: 'Pede para entrar num grupo público', tags, security, params: IdParams, response: { 201: S.IdResponse, ...errors(400, 401, 403, 404, 409) } },
  }, c.requestJoin);

  fastify.get('/:id/requests', {
    schema: { description: 'Dono: pedidos de entrada e convites pendentes', tags, security, params: IdParams, response: { 200: S.PendingResponse, ...errors(400, 401, 403, 404) } },
  }, c.listPending);

  fastify.get('/invitations/received', {
    schema: { description: 'Convites de grupo que recebi e ainda estão pendentes', tags, security, response: { 200: S.ReceivedResponse, ...errors(401, 403) } },
  }, c.listReceived);

  fastify.post('/invitations/:id/accept', {
    schema: { description: 'O convidado aceita um convite, ou o dono aceita um pedido', tags, security, params: IdParams, response: { 200: S.ResolveResponse, ...errors(400, 401, 403, 404, 409) } },
  }, c.accept);

  fastify.post('/invitations/:id/decline', {
    schema: { description: 'O convidado recusa um convite, ou o dono recusa um pedido', tags, security, params: IdParams, response: { 200: S.ResolveResponse, ...errors(400, 401, 403, 404, 409) } },
  }, c.decline);

  fastify.delete('/invitations/:id', {
    schema: { description: 'Cancela o convite ou pedido que eu criei e ainda está pendente', tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, c.cancel);

  fastify.post('/:id/invite-link', {
    schema: { description: 'Dono: gera (ou regenera, invalidando o anterior) o código de convite', tags, security, params: IdParams, response: { 200: Type.Object({ token: Type.String() }), ...errors(400, 401, 403, 404) } },
  }, c.createInviteLink);

  fastify.delete('/:id/invite-link', {
    schema: { description: 'Dono: revoga o link de convite', tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, c.revokeInviteLink);

  fastify.get('/join/:token', {
    config: joinLimit,
    schema: { description: 'Prévia do grupo a partir do código de convite', tags, security, params: S.TokenParams, response: { 200: S.JoinPreview, ...errors(400, 401, 403, 404, 429) } },
  }, c.joinPreview);

  fastify.post('/join/:token', {
    config: joinLimit,
    schema: { description: 'Entra no grupo pelo código de convite', tags, security, params: S.TokenParams, response: { 200: Type.Object({ group_id: Type.String() }), ...errors(400, 401, 403, 404, 409, 429) } },
  }, c.join);
}

module.exports = groupInvitationsRoutes;
