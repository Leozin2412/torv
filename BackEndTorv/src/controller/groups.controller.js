const { randomInt } = require('node:crypto');
const groupsRepository = require('../repository/groups.repository');
const images = require('../lib/imageUpload');
const { dateOnly, toDbDate, checkGroupDates, FAILURES } = require('../lib/groupRules');

const NOT_FOUND = { error: 'Not found' };
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const PAGE = 20;

const fail = (reply, code) => {
  const [status, error] = FAILURES[code];
  return reply.status(status).send({ error });
};

const periodOf = (g) => ({ starts_at: dateOnly(g.starts_at), ends_at: dateOnly(g.ends_at), tz_offset_min: g.tz_offset_min });

function detail(request, { group, member_count, is_member, my_invitation }) {
  const isOwner = group.owner_id === request.user.userId;
  return {
    id: group.id,
    name: group.name,
    visibility: group.visibility,
    cover_url: images.publicUrl(request, group.cover_url),
    ...periodOf(group),
    member_count,
    is_owner: isOwner,
    is_member,
    invite_token: isOwner ? group.invite_token : null,
    my_invitation,
  };
}

async function create(request, reply) {
  const { userId } = request.user;
  const body = request.body;
  const name = body.name.trim();
  if (!name) return reply.status(400).send({ error: 'name must not be blank' });
  const dateError = checkGroupDates(body);
  if (dateError) return reply.status(400).send({ error: dateError });

  const id = await groupsRepository.createGroup(userId, {
    name,
    visibility: body.visibility,
    starts_at: toDbDate(body.starts_at),
    ends_at: body.ends_at ? toDbDate(body.ends_at) : null,
    tz_offset_min: body.tz_offset_min,
  });
  return reply.status(201).send(detail(request, await groupsRepository.getForViewer(userId, id)));
}

async function list(request, reply) {
  const groups = await groupsRepository.listMine(request.user.userId);
  return reply.send({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      visibility: g.visibility,
      cover_url: images.publicUrl(request, g.cover_url),
      ...periodOf(g),
      member_count: g.member_count,
      is_owner: g.owner_id === request.user.userId,
      my_rank: g.my_rank,
      my_points: g.my_points,
    })),
  });
}

async function discover(request, reply) {
  const { q, cursor = 0 } = request.query;
  const { rows, hasMore } = await groupsRepository.discover(request.user.userId, q?.trim() || '', cursor, PAGE);
  return reply.send({
    groups: rows.map((g) => ({
      id: g.id,
      name: g.name,
      cover_url: images.publicUrl(request, g.cover_url),
      ...periodOf(g),
      member_count: g.member_count,
    })),
    next_cursor: hasMore ? cursor + PAGE : null,
  });
}

async function get(request, reply) {
  const found = await groupsRepository.getForViewer(request.user.userId, request.params.id);
  if (!found) return reply.status(404).send(NOT_FOUND);
  return reply.send(detail(request, found));
}

async function update(request, reply) {
  const { userId } = request.user;
  const { id } = request.params;
  const body = request.body;
  const current = await groupsRepository.getOwned(userId, id);
  if (!current) return reply.status(404).send(NOT_FOUND);

  if (body.name !== undefined && !body.name.trim()) return reply.status(400).send({ error: 'name must not be blank' });
  const dateError = checkGroupDates({
    starts_at: body.starts_at ?? dateOnly(current.starts_at),
    ends_at: body.ends_at !== undefined ? body.ends_at : dateOnly(current.ends_at),
  });
  if (dateError) return reply.status(400).send({ error: dateError });

  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.visibility !== undefined) data.visibility = body.visibility;
  if (body.starts_at !== undefined) data.starts_at = toDbDate(body.starts_at);
  if (body.ends_at !== undefined) data.ends_at = body.ends_at === null ? null : toDbDate(body.ends_at);
  // Mudou a janela de contagem → refaz o ranking do grupo todo (até ~100 membros).
  const periodChanged = 'starts_at' in data || 'ends_at' in data;
  if (Object.keys(data).length > 0) await groupsRepository.updateGroup(id, data, { recompute: periodChanged });
  return reply.send(detail(request, await groupsRepository.getForViewer(userId, id)));
}

async function remove(request, reply) {
  const deleted = await groupsRepository.deleteGroup(request.user.userId, request.params.id);
  if (!deleted) return reply.status(404).send(NOT_FOUND);
  await images.deleteImage(deleted.cover_url).catch((err) => request.log.warn(err));
  return reply.status(204).send();
}

async function uploadCover(request, reply) {
  const { userId } = request.user;
  const { id } = request.params;
  if (!(await groupsRepository.getOwned(userId, id))) return reply.status(404).send(NOT_FOUND);

  const image = await images.readImage(request, { maxBytes: COVER_MAX_BYTES });
  if (image.error) return reply.status(image.status).send({ error: image.error });

  // Nome do servidor: o nome do arquivo enviado nunca entra no caminho.
  const fileName = `group-${id}-${Date.now()}-${randomInt(1e9)}${image.ext}`;
  await images.saveImage(fileName, image.buffer);
  const previous = await groupsRepository.setCover(id, fileName);
  await images.deleteImage(previous).catch((err) => request.log.warn(err));
  return reply.send({ cover_url: images.publicUrl(request, fileName) });
}

async function ranking(request, reply) {
  const { userId } = request.user;
  const rows = await groupsRepository.getRanking(userId, request.params.id);
  if (!rows) return reply.status(404).send(NOT_FOUND);
  return reply.send({
    ranking: rows.map((r) => ({
      position: r.position,
      user_id: r.user_id,
      name: r.name,
      username: r.username,
      photo_url: images.publicUrl(request, r.photo_url),
      total_points: r.total_points,
      activities_count: r.activities_count,
      is_me: r.user_id === userId,
    })),
  });
}

async function removeMember(request, reply) {
  const { id, userId: target } = request.params;
  const result = await groupsRepository.removeMember(request.user.userId, id, target);
  return result === 'ok' ? reply.status(204).send() : fail(reply, result);
}

module.exports = { create, list, discover, get, update, remove, uploadCover, ranking, removeMember, fail, NOT_FOUND };
