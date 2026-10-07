const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { rankRows } = require('../lib/groupRules');

const TX = { timeout: 15000 };
const GROUP_FIELDS = {
  id: true, name: true, visibility: true, cover_url: true,
  starts_at: true, ends_at: true, tz_offset_min: true, owner_id: true,
};
const PROFILE = { select: { name: true, username: true, photo_url: true } };
const keyOf = (groupId, userId) => `${groupId}:${userId}`;
const memberKey = (groupId, userId) => ({ group_id_user_id: { group_id: groupId, user_id: userId } });

// Pontos = dias locais DISTINTOS com atividade na janela do membro (joined_at até o fim do grupo);
// atividades = quantas atividades caem na mesma janela. Recalcula a linha inteira: idempotente, se corrige sozinha.
// Dia local = (start_time em UTC) + tz_offset_min do grupo, igual a groupRules.groupToday.
// Qualquer código que crie, apague ou mude a data de uma atividade TEM que chamar recomputeRanking na mesma transação.
const upsertRanking = (db, where) => db.$executeRaw(Prisma.sql`
  INSERT INTO group_rankings (group_id, user_id, total_points, activities_count)
  SELECT gm.group_id, gm.user_id, COUNT(DISTINCT d.local_day)::int, COUNT(d.local_day)::int
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  LEFT JOIN LATERAL (
    SELECT ((a.start_time AT TIME ZONE 'UTC') + make_interval(mins => g.tz_offset_min))::date AS local_day
    FROM activities a
    WHERE a.user_id = gm.user_id AND a.start_time >= gm.joined_at
  ) d ON d.local_day >= g.starts_at AND (g.ends_at IS NULL OR d.local_day <= g.ends_at)
  WHERE ${where}
  GROUP BY gm.group_id, gm.user_id
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET total_points = EXCLUDED.total_points, activities_count = EXCLUDED.activities_count`);

class GroupsRepository {
  recomputeRanking(db, userId) {
    return upsertRanking(db, Prisma.sql`gm.user_id = ${userId}::uuid`);
  }

  recomputeGroup(db, groupId) {
    return upsertRanking(db, Prisma.sql`gm.group_id = ${groupId}::uuid`);
  }

  // Membro novo entra com a linha de ranking zerada (joined_at = agora: treinos de antes não contam).
  async addMember(db, groupId, userId) {
    await db.group_members.create({ data: { group_id: groupId, user_id: userId } });
    await db.group_rankings.create({ data: { group_id: groupId, user_id: userId, total_points: 0, activities_count: 0 } });
  }

  async createGroup(ownerId, data) {
    return prisma.$transaction(async (tx) => {
      const group = await tx.groups.create({ data: { ...data, owner_id: ownerId }, select: { id: true } });
      await this.addMember(tx, group.id, ownerId);
      return group.id;
    }, TX);
  }

  // null = não existe, ou é PRIVATE e o usuário não é membro (o chamador responde 404 nos dois casos).
  async getForViewer(userId, id) {
    const [group, membership, invitation] = await Promise.all([
      prisma.groups.findUnique({
        where: { id },
        select: { ...GROUP_FIELDS, invite_token: true, _count: { select: { group_members: true } } },
      }),
      prisma.group_members.findUnique({ where: memberKey(id, userId), select: { user_id: true } }),
      prisma.group_invitations.findFirst({
        where: { group_id: id, user_id: userId, status: 'PENDING' },
        select: { id: true, kind: true },
      }),
    ]);
    if (!group || (group.visibility === 'PRIVATE' && !membership)) return null;
    return { group, member_count: group._count.group_members, is_member: !!membership, my_invitation: invitation };
  }

  getOwned(userId, id) {
    return prisma.groups.findFirst({ where: { id, owner_id: userId }, select: GROUP_FIELDS });
  }

  async updateGroup(id, data, { recompute }) {
    await prisma.$transaction(async (tx) => {
      await tx.groups.update({ where: { id }, data });
      if (recompute) await this.recomputeGroup(tx, id);
    }, TX);
  }

  async deleteGroup(userId, id) {
    const group = await prisma.groups.findFirst({ where: { id, owner_id: userId }, select: { cover_url: true } });
    if (!group) return null;
    await prisma.groups.delete({ where: { id } });
    return { cover_url: group.cover_url };
  }

  // Devolve a capa anterior, para o chamador apagar o arquivo.
  async setCover(id, fileName) {
    const previous = await prisma.groups.findUnique({ where: { id }, select: { cover_url: true } });
    await prisma.groups.update({ where: { id }, data: { cover_url: fileName } });
    return previous?.cover_url ?? null;
  }

