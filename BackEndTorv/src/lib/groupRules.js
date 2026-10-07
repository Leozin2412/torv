const { randomInt } = require('node:crypto');

// Sem I, L, O, 0, 1 (confundem na digitação). 31 símbolos ^ 8 = ~8,5e11 combinações.
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TOKEN_LENGTH = 8;
const TOKEN_RE = new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`);

const generateInviteToken = () =>
  Array.from({ length: TOKEN_LENGTH }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join('');
const normalizeToken = (raw) => String(raw).trim().toUpperCase();
const isValidToken = (token) => TOKEN_RE.test(token);

// Dia local do grupo (YYYY-MM-DD) num instante. Mesma conta do SQL de recomputeRanking.
const groupToday = (tzOffsetMin, now = Date.now()) => new Date(now + tzOffsetMin * 60000).toISOString().slice(0, 10);

// Colunas @db.Date chegam do Prisma como Date em 00:00 UTC.
const dateOnly = (d) => (d ? d.toISOString().slice(0, 10) : null);
const toDbDate = (s) => new Date(`${s}T00:00:00Z`);

const isEnded = (group, now = Date.now()) =>
  group.ends_at != null && groupToday(group.tz_offset_min, now) > dateOnly(group.ends_at);

const validDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

function checkGroupDates({ starts_at, ends_at }) {
  if (!validDate(starts_at)) return 'starts_at must be a valid date';
  if (ends_at != null) {
    if (!validDate(ends_at)) return 'ends_at must be a valid date';
    if (ends_at < starts_at) return 'ends_at must be on or after starts_at';
  }
  return null;
}

// Pontos, depois atividades, depois quem entrou primeiro (user_id só para a ordem ser estável). Posições sem empate.
const rankRows = (rows) =>
  [...rows]
    .sort((a, b) =>
      (b.total_points - a.total_points)
      || (b.activities_count - a.activities_count)
      || (new Date(a.joined_at) - new Date(b.joined_at))
      || a.user_id.localeCompare(b.user_id))
    .map((r, i) => ({ ...r, position: i + 1 }));

// Código de falha do repository → [status HTTP, mensagem].
const FAILURES = {
  not_found: [404, 'Not found'],
  ended: [409, 'Group has ended'],
  already_member: [409, 'Already a member'],
  duplicate: [409, 'Already pending'],
  not_pending: [409, 'Invitation is not pending'],
  owner_cannot_leave: [409, 'Owner cannot leave the group; delete it instead'],
};

module.exports = {
  TOKEN_ALPHABET, generateInviteToken, normalizeToken, isValidToken,
  groupToday, dateOnly, toDbDate, isEnded, checkGroupDates, rankRows, FAILURES,
};
