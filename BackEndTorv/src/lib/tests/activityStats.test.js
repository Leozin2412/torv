const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addDays, isCalendarDay, localDayBounds, currentStreak, longestStreak, monthSummary, calendarWindow, buildProfileStats,
} = require('../activityStats');

const dc = (...pairs) => pairs.map(([day, count]) => ({ day, count }));

test('addDays: soma e subtrai dias atravessando mês, ano e 29/02', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-03-01', -1), '2028-02-29');
});

test('isCalendarDay: só datas que existem no calendário', () => {
  for (const ok of ['2026-10-14', '2028-02-29']) assert.equal(isCalendarDay(ok), true, ok);
  for (const bad of ['2026-02-29', '2026-02-31', '2026-13-01', '2026-1-01', 'ontem', '', undefined]) {
    assert.equal(isCalendarDay(bad), false, String(bad));
  }
});

test('localDayBounds: meia-noite local e a seguinte, em UTC', () => {
  const brt = localDayBounds('2026-10-06', -180);
  assert.deepEqual([brt.from.toISOString(), brt.before.toISOString()], ['2026-10-06T03:00:00.000Z', '2026-10-07T03:00:00.000Z']);
  assert.equal(localDayBounds('2026-10-06', 540).from.toISOString(), '2026-10-05T15:00:00.000Z');
});

test('currentStreak: vivo hoje, vivo ontem, quebrado, buraco e vazio', () => {
  assert.equal(currentStreak([], '2026-10-14'), 0);
  assert.equal(currentStreak(['2026-10-14'], '2026-10-14'), 1);
  assert.equal(currentStreak(['2026-10-12', '2026-10-13', '2026-10-14'], '2026-10-14'), 3);
  assert.equal(currentStreak(['2026-10-12', '2026-10-13'], '2026-10-14'), 2);
  assert.equal(currentStreak(['2026-10-11', '2026-10-12'], '2026-10-14'), 0);
  assert.equal(currentStreak(['2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14'], '2026-10-14'), 3);
});

test('currentStreak: vira mês e ano; a ordem da entrada não importa', () => {
  assert.equal(currentStreak(['2027-01-01', '2026-12-30', '2026-12-31'], '2027-01-01'), 3);
  assert.equal(currentStreak(['2026-10-01', '2026-09-30'], '2026-10-01'), 2);
});

test('longestStreak: maior sequência de toda a história, cruzando o ano', () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(['2026-01-01']), 1);
  assert.equal(longestStreak(['2026-01-01', '2026-01-02', '2026-01-04', '2026-01-05', '2026-01-06']), 3);
  assert.equal(longestStreak(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-03']), 3);
});

test('streak de mais de 1000 dias não trunca (o LIMIT 1000 antigo saiu)', () => {
  const days = Array.from({ length: 1200 }, (_, i) => addDays('2026-01-01', i));
  assert.equal(longestStreak(days), 1200);
  assert.equal(currentStreak(days, days[days.length - 1]), 1200);
});

test('monthSummary: dia 1 até hoje; delta contra o mês anterior até o mesmo dia', () => {
  const rows = dc(['2026-09-02', 1], ['2026-09-20', 1], ['2026-10-01', 2], ['2026-10-13', 1], ['2026-10-14', 3]);
  assert.deepEqual(monthSummary(rows, '2026-10-14'), { active_days: 3, activities: 6, active_days_delta: 2 });
});

test('monthSummary: 31/03 compara com fevereiro inteiro (28 ou 29 dias)', () => {
  const rows = dc(['2026-02-27', 1], ['2026-02-28', 2], ['2026-03-01', 1], ['2026-03-31', 3]);
  assert.deepEqual(monthSummary(rows, '2026-03-31'), { active_days: 2, activities: 4, active_days_delta: 0 });
  const leap = dc(['2028-02-28', 1], ['2028-02-29', 1], ['2028-03-31', 1]);
  assert.deepEqual(monthSummary(leap, '2028-03-31'), { active_days: 1, activities: 1, active_days_delta: -1 });
});

test('monthSummary: dia 1, janeiro (mês anterior é dezembro do ano anterior) e vazio', () => {
  assert.deepEqual(monthSummary(dc(['2026-09-01', 1], ['2026-09-02', 1], ['2026-10-01', 2]), '2026-10-01'),
    { active_days: 1, activities: 2, active_days_delta: 0 });
  assert.deepEqual(monthSummary(dc(['2026-12-10', 1], ['2026-12-20', 1], ['2027-01-15', 1]), '2027-01-15'),
    { active_days: 1, activities: 1, active_days_delta: 0 });
  assert.deepEqual(monthSummary([], '2026-10-14'), { active_days: 0, activities: 0, active_days_delta: 0 });
});

test('calendarWindow: 53 semanas de domingo a sábado terminando na semana de hoje', () => {
  assert.deepEqual(calendarWindow('2026-10-14'), { start: '2025-10-12', end: '2026-10-14' }); // quarta
  assert.deepEqual(calendarWindow('2026-10-11'), { start: '2025-10-12', end: '2026-10-11' }); // domingo
  assert.deepEqual(calendarWindow('2026-10-17'), { start: '2025-10-12', end: '2026-10-17' }); // sábado
  assert.deepEqual(calendarWindow('2026-10-18'), { start: '2025-10-19', end: '2026-10-18' }); // domingo seguinte
});

test('buildProfileStats: junta streak, mês, total e calendário; dia antes da janela fica fora do calendário', () => {
  const rows = dc(['2025-10-11', 4], ['2025-10-12', 1], ['2026-10-13', 1], ['2026-10-14', 2]);
  assert.deepEqual(buildProfileStats(rows, '2026-10-14'), {
    streak: { current: 2, longest: 2 },
    month: { active_days: 2, activities: 3, active_days_delta: 2 },
    total_activities: 8,
    calendar: {
      start: '2025-10-12',
      end: '2026-10-14',
      days: [{ date: '2025-10-12', count: 1 }, { date: '2026-10-13', count: 1 }, { date: '2026-10-14', count: 2 }],
    },
  });
});

test('buildProfileStats: sem nenhuma atividade → tudo zero e calendário vazio', () => {
  assert.deepEqual(buildProfileStats([], '2026-10-14'), {
    streak: { current: 0, longest: 0 },
    month: { active_days: 0, activities: 0, active_days_delta: 0 },
    total_activities: 0,
    calendar: { start: '2025-10-12', end: '2026-10-14', days: [] },
  });
});
