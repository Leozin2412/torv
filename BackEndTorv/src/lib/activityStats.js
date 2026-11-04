// Contas do perfil e da Home sobre dias LOCAIS 'YYYY-MM-DD'. Strings comparam e ordenam como datas, sem fuso no meio.
// dayCounts = [{ day, count }] em ordem crescente, sem dia repetido (activitiesRepository.dayCounts).

const DAY_MS = 86400000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const toMs = (day) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (day, n) => toDay(toMs(day) + n * DAY_MS);

// O pattern das rotas aceita 2026-02-31; o Date normaliza para março, então a ida e volta denuncia.
function isCalendarDay(day) {
  if (typeof day !== 'string' || !DAY_RE.test(day)) return false;
  const ms = toMs(day);
  return !Number.isNaN(ms) && toDay(ms) === day;
}

// Meia-noite local de `day` e a seguinte, em UTC (local = UTC + tzOffsetMin).
function localDayBounds(day, tzOffsetMin) {
  const from = new Date(toMs(day) - tzOffsetMin * 60000);
  return { from, before: new Date(from.getTime() + DAY_MS) };
}

// Dias seguidos com atividade até hoje; se hoje ainda não teve, conta a partir de ontem (o streak segue vivo).
function currentStreak(days, today) {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// Maior sequência de dias consecutivos. days em ordem crescente, sem repetição.
function longestStreak(days) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate(); // month 1..12

// Mês corrente do dia 1 até hoje. Delta = dias ativos contra o mês anterior do dia 1 até o mesmo dia (limitado ao fim dele).
function monthSummary(dayCounts, today) {
  const [year, month, dayOfMonth] = today.split('-').map(Number);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevStart = `${prevPrefix}-01`;
  const prevEnd = `${prevPrefix}-${String(Math.min(dayOfMonth, lastDayOfMonth(prevYear, prevMonth))).padStart(2, '0')}`;
  let activeDays = 0;
  let activities = 0;
  let prevActiveDays = 0;
  for (const { day, count } of dayCounts) {
    if (day >= monthStart && day <= today) {
      activeDays += 1;
      activities += count;
    } else if (day >= prevStart && day <= prevEnd) {
      prevActiveDays += 1;
    }
  }
  return { active_days: activeDays, activities, active_days_delta: activeDays - prevActiveDays };
}

// 53 colunas de domingo a sábado terminando na semana de hoje, como o calendário do GitHub.
function calendarWindow(today) {
  const weekday = new Date(toMs(today)).getUTCDay(); // 0 = domingo
  return { start: addDays(today, -weekday - 52 * 7), end: today };
}

function buildProfileStats(dayCounts, today) {
  const days = dayCounts.map((r) => r.day);
  const { start, end } = calendarWindow(today);
  return {
    streak: { current: currentStreak(days, today), longest: longestStreak(days) },
    month: monthSummary(dayCounts, today),
    total_activities: dayCounts.reduce((n, r) => n + r.count, 0),
    calendar: {
      start,
      end,
      days: dayCounts.filter((r) => r.day >= start && r.day <= end).map((r) => ({ date: r.day, count: r.count })),
    },
  };
}

module.exports = {
  addDays, isCalendarDay, localDayBounds, currentStreak, longestStreak, monthSummary, calendarWindow, buildProfileStats,
};
