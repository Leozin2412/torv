const repo = require('../repository/groupInvitations.repository');
const images = require('../lib/imageUpload');
const { generateInviteToken, normalizeToken, isValidToken, isEnded, dateOnly } = require('../lib/groupRules');
const { fail, NOT_FOUND } = require('./groups.controller');

const profileOf = (request, userId, p) => ({
  user_id: userId,
  name: p?.name ?? '',
  username: p?.username ?? '',
  photo_url: images.publicUrl(request, p?.photo_url),
});

async function invite(request, reply) {
  const username = request.body.username.trim();
  if (!username) return reply.status(400).send({ error: 'username must not be blank' });
  const out = await repo.inviteByUsername(request.user.userId, request.params.id, username);
  return out.code ? fail(reply, out.code) : reply.status(201).send({ id: out.id });
}

async function requestJoin(request, reply) {
  const out = await repo.createRequest(request.user.userId, request.params.id);
  return out.code ? fail(reply, out.code) : reply.status(201).send({ id: out.id });
}

async function listPending(request, reply) {
  const rows = await repo.listPending(request.user.userId, request.params.id);
  if (!rows) return reply.status(404).send(NOT_FOUND);
  const item = (r) => ({ id: r.id, ...profileOf(request, r.user.id, r.user.user_profiles), created_at: r.created_at.toISOString() });
  return reply.send({
    requests: rows.filter((r) => r.kind === 'REQUEST').map(item),
    invites: rows.filter((r) => r.kind === 'INVITE').map(item),
  });
}

async function listReceived(request, reply) {
  const rows = await repo.listReceived(request.user.userId);
  return reply.send({
    invitations: rows.map((r) => ({
      id: r.id,
      group: { id: r.group.id, name: r.group.name, cover_url: images.publicUrl(request, r.group.cover_url) },
      invited_by: { name: r.creator.user_profiles?.name ?? '', username: r.creator.user_profiles?.username ?? '' },
      created_at: r.created_at.toISOString(),
    })),
  });
}

const resolver = (action) => async (request, reply) => {
  const out = await repo.resolve(request.user.userId, request.params.id, action);
  return out.code ? fail(reply, out.code) : reply.send(out);
};

async function cancel(request, reply) {
  return (await repo.cancel(request.user.userId, request.params.id))
    ? reply.status(204).send()
    : reply.status(404).send(NOT_FOUND);
}

// Colisão do token (UNIQUE) é improvável (31^8); repete algumas vezes antes de desistir.
async function createInviteLink(request, reply) {
  for (let i = 0; i < 5; i += 1) {
    const token = generateInviteToken();
    try {
      if (!(await repo.setInviteToken(request.user.userId, request.params.id, token))) {
        return reply.status(404).send(NOT_FOUND);
      }
      return reply.send({ token });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
  throw new Error('could not generate a unique invite token');
}

async function revokeInviteLink(request, reply) {
  return (await repo.setInviteToken(request.user.userId, request.params.id, null))
    ? reply.status(204).send()
    : reply.status(404).send(NOT_FOUND);
}

// Código inválido (formato) responde 404 sem consultar o banco: não ajuda a adivinhar.
async function joinPreview(request, reply) {
  const token = normalizeToken(request.params.token);
  if (!isValidToken(token)) return reply.status(404).send(NOT_FOUND);
  const found = await repo.getJoinPreview(request.user.userId, token);
  if (!found) return reply.status(404).send(NOT_FOUND);
  const { group } = found;
  return reply.send({
    group: {
      id: group.id,
      name: group.name,
      cover_url: images.publicUrl(request, group.cover_url),
      starts_at: dateOnly(group.starts_at),
      ends_at: dateOnly(group.ends_at),
      tz_offset_min: group.tz_offset_min,
      member_count: found.member_count,
    },
    is_member: found.is_member,
    ended: isEnded(group),
  });
}

async function join(request, reply) {
  const token = normalizeToken(request.params.token);
  if (!isValidToken(token)) return reply.status(404).send(NOT_FOUND);
  const out = await repo.joinByToken(request.user.userId, token);
  return out.code ? fail(reply, out.code) : reply.send({ group_id: out.group_id });
}

module.exports = {
  invite, requestJoin, listPending, listReceived, accept: resolver('accept'), decline: resolver('decline'),
  cancel, createInviteLink, revokeInviteLink, joinPreview, join,
};