  // ponytail: rank calculado em JS sobre as linhas de todos os grupos do usuário (até ~100 membros por grupo);
  // com grupos enormes, mover para SQL com window function.
  async listMine(userId) {
    const memberships = await prisma.group_members.findMany({
      where: { user_id: userId },
      orderBy: { joined_at: 'desc' },
      select: { group: { select: { ...GROUP_FIELDS, _count: { select: { group_members: true } } } } },
    });
    const groups = memberships.map((m) => m.group);
    if (groups.length === 0) return [];
    const ids = groups.map((g) => g.id);
    const [members, rankings] = await Promise.all([
      prisma.group_members.findMany({ where: { group_id: { in: ids } }, select: { group_id: true, user_id: true, joined_at: true } }),
      prisma.group_rankings.findMany({ where: { group_id: { in: ids } }, select: { group_id: true, user_id: true, total_points: true, activities_count: true } }),
    ]);
    const scored = new Map(rankings.map((r) => [keyOf(r.group_id, r.user_id), r]));
    return groups.map(({ _count, ...g }) => {
      const rows = members.filter((m) => m.group_id === g.id).map((m) => ({
        user_id: m.user_id,
        joined_at: m.joined_at,
        total_points: scored.get(keyOf(g.id, m.user_id))?.total_points ?? 0,
        activities_count: scored.get(keyOf(g.id, m.user_id))?.activities_count ?? 0,
      }));
      const me = rankRows(rows).find((r) => r.user_id === userId);
      return { ...g, member_count: _count.group_members, my_rank: me?.position ?? rows.length, my_points: me?.total_points ?? 0 };
    });
  }

  // Públicos, ainda não encerrados (no fuso do próprio grupo) e dos quais o usuário não é membro.
  async discover(userId, q, offset, limit) {
    const like = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : '%';
    const rows = await prisma.$queryRaw`
      SELECT g.id, g.name, g.cover_url, g.starts_at, g.ends_at, g.tz_offset_min,
             (SELECT COUNT(*)::int FROM group_members m WHERE m.group_id = g.id) AS member_count
      FROM groups g
      WHERE g.visibility = 'PUBLIC'
        AND g.name ILIKE ${like} ESCAPE '\\'
        AND (g.ends_at IS NULL OR g.ends_at >= ((now() AT TIME ZONE 'UTC') + make_interval(mins => g.tz_offset_min))::date)
        AND NOT EXISTS (SELECT 1 FROM group_members m2 WHERE m2.group_id = g.id AND m2.user_id = ${userId}::uuid)
      ORDER BY member_count DESC, g.created_at DESC, g.id
      LIMIT ${limit + 1} OFFSET ${offset}`;
    return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  // Só membro vê o ranking. Membro sem linha em group_rankings entra com zero.
  async getRanking(userId, groupId) {
    const me = await prisma.group_members.findUnique({ where: memberKey(groupId, userId), select: { user_id: true } });
    if (!me) return null;
    const members = await prisma.group_members.findMany({
      where: { group_id: groupId },
      select: {
        user_id: true,
        joined_at: true,
        user: { select: { user_profiles: PROFILE, group_rankings: { where: { group_id: groupId }, select: { total_points: true, activities_count: true } } } },
      },
    });
    return rankRows(members.map((m) => ({
      user_id: m.user_id,
      joined_at: m.joined_at,
      name: m.user.user_profiles?.name ?? '',
      username: m.user.user_profiles?.username ?? '',
      photo_url: m.user.user_profiles?.photo_url ?? null,
      total_points: m.user.group_rankings[0]?.total_points ?? 0,
      activities_count: m.user.group_rankings[0]?.activities_count ?? 0,
    })));
  }

  // O próprio usuário sai; só o dono remove outro; o dono não sai (apaga o grupo).
  async removeMember(actorId, groupId, targetId) {
    const group = await prisma.groups.findUnique({ where: { id: groupId }, select: { owner_id: true } });
    if (!group) return 'not_found';
    if (actorId === targetId) {
      if (group.owner_id === actorId) return 'owner_cannot_leave';
    } else if (group.owner_id !== actorId) {
      return 'not_found';
    }
    const removed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.group_members.deleteMany({ where: { group_id: groupId, user_id: targetId } });
      if (count) await tx.group_rankings.deleteMany({ where: { group_id: groupId, user_id: targetId } });
      return count;
    }, TX);
    return removed ? 'ok' : 'not_found';
  }
}

module.exports = new GroupsRepository();
