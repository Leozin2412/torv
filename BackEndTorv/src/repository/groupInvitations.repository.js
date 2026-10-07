const prisma = require('../lib/prisma');
const groupsRepository = require('./groups.repository');
const { isEnded } = require('../lib/groupRules');

const TX = { timeout: 15000 };
const PROFILE = { select: { name: true, username: true, photo_url: true } };
const isUnique = (err) => err?.code === 'P2002';
const memberKey = (groupId, userId) => ({ group_id_user_id: { group_id: groupId, user_id: userId } });
const PREVIEW_FIELDS = { id: true, name: true, cover_url: true, starts_at: true, ends_at: true, tz_offset_min: true };

class GroupInvitationsRepository {
  async createPending(groupId, userId, kind, createdBy) {
    if (await prisma.group_members.findUnique({ where: memberKey(groupId, userId), select: { user_id: true } })) {
      return { code: 'already_member' };
    }
    try {
      const row = await prisma.group_invitations.create({
        data: { group_id: groupId, user_id: userId, kind, created_by: createdBy },
        select: { id: true },
      });
      return { id: row.id };
    } catch (err) {
      if (isUnique(err)) return { code: 'duplicate' }; // índice único parcial: 1 pendente por (grupo, usuário)
      throw err;
    }
  }

  // Dono convida por username exato (sem diferenciar maiúsculas). Usuário inexistente = grupo inexistente: 404 genérico.
  async inviteByUsername(ownerId, groupId, username) {
    const group = await prisma.groups.findFirst({ where: { id: groupId, owner_id: ownerId }, select: { ends_at: true, tz_offset_min: true } });
    if (!group) return { code: 'not_found' };
    if (isEnded(group)) return { code: 'ended' };
    const target = await prisma.user_profiles.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { user_id: true },
    });
    if (!target) return { code: 'not_found' };
    return this.createPending(groupId, target.user_id, 'INVITE', ownerId);
  }

  // Só grupo PUBLIC aceita pedido; privado responde como se não existisse.
  async createRequest(userId, groupId) {
    const group = await prisma.groups.findUnique({ where: { id: groupId }, select: { visibility: true, ends_at: true, tz_offset_min: true } });
    if (!group || group.visibility !== 'PUBLIC') return { code: 'not_found' };
    if (isEnded(group)) return { code: 'ended' };
    return this.createPending(groupId, userId, 'REQUEST', userId);
  }

  async listPending(ownerId, groupId) {
    if (!(await prisma.groups.findFirst({ where: { id: groupId, owner_id: ownerId }, select: { id: true } }))) return null;
    return prisma.group_invitations.findMany({
      where: { group_id: groupId, status: 'PENDING' },
      orderBy: { created_at: 'desc' },
      select: { id: true, kind: true, created_at: true, user: { select: { id: true, user_profiles: PROFILE } } },
    });
  }

  listReceived(userId) {
    return prisma.group_invitations.findMany({
      where: { user_id: userId, kind: 'INVITE', status: 'PENDING' },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        created_at: true,
        group: { select: { id: true, name: true, cover_url: true } },
        creator: { select: { user_profiles: PROFILE } },
      },
    });
  }

  // Quem decide: o convidado (INVITE) ou o dono do grupo (REQUEST). Qualquer outro: 404.
  async resolve(actorId, id, action) {
    try {
      return await prisma.$transaction(async (tx) => {
        const inv = await tx.group_invitations.findUnique({
          where: { id },
          select: { group_id: true, user_id: true, kind: true, status: true, group: { select: { owner_id: true, ends_at: true, tz_offset_min: true } } },
        });
        if (!inv) return { code: 'not_found' };
        const decider = inv.kind === 'INVITE' ? inv.user_id : inv.group.owner_id;
        if (actorId !== decider) return { code: 'not_found' };
        if (inv.status !== 'PENDING') return { code: 'not_pending' };

        const accept = action === 'accept';
        if (accept) {
          if (isEnded(inv.group)) return { code: 'ended' };
          const already = await tx.group_members.findUnique({ where: memberKey(inv.group_id, inv.user_id), select: { user_id: true } });
          if (!already) await groupsRepository.addMember(tx, inv.group_id, inv.user_id);
        }
        const status = accept ? 'ACCEPTED' : 'DECLINED';
        await tx.group_invitations.update({ where: { id }, data: { status, resolved_at: new Date() } });
        return { group_id: inv.group_id, status };
      }, TX);
    } catch (err) {
      if (isUnique(err)) return { code: 'already_member' }; // corrida: entrou por outro caminho no meio
      throw err;
    }
  }

  // Cancela o que EU criei e ainda está pendente (convite do dono, ou o meu próprio pedido).
  async cancel(actorId, id) {
    const { count } = await prisma.group_invitations.updateMany({
      where: { id, created_by: actorId, status: 'PENDING' },
      data: { status: 'CANCELED', resolved_at: new Date() },
    });
    return count > 0;
  }

  // token nulo revoga o link. Colisão de token lança P2002 (o controller gera outro).
  async setInviteToken(ownerId, groupId, token) {
    const { count } = await prisma.groups.updateMany({ where: { id: groupId, owner_id: ownerId }, data: { invite_token: token } });
    return count > 0;
  }

  async getJoinPreview(userId, token) {
    const group = await prisma.groups.findUnique({
      where: { invite_token: token },
      select: { ...PREVIEW_FIELDS, _count: { select: { group_members: true } } },
    });
    if (!group) return null;
    const member = await prisma.group_members.findUnique({ where: memberKey(group.id, userId), select: { user_id: true } });
    const { _count, ...rest } = group;
    return { group: rest, member_count: _count.group_members, is_member: !!member };
  }

  // O link equivale a um convite do dono: entra direto. Convite/pedido pendente do mesmo par é fechado junto.
  async joinByToken(userId, token) {
    try {
      return await prisma.$transaction(async (tx) => {
        const group = await tx.groups.findUnique({ where: { invite_token: token }, select: { id: true, ends_at: true, tz_offset_min: true } });
        if (!group) return { code: 'not_found' };
        if (isEnded(group)) return { code: 'ended' };
        if (await tx.group_members.findUnique({ where: memberKey(group.id, userId), select: { user_id: true } })) {
          return { code: 'already_member' };
        }
        await groupsRepository.addMember(tx, group.id, userId);
        await tx.group_invitations.updateMany({
          where: { group_id: group.id, user_id: userId, status: 'PENDING' },
          data: { status: 'ACCEPTED', resolved_at: new Date() },
        });
        return { group_id: group.id };
      }, TX);
    } catch (err) {
      if (isUnique(err)) return { code: 'already_member' };
      throw err;
    }
  }
}

module.exports = new GroupInvitationsRepository();
