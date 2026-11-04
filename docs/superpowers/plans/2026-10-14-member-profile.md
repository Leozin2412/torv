# Perfil de membro, streak unificado e calendário — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Neste projeto a execução é pelos recruits do Maestri (`maestri ask`), um por vez, não por subagentes internos** (ver Global Constraints).

**Goal:** tocar num membro do grupo abre o perfil dele, com streak, mês, calendário de dias ativos e histórico. O streak passa a ter uma conta só, de qualquer tipo de atividade, na Home, no Perfil próprio e no perfil dos outros.

**Architecture:**
- **Backend:** plugin novo `users.routes.js` (`/users/:id/profile` e `/users/:id/activities`), com acesso só para o próprio usuário ou para quem divide um grupo com ele. Contas puras em `lib/activityStats.js`, sobre uma consulta única de dias locais com contagem (`activitiesRepository.dayCounts`), que também passa a alimentar o streak da Home. O `GET /profile` perde os campos de streak e contagem.
- **Frontend:** a tela empilhada `MemberProfile` e o componente `ActivityHeatmap`, com utilitários puros testáveis (`heatmap`, `profileStats`). Entradas pelo ranking (`GroupDetail`) e pelos membros (`GroupManage`); o `Profile` usa o mesmo endpoint.
- **Banco:** nenhuma migration.

**Tech Stack:**
- **Backend:** Node 24, Fastify 5 + TypeBox, Prisma 6.4.1 (Postgres/Supabase), `node:test` (`npm test` em `BackEndTorv`; base **239** testes).
- **Frontend:** React Native 0.86, Expo 57, react-native-web 0.21, `react-native-svg` (já instalado). Testes `node --test src/utils/*.test.mjs` (type stripping; base **49**) e `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-10-14-member-profile-design.md`

## Global Constraints

- **Branch e push:** branch `feat/perfil-terceiros-gpx`. **Nada de push** (o usuário avisa quando).
- **Execução estritamente sequencial:**
  - um recruit por vez, via `maestri ask`;
  - cada etapa só começa depois do teste da etapa anterior verde;
  - nunca Backend e Frontend em paralelo.
- **Commits:**
  - só os arquivos da própria tarefa, com pathspec explícito (`git commit -m "..." -- <arquivos>`);
  - nunca entram em commit `BackEndTorv/package-lock.json` (mudança antiga, fora da feature), `revisar*.md`, `FrontEndTorv/.env`, `BackEndTorv/.env` e o `.gpx` da raiz;
  - **atribuição** em todo commit dos recruits: linha final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Acesso negado:** quem não é o próprio usuário nem divide grupo com ele recebe **404**, nunca 403. Usuário inexistente recebe o mesmo 404.
- **UUID em params:** o `IdParams` de `workout.schemas.js` (padrão estrito; o `format: 'uuid'` do Ajv aceita `urn:uuid:`). O controller normaliza o `id` para minúsculas.
- **Dia local:** `start_time` UTC + `tz_offset_min` **de quem vê** (enviado pelo app, como a Home). A fórmula do SQL é a mesma de `strengthDays` e do ranking.
- **Streak:** dias locais seguidos com atividade de **qualquer** tipo. Fica vivo se teve atividade hoje ou ontem.
- **Backend no Furnace** (porta 3000):
  - só o Maestro o para ou reinicia;
  - nunca suba outra instância;
  - depois das tarefas de backend, o Maestro reinicia o Furnace.
- **Frontend:**
  - antes de qualquer código, ler a doc versionada do Expo (`FrontEndTorv/AGENTS.md`: https://docs.expo.dev/versions/v56.0.0/);
  - telas e componentes novos passam por `/frontend-design`;
  - textos em pt-BR;
  - alvos de toque de 44 px (exceção única: os quadrados do calendário);
  - layout que caiba em 320 px;
  - nenhum `Alert.alert` novo;
  - botão dentro de botão é proibido (quebra no web).
- **Utilitários testados** (`*.ts` com `*.test.mjs`) **não importam nada relativo em runtime**: o Node não resolve import relativo sem extensão. `import type` pode.
- **Usabilidade:** no Expo web, pelo portal **TorvWeb** do Maestri (`http://localhost:8081`). Para os testes de layout, redimensionar para 320 px. O token nunca sai do navegador.
- **Contas e dados de QA:**
  - criados pelo teste: `/auth/register` mais a confirmação de e-mail, como nos ciclos anteriores, sem imprimir segredos;
  - atividades antigas para o calendário entram por SQL via Prisma, só nas contas QA;
  - tudo é apagado no fim, e a contagem antes/depois fica no relatório.
- **Relatórios:**
  - em `docs/`, um arquivo novo por rodada: `qa-member-profile-<estagio>-2026-10-14[-roundN].md` e `security-member-profile-2026-10-14[-roundN].md`;
  - nunca sobrescrever.

## Review Focus

1. **Atividade perto da meia-noite local** (23:50 BRT = 02:50Z do dia seguinte): entra no dia **local** de quem vê, no streak, no mês e no calendário. Coberto em `localDayBounds` (Task 1), no `before` de `dayCounts` (Task 3: `2026-10-15T03:00Z` para `date=2026-10-14`, `tz=-180`) e no cenário ao vivo com dois fusos (Task 4, Step 4).
2. **Usuário sem nenhuma atividade:** tudo zero, calendário vazio e histórico com "Nenhuma atividade ainda." Coberto em `buildProfileStats([])` (Task 1) e no fluxo 7 da Task 8.
3. **Membro sai do grupo com o perfil aberto:** puxar para atualizar mostra "Perfil indisponível" (404), sem dado antigo na tela. Coberto no teste de rota do 404 (Task 3) e no fluxo 6 da Task 8.
4. **Virada de mês e fevereiro no "vs mês passado":** em 31/03 o delta compara com fevereiro inteiro (28 ou 29 dias); no dia 1, com o dia 1 do mês anterior; em janeiro, com dezembro do ano anterior. Coberto em `monthSummary` (Task 1).
5. **Nome longo, sem foto e 320 px:** o nome quebra em até 2 linhas, o @username em 1, a inicial aparece no lugar da foto e o calendário rola sem empurrar a tela para o lado. Coberto no fluxo 8 da Task 8.

## Arquivos

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Backend | `src/lib/activityStats.js` | **Cria.** Datas `YYYY-MM-DD`, limites do dia local, streak atual e recorde, mês com delta, janela do calendário, `buildProfileStats` |
| Backend | `src/lib/activityPage.js` | **Cria.** Item e página de atividade (compartilhado por `/activities` e `/users/:id/activities`) |
| Backend | `src/repository/activities.repository.js` | `dayCounts` substitui `strengthDays`; `listActivities` seleciona `distance_m` |
| Backend | `src/repository/users.repository.js` | **Cria.** `getPublicProfile`, `sharesGroup` |
| Backend | `src/routes/activities.schemas.js` | **Cria.** `ACTIVITY_TYPES`, `ActivityItem`, `ActivityPage`, `LocalDayQuery` |
| Backend | `src/routes/activities.routes.js`, `src/controller/activities.controller.js` | Usam os schemas e as libs novas; o summary conta qualquer tipo |
| Backend | `src/routes/users.routes.js`, `src/controller/users.controller.js` | **Cria.** As duas rotas de membro |
| Backend | `server.js` | Registra `/users` |
| Backend | `src/repository/profile.repository.js`, `src/controller/profile.controller.js`, `src/routes/profile.routes.js` | Saem `streak`, `longest_streak`, `workouts_in_month`, `total_workouts` |
| Backend (testes) | `src/lib/tests/activityStats.test.js`, `src/lib/tests/activityPage.test.js`, `src/repository/tests/activities.repository.test.js`, `src/repository/tests/users.repository.test.js`, `src/routes/tests/users.routes.test.js` | **Cria** |
| Backend (testes) | `src/routes/tests/activities.routes.test.js`, `src/routes/tests/profile.routes.test.js` | Atualiza |
| Frontend | `src/services/users.ts` | **Cria.** `usersApi`, `MemberProfileData`, `localDayQuery` |
| Frontend | `src/services/activities.ts` | `ActivityItem.distance_m` |
| Frontend | `src/utils/heatmap.ts` + `heatmap.test.mjs` | **Cria.** Grade de 53 semanas, níveis, rótulos, célula sob o toque |
| Frontend | `src/utils/profileStats.ts` + `profileStats.test.mjs` | **Cria.** `deltaLabel`, `plural` |
| Frontend | `src/utils/activityMeta.ts` | **Cria.** Linha de detalhes do item (sem teste: importa `./clock` em runtime) |
| Frontend | `src/components/ActivityHeatmap/index.tsx`, `styles.ts` | **Cria** |
| Frontend | `src/screens/MemberProfile/index.tsx`, `styles.ts` | **Cria** |
| Frontend | `src/routes/types.ts`, `src/routes/PrivateRoutes/index.tsx` | Rota `MemberProfile` |
| Frontend | `src/screens/GroupDetail/index.tsx`, `src/screens/GroupManage/index.tsx` | Entradas para o perfil |
| Frontend | `src/screens/Profile/index.tsx`, `styles.ts` | Endpoint novo, calendário, delta real, atividades de qualquer tipo |
| Docs | `docs/qa-member-profile-*.md`, `docs/security-member-profile-*.md` | Relatórios |

## Contrato da API (fonte única para backend e frontend)

**`GET /users/:id/profile?date=YYYY-MM-DD&tz_offset_min=N`**
- **Acesso:** o próprio usuário, ou membro de grupo em comum.
- **200:**

```json
{
  "user": { "id": "uuid", "name": "Bia", "username": "bia", "photo_url": "https://... | null", "fitness_level": "INTERMEDIÁRIO | null" },
  "is_me": false,
  "streak": { "current": 2, "longest": 2 },
  "month": { "active_days": 3, "activities": 6, "active_days_delta": 2 },
  "total_activities": 7,
  "calendar": { "start": "2025-10-12", "end": "2026-10-14", "days": [{ "date": "2026-10-13", "count": 1 }] }
}
```

- **Erros:**
  - 400: data que não existe no calendário, `tz_offset_min` fora de −840..840, `id` fora do padrão;
  - 404 `{ "error": "Not found" }`.

**`GET /users/:id/activities?before=ISO&limit=1..50`** (padrão 20)
- Acesso: o mesmo.
- **200:** a mesma página do `GET /activities`:

```json
{
  "activities": [{ "id": "...", "activity_type": "STRENGTH", "title": "Treino A", "start_time": "ISO", "duration_sec": 3000, "set_count": 18, "distance_m": null }],
  "next_before": "ISO | null"
}
```

**`GET /activities`:** o item ganha `distance_m: number | null`.

**`GET /activities/summary`:** o contrato não muda. `streak_days` passa a contar **qualquer** tipo de atividade.

**`GET /profile`:** saem `streak`, `longest_streak`, `workouts_in_month` e `total_workouts`.

---

### Task 1: Backend — `lib/activityStats.js` (contas puras)

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/lib/activityStats.js`
- Test: `BackEndTorv/src/lib/tests/activityStats.test.js`

**Interfaces:**
- Produces:
  - `addDays(day: string, n: number): string`
  - `isCalendarDay(day: any): boolean`
  - `localDayBounds(day: string, tzOffsetMin: number): { from: Date, before: Date }`
  - `currentStreak(days: string[], today: string): number`
  - `longestStreak(daysAscending: string[]): number`
  - `monthSummary(dayCounts: {day, count}[], today: string): { active_days, activities, active_days_delta }`
  - `calendarWindow(today: string): { start, end }`
  - `buildProfileStats(dayCounts, today): { streak: { current, longest }, month, total_activities, calendar: { start, end, days: { date, count }[] } }`

- [ ] **Step 1: Escrever o teste que falha** — `BackEndTorv/src/lib/tests/activityStats.test.js`

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/lib/tests/activityStats.test.js`
Expected: FAIL com `Cannot find module '../activityStats'`.

- [ ] **Step 3: Implementar** — `BackEndTorv/src/lib/activityStats.js`

```js
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd BackEndTorv && node --test src/lib/tests/activityStats.test.js`
Expected: PASS (13 testes).

- [ ] **Step 5: Commit**

```bash
git add BackEndTorv/src/lib/activityStats.js BackEndTorv/src/lib/tests/activityStats.test.js
git commit -m "feat(activities): pure streak, month and calendar stats on local days" -- BackEndTorv/src/lib/activityStats.js BackEndTorv/src/lib/tests/activityStats.test.js
```

---

### Task 2: Backend — repositórios (`dayCounts`, `distance_m`, `users.repository`) e `activityPage`

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/lib/activityPage.js`, `BackEndTorv/src/repository/users.repository.js`
- Modify: `BackEndTorv/src/repository/activities.repository.js` (`strengthDays` → `dayCounts`; `distance_m` no `select` do `listActivities`)
- Test: `BackEndTorv/src/lib/tests/activityPage.test.js`, `BackEndTorv/src/repository/tests/activities.repository.test.js`, `BackEndTorv/src/repository/tests/users.repository.test.js`

**Interfaces:**
- Consumes: nada da Task 1.
- Produces:
  - `activitiesRepository.dayCounts(userId, { before: Date, tzOffsetMin: number }) → Promise<{ day: string, count: number }[]>`
  - `activitiesRepository.listActivities(userId, { type?, from?, before?, limit })`, que agora traz `distance_m`
  - `usersRepository.getPublicProfile(userId) → Promise<{ user_id, name, username, photo_url, fitness_level } | null>`
  - `usersRepository.sharesGroup(viewerId, targetId) → Promise<boolean>`
  - `activityItem(row)` e `activityPage(rows, limit) → { activities, next_before }`

- [ ] **Step 1: Escrever os testes que falham**

`BackEndTorv/src/lib/tests/activityPage.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { activityItem, activityPage } = require('../activityPage');

const row = (over = {}) => ({
  id: 'a1', activity_type: 'STRENGTH', title: 'Treino A', start_time: new Date('2026-10-14T20:00:00Z'),
  duration_sec: 3000, distance_m: null, _count: { workout_sets: 3 }, ...over,
});

test('activityItem: título e duração nulos viram vazio e 0; distance_m Decimal vira número', () => {
  assert.deepEqual(activityItem(row({ title: null, duration_sec: null })), {
    id: 'a1', activity_type: 'STRENGTH', title: '', start_time: '2026-10-14T20:00:00.000Z',
    duration_sec: 0, set_count: 3, distance_m: null,
  });
  // O Prisma devolve Decimal; Number() converte pelo valueOf/toString.
  assert.equal(activityItem(row({ distance_m: { toString: () => '8445.10', valueOf: () => 8445.1 } })).distance_m, 8445.1);
  assert.equal(activityItem(row({ distance_m: '1000.00' })).distance_m, 1000);
});

test('activityPage: página cheia → next_before = start_time do último; incompleta → null', () => {
  const rows = [row({ id: 'a' }), row({ id: 'b', start_time: new Date('2026-10-13T20:00:00Z') })];
  assert.equal(activityPage(rows, 2).next_before, '2026-10-13T20:00:00.000Z');
  assert.equal(activityPage(rows, 3).next_before, null);
  assert.deepEqual(activityPage(rows, 3).activities.map((a) => a.id), ['a', 'b']);
});
```

`BackEndTorv/src/repository/tests/activities.repository.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const USER = '11111111-1111-4111-8111-111111111111';

// Prisma falso (o client real é um Proxy que o mock.method não alcança). `state` é recriado a cada teste.
let state;
const fakePrisma = {
  $queryRaw: async (strings, ...values) => {
    state.queryRaw.push({ sql: strings.join('?').replace(/\s+/g, ' '), values });
    return state.rows;
  },
  activities: {
    findMany: async (args) => { state.findMany.push(args); return []; },
  },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const repo = require('../activities.repository');

test('dayCounts: dias locais de QUALQUER tipo, com contagem, em ordem crescente, antes de `before`, sem LIMIT', async () => {
  state = { queryRaw: [], findMany: [], rows: [{ day: '2026-10-13', count: 2 }] };
  const before = new Date('2026-10-15T03:00:00Z');
  assert.deepEqual(await repo.dayCounts(USER, { before, tzOffsetMin: -180 }), [{ day: '2026-10-13', count: 2 }]);
  const [{ sql, values }] = state.queryRaw;
  assert.match(sql, /make_interval\(mins => \?::int\)/);
  assert.match(sql, /COUNT\(\*\)::int AS count/);
  assert.match(sql, /user_id = \?::uuid/);
  assert.match(sql, /start_time < \?::timestamptz/);
  assert.match(sql, /GROUP BY 1 ORDER BY 1/);
  assert.doesNotMatch(sql, /activity_type/);
  assert.doesNotMatch(sql, /LIMIT/);
  assert.deepEqual(values, [-180, USER, before]);
});

test('listActivities: seleciona distance_m para o item da página', async () => {
  state = { queryRaw: [], findMany: [], rows: [] };
  await repo.listActivities(USER, { limit: 20 });
  assert.equal(state.findMany[0].select.distance_m, true);
  assert.equal(state.findMany[0].where.user_id, USER);
});
```

`BackEndTorv/src/repository/tests/users.repository.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '44444444-4444-4444-8444-444444444444';

let state;
const fakePrisma = {
  user_profiles: { findUnique: async (args) => { state.calls.push(['profiles.findUnique', args]); return state.profile; } },
  group_members: { findFirst: async (args) => { state.calls.push(['members.findFirst', args]); return state.membership; } },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const repo = require('../users.repository');

test('sharesGroup: procura o alvo num grupo em que o viewer também é membro', async () => {
  state = { calls: [], membership: { group_id: 'g' } };
  assert.equal(await repo.sharesGroup(USER, OTHER), true);
  const [[name, args]] = state.calls;
  assert.equal(name, 'members.findFirst');
  assert.deepEqual(args.where, { user_id: OTHER, group: { group_members: { some: { user_id: USER } } } });
  state = { calls: [], membership: null };
  assert.equal(await repo.sharesGroup(USER, OTHER), false);
});

test('getPublicProfile: só os campos exibíveis a outros membros', async () => {
  state = { calls: [], profile: { user_id: OTHER, name: 'Bia' } };
  assert.deepEqual(await repo.getPublicProfile(OTHER), { user_id: OTHER, name: 'Bia' });
  const [[, args]] = state.calls;
  assert.deepEqual(args, {
    where: { user_id: OTHER },
    select: { user_id: true, name: true, username: true, photo_url: true, fitness_level: true },
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/lib/tests/activityPage.test.js src/repository/tests/activities.repository.test.js src/repository/tests/users.repository.test.js`
Expected: FAIL (`Cannot find module '../activityPage'`, `repo.dayCounts is not a function`, `Cannot find module '../users.repository'`).

- [ ] **Step 3: Implementar**

`BackEndTorv/src/lib/activityPage.js`:

```js
// Item e página do GET /activities e do GET /users/:id/activities. Página cheia → pode haver mais: o cliente manda
// next_before como `before` na próxima chamada.
function activityItem(a) {
  return {
    id: a.id,
    activity_type: a.activity_type,
    title: a.title ?? '',
    start_time: a.start_time.toISOString(),
    duration_sec: a.duration_sec ?? 0,
    set_count: a._count.workout_sets,
    distance_m: a.distance_m == null ? null : Number(a.distance_m),
  };
}

function activityPage(rows, limit) {
  return {
    activities: rows.map(activityItem),
    next_before: rows.length === limit ? rows[rows.length - 1].start_time.toISOString() : null,
  };
}

module.exports = { activityItem, activityPage };
```

`BackEndTorv/src/repository/activities.repository.js`:
- no `select` do `listActivities`, acrescentar `distance_m: true` (depois de `duration_sec: true`);
- trocar o método `strengthDays` inteiro (comentário + corpo) por:

```js
  // [{ day: 'YYYY-MM-DD', count }] dos dias LOCAIS (UTC + tzOffsetMin) com atividade de QUALQUER tipo antes de `before`
  // (UTC), em ordem crescente. Sem LIMIT: no máximo uma linha por dia de uso (~365 por ano).
  async dayCounts(userId, { before, tzOffsetMin }) {
    return prisma.$queryRaw`
      SELECT to_char((start_time AT TIME ZONE 'UTC') + make_interval(mins => ${tzOffsetMin}::int), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count
      FROM activities
      WHERE user_id = ${userId}::uuid AND start_time IS NOT NULL AND start_time < ${before}::timestamptz
      GROUP BY 1 ORDER BY 1`;
  }
```

`BackEndTorv/src/repository/users.repository.js`:

```js
const prisma = require('../lib/prisma');

class UsersRepository {
  // Só o que o perfil de membro mostra: nada de e-mail, corpo, idade ou objetivo.
  getPublicProfile(userId) {
    return prisma.user_profiles.findUnique({
      where: { user_id: userId },
      select: { user_id: true, name: true, username: true, photo_url: true, fitness_level: true },
    });
  }

  // true se os dois são membros de pelo menos um grupo em comum agora.
  async sharesGroup(viewerId, targetId) {
    const row = await prisma.group_members.findFirst({
      where: { user_id: targetId, group: { group_members: { some: { user_id: viewerId } } } },
      select: { group_id: true },
    });
    return row !== null;
  }
}

module.exports = new UsersRepository();
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd BackEndTorv && node --test src/lib/tests/activityPage.test.js src/repository/tests/activities.repository.test.js src/repository/tests/users.repository.test.js`
Expected: PASS (6 testes). O `npm test` inteiro ainda **falha** nos testes do summary (`strengthDays` sumiu), que a Task 3 reescreve. **Não** commitar com a suíte vermelha: seguir direto para a Task 3 e commitar as duas juntas no Step 6 dela.

---

### Task 3: Backend — rotas de membro, summary com qualquer tipo e limpeza do `GET /profile`

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/routes/activities.schemas.js`, `BackEndTorv/src/routes/users.routes.js`, `BackEndTorv/src/controller/users.controller.js`, `BackEndTorv/src/routes/tests/users.routes.test.js`
- Modify:
  - `BackEndTorv/src/routes/activities.routes.js`
  - `BackEndTorv/src/controller/activities.controller.js`
  - `BackEndTorv/server.js`
  - `BackEndTorv/src/repository/profile.repository.js`
  - `BackEndTorv/src/controller/profile.controller.js`
  - `BackEndTorv/src/routes/profile.routes.js`
  - `BackEndTorv/src/routes/tests/activities.routes.test.js`
  - `BackEndTorv/src/routes/tests/profile.routes.test.js`

**Interfaces:**
- Consumes:
  - `buildProfileStats`, `currentStreak`, `isCalendarDay` e `localDayBounds` (Task 1);
  - `dayCounts`, `listActivities`, `getPublicProfile`, `sharesGroup` e `activityPage` (Task 2).
- Produces: as rotas do **Contrato da API** e os exports de `activities.schemas.js` (`ACTIVITY_TYPES`, `ActivityItem`, `ActivityPage`, `LocalDayQuery`), que o subprojeto do GPX estende.

- [ ] **Step 1: Escrever os testes que falham**

`BackEndTorv/src/routes/tests/users.routes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

// O middleware real valida JWT contra o JWKS do Supabase. Aqui todo request é do USER.
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '44444444-4444-4444-8444-444444444444';
const authPath = require.resolve('../../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const usersRepository = require('../../repository/users.repository');
const activitiesRepository = require('../../repository/activities.repository');

// publicUrl lê a env na chamada; o resto do app não precisa dela.
Object.assign(process.env, { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SECRET_KEY: 'test-key', SUPABASE_STORAGE_BUCKET: 'torv-photos' });
const PUB = 'https://proj.supabase.co/storage/v1/object/public/torv-photos';

async function build(t) {
  const app = Fastify();
  app.register(require('../users.routes'), { prefix: '/users' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const get = (app, url) => app.inject({ method: 'GET', url });
const QS = 'date=2026-10-14&tz_offset_min=-180';
const dc = (...pairs) => pairs.map(([day, count]) => ({ day, count }));
const profileRow = (over = {}) => ({
  user_id: OTHER, name: 'Bia', username: 'bia', photo_url: 'bia.jpg', fitness_level: 'INTERMEDIÁRIO', ...over,
});
const row = (i, extra = {}) => ({
  id: `id-${i}`, activity_type: 'STRENGTH', title: `Treino ${i}`, distance_m: null,
  start_time: new Date(Date.UTC(2026, 9, 14 - i, 20)), duration_sec: 3000, _count: { workout_sets: 3 }, ...extra,
});

function mocks(t, { shares = true, profile = profileRow(), dayCounts = [], rows = [] } = {}) {
  return {
    shares: t.mock.method(usersRepository, 'sharesGroup', async () => shares),
    profile: t.mock.method(usersRepository, 'getPublicProfile', async () => profile),
    days: t.mock.method(activitiesRepository, 'dayCounts', async () => dayCounts),
    list: t.mock.method(activitiesRepository, 'listActivities', async () => rows),
  };
}

test('GET /users/:id/profile: membro de grupo em comum → 200 com o contrato inteiro', async (t) => {
  const m = mocks(t, { dayCounts: dc(['2026-09-02', 1], ['2026-10-01', 2], ['2026-10-13', 1], ['2026-10-14', 3]) });
  const res = await get(await build(t), `/users/${OTHER}/profile?${QS}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    user: { id: OTHER, name: 'Bia', username: 'bia', photo_url: `${PUB}/bia.jpg`, fitness_level: 'INTERMEDIÁRIO' },
    is_me: false,
    streak: { current: 2, longest: 2 },
    month: { active_days: 3, activities: 6, active_days_delta: 2 },
    total_activities: 7,
    calendar: {
      start: '2025-10-12',
      end: '2026-10-14',
      days: [
        { date: '2026-09-02', count: 1 }, { date: '2026-10-01', count: 2 },
        { date: '2026-10-13', count: 1 }, { date: '2026-10-14', count: 3 },
      ],
    },
  });
  assert.deepEqual(m.shares.mock.calls[0].arguments, [USER, OTHER]);
  assert.equal(m.profile.mock.calls[0].arguments[0], OTHER);
  const [uid, opts] = m.days.mock.calls[0].arguments;
  assert.equal(uid, OTHER);
  assert.equal(opts.tzOffsetMin, -180);
  // Nada datado depois do fim do dia local de quem vê entra na conta (Review Focus 1).
  assert.equal(opts.before.toISOString(), '2026-10-15T03:00:00.000Z');
});

test('GET /users/:id/profile: o próprio usuário vê sem grupo (sharesGroup nem é chamado); is_me true', async (t) => {
  const m = mocks(t, { shares: false, profile: profileRow({ user_id: USER, name: 'Ana', username: 'ana', photo_url: null, fitness_level: null }) });
  const res = await get(await build(t), `/users/${USER}/profile?${QS}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().is_me, true);
  assert.deepEqual(res.json().user, { id: USER, name: 'Ana', username: 'ana', photo_url: null, fitness_level: null });
  assert.equal(m.shares.mock.callCount(), 0);
});

test('GET /users/:id/profile: UUID do próprio usuário em maiúsculas continua sendo "eu"', async (t) => {
  const m = mocks(t, { shares: false, profile: profileRow({ user_id: USER }) });
  const res = await get(await build(t), `/users/${USER.toUpperCase()}/profile?${QS}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().is_me, true);
  assert.equal(res.json().user.id, USER);
  assert.equal(m.shares.mock.callCount(), 0);
});

test('GET /users/:id/profile: sem grupo em comum ou inexistente → 404 sem nenhum dado (Review Focus 3)', async (t) => {
  for (const [label, shares, profile] of [['sem grupo', false, profileRow()], ['sem perfil', true, null], ['nenhum dos dois', false, null]]) {
    await t.test(label, async (st) => {
      mocks(st, { shares, profile, dayCounts: dc(['2026-10-14', 5]) });
      const res = await get(await build(st), `/users/${OTHER}/profile?${QS}`);
      assert.equal(res.statusCode, 404);
      assert.deepEqual(res.json(), { error: 'Not found' });
    });
  }
});

test('GET /users/:id/profile 400: data inválida, fuso fora da faixa e id fora do padrão nunca chegam ao banco', async (t) => {
  const m = mocks(t);
  const app = await build(t);
  for (const url of [
    `/users/${OTHER}/profile?date=2026-02-31&tz_offset_min=-180`,
    `/users/${OTHER}/profile?date=2026-1-01&tz_offset_min=-180`,
    `/users/${OTHER}/profile?date=2026-10-14`,
    `/users/${OTHER}/profile?date=2026-10-14&tz_offset_min=841`,
    `/users/${OTHER}/profile?date=2026-10-14&tz_offset_min=-841`,
    `/users/abc/profile?${QS}`,
    `/users/urn:uuid:${OTHER}/profile?${QS}`,
  ]) {
    assert.equal((await get(app, url)).statusCode, 400, url);
  }
  assert.equal(m.days.mock.callCount() + m.profile.mock.callCount() + m.shares.mock.callCount(), 0);
});

test('GET /users/:id/profile: lista branca — campo extra vindo do repositório não vaza', async (t) => {
  mocks(t, { profile: { ...profileRow(), email: 'bia@torvtest.dev', weight_kg: 70, birth_date: new Date('1990-01-01') } });
  const body = (await get(await build(t), `/users/${OTHER}/profile?${QS}`)).json();
  assert.deepEqual(Object.keys(body.user).sort(), ['fitness_level', 'id', 'name', 'photo_url', 'username']);
  const raw = JSON.stringify(body);
  for (const k of ['email', 'weight_kg', 'birth_date']) assert.equal(raw.includes(k), false, k);
});

test('GET /users/:id/activities: membro → página dele; página cheia → next_before; sem filtro de tipo', async (t) => {
  const m = mocks(t, { rows: [row(0), row(1, { distance_m: '8445.10' })] });
  const res = await get(await build(t), `/users/${OTHER}/activities?limit=2&before=2026-10-15T00:00:00.000Z`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    activities: [
      { id: 'id-0', activity_type: 'STRENGTH', title: 'Treino 0', start_time: '2026-10-14T20:00:00.000Z', duration_sec: 3000, set_count: 3, distance_m: null },
      { id: 'id-1', activity_type: 'STRENGTH', title: 'Treino 1', start_time: '2026-10-13T20:00:00.000Z', duration_sec: 3000, set_count: 3, distance_m: 8445.1 },
    ],
    next_before: '2026-10-13T20:00:00.000Z',
  });
  const [uid, opts] = m.list.mock.calls[0].arguments;
  assert.equal(uid, OTHER);
  assert.equal(opts.limit, 2);
  assert.equal(opts.before.toISOString(), '2026-10-15T00:00:00.000Z');
  assert.equal(opts.type, undefined);
});

test('GET /users/:id/activities: sem grupo em comum → 404 e nenhuma atividade no corpo', async (t) => {
  mocks(t, { shares: false, rows: [row(0)] });
  const res = await get(await build(t), `/users/${OTHER}/activities`);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.json(), { error: 'Not found' });
});

test('GET /users/:id/activities 400: limit e before inválidos não chegam ao banco', async (t) => {
  const m = mocks(t);
  const app = await build(t);
  for (const qs of ['limit=0', 'limit=51', 'before=ontem', 'before=2026-10-01T10:00:00-03']) {
    assert.equal((await get(app, `/users/${OTHER}/activities?${qs}`)).statusCode, 400, qs);
  }
  assert.equal(m.list.mock.callCount(), 0);
});
```

`BackEndTorv/src/routes/tests/activities.routes.test.js`. Três mudanças:

1. No helper `row`, acrescentar `distance_m: null` ao objeto base. No 1º teste (`limit padrão 20`), acrescentar `distance_m: null` aos dois itens esperados.
2. Novo teste, logo depois do 1º:

```js
test('GET /activities: distance_m Decimal vira número no item', async (t) => {
  t.mock.method(activitiesRepository, 'listActivities', async () => [row(0, { distance_m: '8445.10' })]);
  const res = await get(await build(t), '/activities');
  assert.equal(res.json().activities[0].distance_m, 8445.1);
});
```

3. O bloco do `/summary` passa a mockar `dayCounts` no lugar de `strengthDays`. Substituir o helper `summary` por:

```js
// /summary: o repository (mockado) devolve os dias LOCAIS com contagem; a conversão UTC→local é do SQL.
async function summary(t, { days = [], calories = 0, qs = 'date=2026-10-06&tz_offset_min=-180' } = {}) {
  const dayCounts = t.mock.method(activitiesRepository, 'dayCounts', async () => days.map((day) => ({ day, count: 1 })));
  const caloriesBetween = t.mock.method(activitiesRepository, 'caloriesBetween', async () => calories);
  const res = await get(await build(t), `/activities/summary?${qs}`);
  return { res, dayCounts, caloriesBetween };
}
```

No teste `GET /activities/summary: fuso — ...`, trocar `const { strengthDays, caloriesBetween } = ...` por `const { dayCounts, caloriesBetween } = ...` e `strengthDays.mock.calls[0]` por `dayCounts.mock.calls[0]`. Os demais testes do summary não mudam: os dias vêm em ordem decrescente, e `currentStreak` aceita qualquer ordem.

`BackEndTorv/src/routes/tests/profile.routes.test.js`:
- no `userRow`, apagar as linhas `user_streaks: null,` e `workout_counts: { total: 0, month: 0 },`;
- acrescentar:

```js
test('GET /profile: streak e contagens saíram (o app usa GET /users/:id/profile)', async (t) => {
  t.mock.method(profileRepository, 'getUserProfile', async () => userRow({ ...baseProfile, welcomed_at: null }));
  const res = await (await build(t)).inject({ method: 'GET', url: '/profile' });
  assert.equal(res.statusCode, 200);
  for (const k of ['streak', 'longest_streak', 'workouts_in_month', 'total_workouts']) assert.equal(k in res.json(), false, k);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/routes/tests/users.routes.test.js src/routes/tests/activities.routes.test.js src/routes/tests/profile.routes.test.js`
Expected: FAIL (`Cannot find module '../users.routes'`; summary sem `dayCounts` no controller; os campos ainda presentes no `/profile`).

- [ ] **Step 3: Implementar os schemas e as rotas de atividades**

`BackEndTorv/src/routes/activities.schemas.js`:

```js
const { Type } = require('@sinclair/typebox');

// Tipos que o app conhece. Tipo novo: uma entrada aqui e em ACTIVITY_LABELS no front.
const ACTIVITY_TYPES = ['STRENGTH'];

const ActivityItem = Type.Object({
  id: Type.String(),
  activity_type: Type.String(),
  title: Type.String(),
  start_time: Type.String(),
  duration_sec: Type.Integer(),
  set_count: Type.Integer(),
  distance_m: Type.Union([Type.Number(), Type.Null()]),
});

const ActivityPage = Type.Object({
  activities: Type.Array(ActivityItem),
  next_before: Type.Union([Type.String(), Type.Null()]),
});

// Dia local de quem chama (Home e perfil): o servidor não sabe o fuso do aparelho.
const LocalDayQuery = Type.Object({
  date: Type.String({ pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$', description: 'Dia local do cliente, YYYY-MM-DD' }),
  tz_offset_min: Type.Integer({ minimum: -840, maximum: 840, description: 'Minutos que o relógio local difere de UTC (BRT = -180)' }),
});

module.exports = { ACTIVITY_TYPES, ActivityItem, ActivityPage, LocalDayQuery };
```

`BackEndTorv/src/routes/activities.routes.js`:
- apagar as definições locais de `ACTIVITY_TYPES` e `ActivityPage` e importar de `./activities.schemas`;
- no `/summary`, `querystring: LocalDayQuery` e a descrição nova. O arquivo fica:

```js
const { Type } = require('@sinclair/typebox');
const activitiesController = require('../controller/activities.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { ACTIVITY_TYPES, ActivityPage, LocalDayQuery } = require('./activities.schemas');

const ErrorBody = Type.Object({ error: Type.String() });
const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));

const Summary = Type.Object({ streak_days: Type.Integer(), calories_burned: Type.Integer() });

async function activitiesRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/', {
    schema: {
      description: 'Activities do usuário, mais recente primeiro. Período: from (inclusivo) e before (exclusivo). Próxima página: before = next_before da anterior',
      tags: ['Activities'],
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        type: Type.Optional(Type.Union(ACTIVITY_TYPES.map((t) => Type.Literal(t)))),
        from: Type.Optional(Type.String({ format: 'date-time' })),
        before: Type.Optional(Type.String({ format: 'date-time' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: { 200: ActivityPage, ...errors(400, 401, 403) },
    },
  }, activitiesController.listActivities);

  // Antes de qualquer rota com :id.
  fastify.get('/summary', {
    schema: {
      description: 'Resumo do dia para a Home: streak (dias locais seguidos com atividade de qualquer tipo; viva se teve atividade hoje ou ontem) e calorias do dia local. Dia local = start_time + tz_offset_min',
      tags: ['Activities'],
      security: [{ bearerAuth: [] }],
      querystring: LocalDayQuery,
      response: { 200: Summary, ...errors(400, 401, 403) },
    },
  }, activitiesController.getSummary);
}

module.exports = activitiesRoutes;
```

`BackEndTorv/src/controller/activities.controller.js` (arquivo inteiro):

```js
const activitiesRepository = require('../repository/activities.repository');
const { currentStreak, isCalendarDay, localDayBounds } = require('../lib/activityStats');
const { activityPage } = require('../lib/activityPage');

const DEFAULT_LIMIT = 20;

class ActivitiesController {
  async listActivities(request, reply) {
    const { type, from, before, limit = DEFAULT_LIMIT } = request.query;
    const fromDate = from ? new Date(from) : undefined;
    const beforeDate = before ? new Date(before) : undefined;
    // O date-time do schema aceita formas que o Date do JS não parseia (fuso só com hora, segundo bissexto).
    for (const [name, date] of [['from', fromDate], ['before', beforeDate]]) {
      if (date && Number.isNaN(date.getTime())) {
        return reply.status(400).send({ error: `querystring/${name} must match format "date-time"` });
      }
    }
    const rows = await activitiesRepository.listActivities(request.user.userId, { type, from: fromDate, before: beforeDate, limit });
    return reply.send(activityPage(rows, limit));
  }

  async getSummary(request, reply) {
    const { date, tz_offset_min: tzOffsetMin } = request.query;
    if (!isCalendarDay(date)) {
      return reply.status(400).send({ error: 'querystring/date must be a valid calendar date' });
    }
    const { from, before } = localDayBounds(date, tzOffsetMin);
    const userId = request.user.userId;
    const [dayCounts, caloriesBurned] = await Promise.all([
      activitiesRepository.dayCounts(userId, { before, tzOffsetMin }),
      activitiesRepository.caloriesBetween(userId, { from, before }),
    ]);
    return reply.send({ streak_days: currentStreak(dayCounts.map((r) => r.day), date), calories_burned: caloriesBurned });
  }
}

module.exports = new ActivitiesController();
```

- [ ] **Step 4: Implementar as rotas de membro**

`BackEndTorv/src/controller/users.controller.js`:

```js
const usersRepository = require('../repository/users.repository');
const activitiesRepository = require('../repository/activities.repository');
const images = require('../lib/imageUpload');
const { buildProfileStats, isCalendarDay, localDayBounds } = require('../lib/activityStats');
const { activityPage } = require('../lib/activityPage');

const NOT_FOUND = { error: 'Not found' };
const DEFAULT_LIMIT = 20;

// O próprio usuário, ou quem divide pelo menos um grupo com ele agora. Negado e inexistente respondem o mesmo 404.
const canView = (viewerId, targetId) => viewerId === targetId || usersRepository.sharesGroup(viewerId, targetId);

// Checagem e leitura vão juntas ao banco (1 ida em vez de 3); nada sai na resposta antes de o acesso ser confirmado.
class UsersController {
  async profile(request, reply) {
    const { userId } = request.user;
    const id = request.params.id.toLowerCase();
    const { date, tz_offset_min: tzOffsetMin } = request.query;
    if (!isCalendarDay(date)) {
      return reply.status(400).send({ error: 'querystring/date must be a valid calendar date' });
    }
    const { before } = localDayBounds(date, tzOffsetMin);
    const [allowed, profile, dayCounts] = await Promise.all([
      canView(userId, id),
      usersRepository.getPublicProfile(id),
      activitiesRepository.dayCounts(id, { before, tzOffsetMin }),
    ]);
    if (!allowed || !profile) return reply.status(404).send(NOT_FOUND);
    return reply.send({
      user: {
        id,
        name: profile.name,
        username: profile.username,
        photo_url: images.publicUrl(profile.photo_url),
        fitness_level: profile.fitness_level,
      },
      is_me: id === userId,
      ...buildProfileStats(dayCounts, date),
    });
  }

  async activities(request, reply) {
    const { userId } = request.user;
    const id = request.params.id.toLowerCase();
    const { before, limit = DEFAULT_LIMIT } = request.query;
    const beforeDate = before ? new Date(before) : undefined;
    if (beforeDate && Number.isNaN(beforeDate.getTime())) {
      return reply.status(400).send({ error: 'querystring/before must match format "date-time"' });
    }
    const [allowed, rows] = await Promise.all([
      canView(userId, id),
      activitiesRepository.listActivities(id, { before: beforeDate, limit }),
    ]);
    if (!allowed) return reply.status(404).send(NOT_FOUND);
    return reply.send(activityPage(rows, limit));
  }
}

module.exports = new UsersController();
```

`BackEndTorv/src/routes/users.routes.js`:

```js
const { Type } = require('@sinclair/typebox');
const users = require('../controller/users.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { errors, IdParams } = require('./workout.schemas');
const { ActivityPage, LocalDayQuery } = require('./activities.schemas');

const tags = ['Users'];
const security = [{ bearerAuth: [] }];
const Nullable = (schema) => Type.Union([schema, Type.Null()]);

// Lista branca: o Fastify só serializa o que está aqui.
const MemberProfile = Type.Object({
  user: Type.Object({
    id: Type.String(),
    name: Type.String(),
    username: Type.String(),
    photo_url: Nullable(Type.String()),
    fitness_level: Nullable(Type.String()),
  }),
  is_me: Type.Boolean(),
  streak: Type.Object({ current: Type.Integer(), longest: Type.Integer() }),
  month: Type.Object({ active_days: Type.Integer(), activities: Type.Integer(), active_days_delta: Type.Integer() }),
  total_activities: Type.Integer(),
  calendar: Type.Object({
    start: Type.String(),
    end: Type.String(),
    days: Type.Array(Type.Object({ date: Type.String(), count: Type.Integer() })),
  }),
});

async function usersRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/:id/profile', {
    schema: {
      description: 'Perfil de membro: o próprio usuário ou quem divide um grupo com ele (senão 404). Streak, mês e calendário no dia local de quem vê',
      tags, security, params: IdParams, querystring: LocalDayQuery,
      response: { 200: MemberProfile, ...errors(400, 401, 403, 404) },
    },
  }, users.profile);

  fastify.get('/:id/activities', {
    schema: {
      description: 'Histórico de um membro (mesma regra de acesso), mais recente primeiro. Próxima página: before = next_before',
      tags, security, params: IdParams,
      querystring: Type.Object({
        before: Type.Optional(Type.String({ format: 'date-time' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: { 200: ActivityPage, ...errors(400, 401, 403, 404) },
    },
  }, users.activities);
}

module.exports = usersRoutes;
```

`BackEndTorv/server.js`: logo depois da linha de `/groups` de `groupInvitations.routes`, acrescentar:

```js
fastify.register(require('./src/routes/users.routes'), { prefix: '/users' });
```

- [ ] **Step 5: Limpar o `GET /profile`**

`BackEndTorv/src/repository/profile.repository.js`: o `getUserProfile` inteiro passa a ser:

```js
  // Queries em paralelo (1 RTT) em vez do include, que o Prisma roda em sequência. Mesmo shape do include.
  // Streak e contagens saíram: o app lê de GET /users/:id/profile (lib/activityStats).
  async getUserProfile(userId) {
    const [user, user_profiles, measurement] = await Promise.all([
      prisma.users.findUnique({ where: { id: userId } }),
      prisma.user_profiles.findUnique({ where: { user_id: userId } }),
      prisma.user_measurements.findFirst({ where: { user_id: userId }, orderBy: { recorded_at: 'desc' } }),
    ]);
    if (!user) return null;
    return { ...user, user_profiles, user_measurements: measurement ? [measurement] : [] };
  }
```

`BackEndTorv/src/controller/profile.controller.js`, no `getProfile`:
- apagar `const streaks = user.user_streaks || {};`;
- apagar do objeto enviado as linhas `streak`, `longest_streak`, `workouts_in_month` e `total_workouts`. `followers` e `following` ficam.

`BackEndTorv/src/routes/profile.routes.js`: no `getProfileSchema.response[200]`, apagar `streak`, `longest_streak`, `workouts_in_month` e `total_workouts`.

- [ ] **Step 6: Rodar a suíte inteira e commitar as Tasks 2 e 3 juntas**

Run: `cd BackEndTorv && npm test`
Expected: PASS em tudo. Contagem esperada: 239 da base + 13 (Task 1) + 6 (Task 2) + 12 (`users.routes`: 9 testes, mais 3 subtestes do 404, que o `node --test` também conta) + 1 (`activities.routes`) + 1 (`profile.routes`) = **272**. Se o número diferir, anotar o real no relatório; o que importa é 0 falhas.

Depois, abrir `http://localhost:3000/documentation` **não** é tarefa do recruit: o Furnace é reiniciado pelo Maestro (Task 4).

```bash
git add BackEndTorv/src/lib/activityPage.js BackEndTorv/src/lib/tests/activityPage.test.js \
  BackEndTorv/src/repository/activities.repository.js BackEndTorv/src/repository/users.repository.js \
  BackEndTorv/src/repository/tests/activities.repository.test.js BackEndTorv/src/repository/tests/users.repository.test.js \
  BackEndTorv/src/routes/activities.schemas.js BackEndTorv/src/routes/activities.routes.js BackEndTorv/src/routes/users.routes.js \
  BackEndTorv/src/controller/activities.controller.js BackEndTorv/src/controller/users.controller.js BackEndTorv/server.js \
  BackEndTorv/src/repository/profile.repository.js BackEndTorv/src/controller/profile.controller.js BackEndTorv/src/routes/profile.routes.js \
  BackEndTorv/src/routes/tests/users.routes.test.js BackEndTorv/src/routes/tests/activities.routes.test.js BackEndTorv/src/routes/tests/profile.routes.test.js
git commit -m "feat(users): member profile and history routes; streak counts any activity type" -- BackEndTorv/src/lib/activityPage.js BackEndTorv/src/lib/tests/activityPage.test.js BackEndTorv/src/repository/activities.repository.js BackEndTorv/src/repository/users.repository.js BackEndTorv/src/repository/tests/activities.repository.test.js BackEndTorv/src/repository/tests/users.repository.test.js BackEndTorv/src/routes/activities.schemas.js BackEndTorv/src/routes/activities.routes.js BackEndTorv/src/routes/users.routes.js BackEndTorv/src/controller/activities.controller.js BackEndTorv/src/controller/users.controller.js BackEndTorv/server.js BackEndTorv/src/repository/profile.repository.js BackEndTorv/src/controller/profile.controller.js BackEndTorv/src/routes/profile.routes.js BackEndTorv/src/routes/tests/users.routes.test.js BackEndTorv/src/routes/tests/activities.routes.test.js BackEndTorv/src/routes/tests/profile.routes.test.js
```

---

### Task 4: Teste da etapa de Backend (e reinício do Furnace)

**Recruit:** Torv Review and Tests (depois de o Maestro reiniciar o Furnace) · **Files:**
- Create: `docs/qa-member-profile-backend-2026-10-14.md`

- [ ] **Step 1 (Maestro): reiniciar o Furnace** e conferir em `http://localhost:3000/documentation` a tag `Users` com as duas rotas.

- [ ] **Step 2: Automatizados** — `npm test` em `BackEndTorv` → 0 falhas; anotar o total (base 239).

- [ ] **Step 3: Contrato ao vivo, com 3 contas QA**

As contas: **A**, dona de um grupo; **B**, membro do grupo; **C**, fora de qualquer grupo com A. A chama `http://localhost:3000` com o próprio token.

1. **Acesso:**
   - `GET /users/<B>/profile?date=<hoje local>&tz_offset_min=-180` → 200, `is_me:false`;
   - `<A>` → 200, `is_me:true` (também com o UUID em maiúsculas);
   - `<C>` → 404 `{ "error": "Not found" }`;
   - um UUID aleatório → o **mesmo** 404.
2. **Lista branca:** o corpo de B não tem e-mail, peso, altura, idade, gênero, objetivo nem data de nascimento.
3. **Números:** dar a B treinos reais pelo `POST /workouts/sessions`, hoje e ontem (a janela é de 72 h). Por SQL via Prisma, só na conta B, inserir atividades `STRENGTH` antigas:
   - 3 no mês passado, sendo 2 até o mesmo dia de hoje;
   - 1 há 11 meses;
   - 1 há 13 meses (fora do calendário).

   Comparar `streak`, `month`, `total_activities` e `calendar.days` com a consulta direta:

```sql
SELECT to_char((start_time AT TIME ZONE 'UTC') + interval '-180 minutes', 'YYYY-MM-DD') AS day, COUNT(*)::int
FROM activities WHERE user_id = '<B>' AND start_time IS NOT NULL GROUP BY 1 ORDER BY 1;
```

4. **Histórico:** `GET /users/<B>/activities?limit=2` → 2 itens com `distance_m: null` e `next_before`. A página seguinte, com `before = next_before`, continua sem repetir. `<C>` → 404.
5. **400:**
   - `date=2026-02-31`;
   - `tz_offset_min=841`;
   - `/users/abc/profile`;
   - `limit=51`;
   - `before=ontem`.
6. **Home:** `GET /activities/summary` de B traz o mesmo `streak_days` que `streak.current`. Inserir por SQL uma atividade de B com `activity_type = 'TEST_OTHER'` no dia de hoje, num dia sem treino: o streak conta o dia. Apagar a linha depois.
7. **`GET /profile`** de A não traz mais `streak`, `longest_streak`, `workouts_in_month` nem `total_workouts`.

- [ ] **Step 4: Meia-noite local (Review Focus 1)**

1. Criar para B, via SQL, uma atividade às **23:50 locais de anteontem** (BRT, ou seja, 02:50Z de ontem).
2. `GET /users/<B>/profile` com `tz_offset_min=-180` → o dia é **anteontem** no `calendar.days`.
3. Com `tz_offset_min=0` → o dia é **ontem**.
4. Registrar os dois resultados.

- [ ] **Step 5: Relatório e limpeza**

Gravar `docs/qa-member-profile-backend-2026-10-14.md` com PASS/FAIL por item e achados com severidade. Apagar as contas e os dados de teste, com a contagem antes/depois (`users`, `activities`, `groups`).

**Se algo falhar:** o ciclo **não** avança. O Maestro reabre só a task responsável (1, 2 ou 3) numa nova rodada (`-round2`).

- [ ] **Step 6: Commit**

```bash
git add docs/qa-member-profile-backend-2026-10-14.md
git commit -m "docs(qa): member profile backend stage report" -- docs/qa-member-profile-backend-2026-10-14.md
```

---

### Task 5: Frontend — serviços e utilitários puros

**Recruit:** Torv Frontend · **Files:**
- Create:
  - `FrontEndTorv/src/services/users.ts`
  - `FrontEndTorv/src/utils/heatmap.ts`, `FrontEndTorv/src/utils/heatmap.test.mjs`
  - `FrontEndTorv/src/utils/profileStats.ts`, `FrontEndTorv/src/utils/profileStats.test.mjs`
  - `FrontEndTorv/src/utils/activityMeta.ts`
- Modify: `FrontEndTorv/src/services/activities.ts` (`distance_m`)

**Interfaces:**
- Produces:
  - `usersApi.profile(id, LocalDayQuery) → Promise<MemberProfileData>`
  - `usersApi.activities(id, { before?, limit? }) → Promise<ActivityPage>`
  - `localDayQuery(now?) → { date, tz_offset_min }`
  - `buildHeatmap(start, end, days) → HeatmapData`
  - `heatLevel(count)`
  - `cellLabel(cell)`
  - `cellAt(x, y, size, gap)`
  - `deltaLabel(n)`
  - `plural(n, one, many)`
  - `activityMeta(item, { date? })`

- [ ] **Step 0:** ler a doc versionada do Expo (`FrontEndTorv/AGENTS.md`).

- [ ] **Step 1: Escrever os testes que falham**

`FrontEndTorv/src/utils/heatmap.test.mjs`:

```js
// Roda com: node --test src/utils/heatmap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeatmap, heatLevel, cellLabel, cellAt } from './heatmap.ts';

test('heatLevel: 0, 1, 2 e 3 ou mais viram 4 níveis', () => {
  assert.deepEqual([0, 1, 2, 3, 7].map(heatLevel), [0, 1, 2, 3, 3]);
});

test('buildHeatmap: 53 semanas de 7 dias; dias depois de end ficam null', () => {
  const h = buildHeatmap('2025-10-12', '2026-10-14', [{ date: '2026-10-14', count: 2 }, { date: '2025-10-12', count: 1 }]);
  assert.equal(h.weeks.length, 53);
  assert.ok(h.weeks.every((w) => w.length === 7));
  assert.deepEqual(h.weeks[0][0], { date: '2025-10-12', count: 1, level: 1 });
  const last = h.weeks[52];
  assert.deepEqual(last[0], { date: '2026-10-11', count: 0, level: 0 }); // domingo
  assert.deepEqual(last[3], { date: '2026-10-14', count: 2, level: 2 }); // quarta = hoje
  assert.deepEqual(last.slice(4), [null, null, null]);
  assert.equal(h.activeDays, 2);
});

test('buildHeatmap: rótulo do mês na coluna do 1º domingo dele', () => {
  const h = buildHeatmap('2025-10-12', '2026-10-14', []);
  assert.deepEqual(h.months.slice(0, 4), [
    { label: 'out', week: 0 }, { label: 'nov', week: 3 }, { label: 'dez', week: 8 }, { label: 'jan', week: 12 },
  ]);
  assert.deepEqual(h.months[h.months.length - 1], { label: 'out', week: 51 });
});

test('buildHeatmap: o 1º rótulo some quando cola no 2º', () => {
  const h = buildHeatmap('2025-10-26', '2026-10-25', []);
  assert.deepEqual(h.months[0], { label: 'nov', week: 1 });
});

test('cellLabel: data curta em pt-BR e quantidade no singular e no plural', () => {
  assert.equal(cellLabel({ date: '2026-10-12', count: 2, level: 2 }), '12 de out. · 2 atividades');
  assert.equal(cellLabel({ date: '2026-05-01', count: 1, level: 1 }), '1 de mai. · 1 atividade');
  assert.equal(cellLabel({ date: '2026-01-09', count: 0, level: 0 }), '9 de jan. · nenhuma atividade');
});

test('cellAt: toque → semana e dia; o espaço vai para o quadrado anterior', () => {
  assert.deepEqual(cellAt(0, 0, 12, 3), { week: 0, day: 0 });
  assert.deepEqual(cellAt(14, 14, 12, 3), { week: 0, day: 0 });
  assert.deepEqual(cellAt(15, 46, 12, 3), { week: 1, day: 3 });
  assert.deepEqual(cellAt(10, 200, 12, 3), { week: 0, day: 6 });
  assert.equal(cellAt(-1, 5, 12, 3), null);
});
```

`FrontEndTorv/src/utils/profileStats.test.mjs`:

```js
// Roda com: node --test src/utils/profileStats.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { deltaLabel, plural } from './profileStats.ts';

test('deltaLabel: sinal, zero e sinal de menos tipográfico', () => {
  assert.equal(deltaLabel(2), '+2 vs mês passado');
  assert.equal(deltaLabel(-1), '−1 vs mês passado');
  assert.equal(deltaLabel(0), 'Igual ao mês passado');
});

test('plural: singular só para 1', () => {
  assert.equal(plural(1, 'dia', 'dias'), '1 dia');
  assert.equal(plural(0, 'dia', 'dias'), '0 dias');
  assert.equal(plural(12, 'atividade', 'atividades'), '12 atividades');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd FrontEndTorv && node --test src/utils/heatmap.test.mjs src/utils/profileStats.test.mjs`
Expected: FAIL (`Cannot find module` para os dois `.ts`).

- [ ] **Step 3: Implementar**

`FrontEndTorv/src/utils/heatmap.ts`:

```ts
// Calendário de atividade no estilo do GitHub: colunas = semanas (domingo a sábado), linhas = dias da semana.
// Sem imports de runtime: o teste roda direto no node (type stripping), que não resolve import relativo sem extensão.

export interface HeatCell {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3;
}

export interface HeatmapData {
  weeks: (HeatCell | null)[][]; // 7 posições por semana; null = dia depois de `end`
  months: { label: string; week: number }[]; // mês que começa na coluna `week`
  activeDays: number;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DAY_MS = 86400000;
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// 0, 1, 2 e 3+ atividades no dia.
export const heatLevel = (count: number): HeatCell['level'] => (count <= 0 ? 0 : count >= 3 ? 3 : (count as 1 | 2));

// start é sempre um domingo (o backend manda assim). Monta semanas até a que contém `end`.
export function buildHeatmap(start: string, end: string, days: { date: string; count: number }[]): HeatmapData {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const endMs = toMs(end);
  const weeks: (HeatCell | null)[][] = [];
  const months: { label: string; week: number }[] = [];
  let lastMonth = -1;
  for (let weekStart = toMs(start); weekStart <= endMs; weekStart += 7 * DAY_MS) {
    const week: (HeatCell | null)[] = [];
    for (let i = 0; i < 7; i += 1) {
      const ms = weekStart + i * DAY_MS;
      if (ms > endMs) {
        week.push(null);
        continue;
      }
      const date = toDay(ms);
      const count = counts.get(date) ?? 0;
      week.push({ date, count, level: heatLevel(count) });
    }
    // Rótulo na 1ª coluna cujo domingo cai no mês, como no GitHub.
    const month = new Date(weekStart).getUTCMonth();
    if (month !== lastMonth) {
      months.push({ label: MONTHS[month], week: weeks.length });
      lastMonth = month;
    }
    weeks.push(week);
  }
  // O 1º mês, cortado no começo da janela, colaria no rótulo seguinte: sai.
  if (months.length > 1 && months[1].week - months[0].week < 3) months.shift();
  const activeDays = days.filter((d) => d.count > 0 && d.date >= start && d.date <= end).length;
  return { weeks, months, activeDays };
}

// "12 de out. · 2 atividades"
export function cellLabel(cell: HeatCell): string {
  const [, month, day] = cell.date.split('-').map(Number);
  const what = cell.count === 0 ? 'nenhuma atividade' : cell.count === 1 ? '1 atividade' : `${cell.count} atividades`;
  return `${day} de ${MONTHS[month - 1]}. · ${what}`;
}

// Célula sob o toque, com x/y relativos à grade. O espaço entre quadrados conta para o quadrado anterior;
// abaixo da última linha vale o sábado. A semana pode passar do fim: quem chama confere.
export function cellAt(x: number, y: number, size: number, gap: number): { week: number; day: number } | null {
  if (x < 0 || y < 0) return null;
  const pitch = size + gap;
  return { week: Math.floor(x / pitch), day: Math.min(6, Math.floor(y / pitch)) };
}
```

`FrontEndTorv/src/utils/profileStats.ts`:

```ts
// Textos dos cards do perfil (o próprio e o de membro). Sem imports: testado direto no node.

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "+2 vs mês passado", "−1 vs mês passado" (sinal de menos tipográfico) ou "Igual ao mês passado".
export const deltaLabel = (delta: number) =>
  delta === 0 ? 'Igual ao mês passado' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs mês passado`;
```

`FrontEndTorv/src/utils/activityMeta.ts` (sem teste, porque importa `./clock` em runtime):

```ts
import type { ActivityItem } from '../services/activities';
import { formatClock } from './clock';

const pad = (n: number) => String(n).padStart(2, '0');

// Linha de detalhes de um item de atividade: "12/10 · 11:08 · 47:57 · 18 séries". Data e hora no fuso do aparelho.
export function activityMeta(item: ActivityItem, { date = false }: { date?: boolean } = {}): string {
  const d = new Date(item.start_time);
  const parts: string[] = [];
  if (date) parts.push(`${pad(d.getDate())}/${pad(d.getMonth() + 1)}`);
  parts.push(`${pad(d.getHours())}:${pad(d.getMinutes())}`, formatClock(item.duration_sec));
  if (item.activity_type === 'STRENGTH') parts.push(`${item.set_count} ${item.set_count === 1 ? 'série' : 'séries'}`);
  return parts.join(' · ');
}
```

`FrontEndTorv/src/services/activities.ts`: em `ActivityItem`, depois de `set_count: number;`, acrescentar:

```ts
  distance_m: number | null; // metros; null na musculação (o GPX preenche)
```

`FrontEndTorv/src/services/users.ts`:

```ts
import api from './api';
import type { ActivityPage } from './activities';
import { toISODate } from '../utils/date';

// Contrato de /users/:id/* (spec docs/superpowers/specs/2026-10-14-member-profile-design.md).
export interface MemberProfileData {
  user: { id: string; name: string; username: string; photo_url: string | null; fitness_level: string | null };
  is_me: boolean;
  streak: { current: number; longest: number };
  month: { active_days: number; activities: number; active_days_delta: number };
  total_activities: number;
  calendar: { start: string; end: string; days: { date: string; count: number }[] };
}

// Dia LOCAL do aparelho (AAAA-MM-DD) e o fuso, como a Home manda para /activities/summary.
export interface LocalDayQuery {
  date: string;
  tz_offset_min: number;
}

export const localDayQuery = (now = new Date()): LocalDayQuery => ({ date: toISODate(now), tz_offset_min: -now.getTimezoneOffset() });

export const usersApi = {
  profile: (id: string, query: LocalDayQuery) =>
    api.get<MemberProfileData>(`/users/${id}/profile`, { params: query }).then((r) => r.data),
  activities: (id: string, query: { before?: string; limit?: number } = {}) =>
    api.get<ActivityPage>(`/users/${id}/activities`, { params: query }).then((r) => r.data),
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd FrontEndTorv && node --test src/utils/*.test.mjs && npx tsc --noEmit`
Expected: PASS. São 49 da base + 6 (`heatmap`) + 2 (`profileStats`) = **57**, e o `tsc` não mostra erros.

- [ ] **Step 5: Commit**

```bash
git add FrontEndTorv/src/services/users.ts FrontEndTorv/src/services/activities.ts FrontEndTorv/src/utils/heatmap.ts FrontEndTorv/src/utils/heatmap.test.mjs FrontEndTorv/src/utils/profileStats.ts FrontEndTorv/src/utils/profileStats.test.mjs FrontEndTorv/src/utils/activityMeta.ts
git commit -m "feat(front): users API client and heatmap/profile stat helpers" -- FrontEndTorv/src/services/users.ts FrontEndTorv/src/services/activities.ts FrontEndTorv/src/utils/heatmap.ts FrontEndTorv/src/utils/heatmap.test.mjs FrontEndTorv/src/utils/profileStats.ts FrontEndTorv/src/utils/profileStats.test.mjs FrontEndTorv/src/utils/activityMeta.ts
```

---

### Task 6: Frontend — `ActivityHeatmap`, tela `MemberProfile` e as entradas

**Recruit:** Torv Frontend · **Files:**
- Create:
  - `FrontEndTorv/src/components/ActivityHeatmap/index.tsx`, `styles.ts`
  - `FrontEndTorv/src/screens/MemberProfile/index.tsx`, `styles.ts`
- Modify:
  - `FrontEndTorv/src/routes/types.ts`
  - `FrontEndTorv/src/routes/PrivateRoutes/index.tsx`
  - `FrontEndTorv/src/screens/GroupDetail/index.tsx`
  - `FrontEndTorv/src/screens/GroupManage/index.tsx`

**Interfaces:**
- Consumes: tudo da Task 5.
- Produces:
  - `<ActivityHeatmap start end days />`, usado de novo na Task 7;
  - a rota `MemberProfile: { userId: string }`.

- [ ] **Step 1: Componente `ActivityHeatmap`**

As medidas (`CELL`, `GAP`) são usadas pelo `cellAt`, por isso vêm do `styles.ts`. O visual (cores dos níveis, tipografia) passa por `/frontend-design`, mantendo:
- 4 níveis distintos, do `surfaceAlt` (nenhuma atividade) até `colors.brand` (3 ou mais);
- quadrado de 12 e espaço de 3.

`FrontEndTorv/src/components/ActivityHeatmap/styles.ts` (ponto de partida):

```ts
import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../../theme/tokens';

export const CELL = 12;
export const GAP = 3;
const MONTH_ROW = 16;
// Nível 0 = sem atividade; 1, 2 e 3+ atividades no dia vão do verde escuro até a cor da marca.
export const LEVEL_COLORS = [colors.surfaceAlt, '#2F4A1A', colors.brandDark, colors.brand];

export const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  weekdays: { marginTop: MONTH_ROW, marginRight: 6 },
  weekday: { height: CELL, marginBottom: GAP, fontSize: 9, lineHeight: CELL, color: colors.textSecondary, fontFamily: fontFamily.regular },
  months: { height: MONTH_ROW },
  month: { position: 'absolute', top: 0, fontSize: 10, color: colors.textSecondary, fontFamily: fontFamily.regular },
  // pointerEvents no estilo (a prop está depreciada): o toque cai na grade, e o locationX/Y sai relativo a ela.
  grid: { flexDirection: 'row', pointerEvents: 'none' },
  week: { marginRight: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3, marginBottom: GAP },
  cellSelected: { borderWidth: 1.5, borderColor: colors.text },
  footer: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  selected: { color: colors.textMuted, fontSize: 12, fontFamily: fontFamily.regular, flexShrink: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendText: { color: colors.textSecondary, fontSize: 10, fontFamily: fontFamily.regular, marginHorizontal: 2 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
});
```

`FrontEndTorv/src/components/ActivityHeatmap/index.tsx`:

```tsx
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, type GestureResponderEvent } from 'react-native';

import { buildHeatmap, cellAt, cellLabel, type HeatCell } from '../../utils/heatmap';
import { CELL, GAP, LEVEL_COLORS, styles } from './styles';

interface Props {
  start: string;
  end: string;
  days: { date: string; count: number }[];
}

// Linhas 1, 3 e 5 (segunda, quarta e sexta), como no GitHub.
const WEEKDAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''];

export function ActivityHeatmap({ start, end, days }: Props) {
  const data = useMemo(() => buildHeatmap(start, end, days), [start, end, days]);
  const [selected, setSelected] = useState<HeatCell | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pitch = CELL + GAP;

  // Um único alvo de toque para a grade inteira (371 botões seriam pesados e poluiriam o leitor de tela).
  // styles.grid tem pointerEvents 'none' para o locationX/Y sair relativo à grade, não ao quadrado tocado.
  const onPress = (e: GestureResponderEvent) => {
    const pos = cellAt(e.nativeEvent.locationX, e.nativeEvent.locationY, CELL, GAP);
    setSelected(pos ? data.weeks[pos.week]?.[pos.day] ?? null : null);
  };

  const summary = `${data.activeDays} ${data.activeDays === 1 ? 'dia ativo' : 'dias ativos'} nos últimos 12 meses`;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.weekdays}>
          {WEEKDAY_LABELS.map((label, i) => <Text key={i} style={styles.weekday}>{label}</Text>)}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Abre na semana atual, como o GitHub no celular.
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View>
            <View style={[styles.months, { width: data.weeks.length * pitch }]}>
              {data.months.map((m) => (
                <Text key={`${m.label}-${m.week}`} style={[styles.month, { left: m.week * pitch }]}>{m.label}</Text>
              ))}
            </View>
            <Pressable onPress={onPress} accessibilityRole="image" accessibilityLabel={summary}>
              <View style={styles.grid}>
                {data.weeks.map((week, w) => (
                  <View key={w} style={styles.week}>
                    {week.map((cell, d) => (
                      <View
                        key={d}
                        style={[
                          styles.cell,
                          { backgroundColor: cell ? LEVEL_COLORS[cell.level] : 'transparent' },
                          cell !== null && selected?.date === cell.date && styles.cellSelected,
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.selected}>{selected ? cellLabel(selected) : 'Toque num dia para ver o total'}</Text>
        <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.legendText}>Menos</Text>
          {LEVEL_COLORS.map((c) => <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />)}
          <Text style={styles.legendText}>Mais</Text>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Rota**

`FrontEndTorv/src/routes/types.ts`: em `AppStackParamList`, depois de `JoinGroup`, acrescentar:

```ts
  MemberProfile: { userId: string }; // perfil de outro membro (ou o próprio): GET /users/:id/profile
```

`FrontEndTorv/src/routes/PrivateRoutes/index.tsx`:
- `import MemberProfileScreen from '../../screens/MemberProfile';` junto dos outros imports de tela;
- `<Stack.Screen name="MemberProfile" component={MemberProfileScreen} />` depois de `JoinGroup`.

- [ ] **Step 3: Tela `MemberProfile`**

A lógica está abaixo; o `styles.ts` passa por `/frontend-design`, no visual do `Profile` (cards em grade, fundo escuro, verde da marca). Chaves usadas:
- `container`, `header`, `back`, `headerTitle`, `loading`, `centered`, `muted`, `mutedSmall`;
- `scroll`, `identity`, `avatar`, `avatarEmpty`, `avatarInitial`, `name`, `username`, `levelChip`, `levelText`;
- `grid`, `gridCard`, `cardTitleRow`, `cardTitle`, `cardValue`, `cardSub`, `cardHighlight`;
- `calendarCard`, `sectionTitle`;
- `item`, `itemIcon`, `itemInfo`, `itemTitle`, `itemMeta`, `empty`, `footer`.

Regras do layout:
- em 320 px, o nome quebra em até 2 linhas e o `@username` fica em 1;
- os dois cards ficam lado a lado e encolhem sem cortar;
- o calendário rola só dentro do card.

`FrontEndTorv/src/screens/MemberProfile/index.tsx`:

```tsx
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { ArrowLeft, Flame, Dumbbell, Activity } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ActivityHeatmap } from '../../components/ActivityHeatmap';
import { usersApi, localDayQuery, type MemberProfileData } from '../../services/users';
import type { ActivityItem } from '../../services/activities';
import { activityLabel } from '../../utils/activities';
import { activityMeta } from '../../utils/activityMeta';
import { deltaLabel, plural } from '../../utils/profileStats';
import { FITNESS_LEVELS, fitnessLevelLabel } from '../../utils/profileOptions';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Status = 'loading' | 'ready' | 'missing' | 'error';
const PAGE = 20;

export default function MemberProfile() {
  const navigation = useNavigation<AppNavigation>();
  const { userId } = useRoute<RouteProp<AppStackParamList, 'MemberProfile'>>().params;
  const [data, setData] = useState<MemberProfileData | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0); // resposta de uma carga antiga chega depois → descarta

  const load = async (refresh = false) => {
    const id = ++request.current;
    if (refresh) setRefreshing(true);
    try {
      const [profile, page] = await Promise.all([
        usersApi.profile(userId, localDayQuery()),
        usersApi.activities(userId, { limit: PAGE }),
      ]);
      if (id !== request.current) return;
      setData(profile);
      setItems(page.activities);
      setNextBefore(page.next_before);
      setStatus('ready');
    } catch (error) {
      if (id !== request.current) return;
      // 404: saiu do grupo (ou nunca dividiu um). Some tudo da tela, nada de dado antigo.
      const missing = axios.isAxiosError(error) && error.response?.status === 404;
      if (missing) setData(null);
      setStatus(missing ? 'missing' : data ? 'ready' : 'error');
    } finally {
      if (id === request.current) setRefreshing(false);
    }
  };

  // Volta de outra tela: dados frescos (o membro pode ter treinado ou saído do grupo).
  useFocusEffect(useCallback(() => { load(); }, [userId]));

  const loadMore = async () => {
    if (!nextBefore || loadingMore || status !== 'ready') return;
    const id = request.current;
    setLoadingMore(true);
    try {
      const page = await usersApi.activities(userId, { before: nextBefore, limit: PAGE });
      if (id !== request.current) return;
      setItems((prev) => [...prev, ...page.activities]);
      setNextBefore(page.next_before);
    } catch {
      // Falhou ao paginar: fica o que já está na tela; o próximo fim de lista tenta de novo.
    } finally {
      setLoadingMore(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.text} size={26} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Perfil</Text>
    </View>
  );

  if (status === 'loading') {
    return <SafeAreaView style={styles.container}>{header}<ActivityIndicator color={colors.brand} style={styles.loading} /></SafeAreaView>;
  }
  if (status !== 'ready' || !data) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.muted}>{status === 'missing' ? 'Perfil indisponível.' : 'Não foi possível carregar o perfil.'}</Text>
          {status === 'missing' && <Text style={styles.mutedSmall}>Vocês não estão mais em um grupo em comum.</Text>}
          {status === 'error' && <Button title="Tentar de novo" outline onPress={() => { setStatus('loading'); load(); }} />}
        </View>
      </SafeAreaView>
    );
  }

  const { user, streak, month, calendar } = data;
  const level = FITNESS_LEVELS.find((l) => l.value === user.fitness_level);

  const top = (
    <View>
      <View style={styles.identity}>
        {user.photo_url ? (
          <Image source={{ uri: user.photo_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.avatarEmpty}><Text style={styles.avatarInitial}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text></View>
        )}
        <Text style={styles.name} numberOfLines={2}>{data.is_me ? `${user.name} (você)` : user.name}</Text>
        <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
        <View style={[styles.levelChip, level && { borderColor: level.color }]}>
          <Text style={[styles.levelText, level && { color: level.color }]}>Nível físico: {fitnessLevelLabel(user.fitness_level)}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <Card style={styles.gridCard}>
          <View style={styles.cardTitleRow}>
            <Flame color={colors.textSecondary} size={14} />
            <Text style={styles.cardTitle}>Streak</Text>
          </View>
          <Text style={styles.cardValue}>{streak.current}</Text>
          <Text style={styles.cardSub}>{streak.current === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
          <Text style={styles.cardHighlight}>Recorde: {plural(streak.longest, 'dia', 'dias')}</Text>
        </Card>
        <Card style={styles.gridCard}>
          <Text style={styles.cardTitle}>Este mês</Text>
          <Text style={styles.cardValue}>{month.active_days}</Text>
          <Text style={styles.cardSub}>{month.active_days === 1 ? 'dia ativo' : 'dias ativos'} · {plural(month.activities, 'atividade', 'atividades')}</Text>
          <Text style={styles.cardHighlight}>{deltaLabel(month.active_days_delta)}</Text>
        </Card>
      </View>

      <Card style={styles.calendarCard}>
        <Text style={styles.sectionTitle}>Atividade nos últimos 12 meses</Text>
        <ActivityHeatmap start={calendar.start} end={calendar.end} days={calendar.days} />
      </Card>

      <Text style={styles.sectionTitle}>Histórico</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={top}
        renderItem={({ item }) => (
          // Sem toque: o detalhe da atividade de outra pessoa fica de fora (spec).
          <Card style={styles.item}>
            <View style={styles.itemIcon}>
              {item.activity_type === 'STRENGTH' ? <Dumbbell color={colors.brand} size={20} /> : <Activity color={colors.brand} size={20} />}
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title || activityLabel(item.activity_type)}</Text>
              <Text style={styles.itemMeta}>{activityMeta(item, { date: true })}</Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Card style={styles.empty}><Text style={styles.muted}>Nenhuma atividade ainda.</Text></Card>}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={styles.footer} /> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Entradas**

`FrontEndTorv/src/screens/GroupDetail/index.tsx`: no `ranking.map`, a linha `<View key={r.user_id} style={[styles.row, ...]} accessibilityLabel={...}>` vira um botão. As classes de estilo e o conteúdo não mudam:

```tsx
              <TouchableOpacity
                key={r.user_id}
                style={[styles.row, r.is_me && styles.rowMe, r.position <= 3 && styles.rowTop]}
                onPress={() => navigation.navigate('MemberProfile', { userId: r.user_id })}
                accessibilityRole="button"
                accessibilityLabel={`${r.position}º, ${r.name}, ${plural(r.total_points, 'dia', 'dias')}${r.is_me ? ', você' : ''}. Abrir perfil`}
              >
```

O `</View>` correspondente vira `</TouchableOpacity>`. `TouchableOpacity` já é importado.

`FrontEndTorv/src/screens/GroupManage/index.tsx`: o `personRow` ganha um 3º parâmetro opcional, `onOpen`. Só a lista de **membros** o passa; pedidos e convites são de quem ainda não é membro, e o backend responderia 404:

```tsx
  // Nome e @ abrem o perfil (só membros); as ações ficam IRMÃS do botão, nunca dentro (botão em botão quebra no web).
  const personRow = (p: { id: string; name: string; username: string }, actions: React.ReactNode, onOpen?: () => void) => {
    const body = (
      <>
        <Text style={styles.personName} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.personUser} numberOfLines={1}>@{p.username}</Text>
      </>
    );
    return (
      <View key={p.id} style={styles.personRow}>
        {onOpen ? (
          <TouchableOpacity style={styles.personBody} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Ver perfil de ${p.name}`}>
            {body}
          </TouchableOpacity>
        ) : (
          <View style={styles.personBody}>{body}</View>
        )}
        {actions}
      </View>
    );
  };
```

Na lista de membros, passar o 3º argumento:

```tsx
          {members.map((m) => personRow({ id: m.user_id, name: m.name, username: m.username }, (
            m.is_me ? <Text style={styles.you}>você</Text> : (
              <TouchableOpacity style={styles.iconButton} onPress={() => setConfirm({ kind: 'remove', row: m })} accessibilityRole="button" accessibilityLabel={`Remover ${m.name}`}><Trash2 color={colors.error} size={20} /></TouchableOpacity>
            )
          ), () => navigation.navigate('MemberProfile', { userId: m.user_id })))}
```

Conferir se `styles.personBody` garante pelo menos 44 px de altura de toque; se não garantir, ajustar `minHeight: 44` e `justifyContent: 'center'` no `styles.ts` do `GroupManage`.

- [ ] **Step 5: Verificar**

Run: `cd FrontEndTorv && node --test src/utils/*.test.mjs && npx tsc --noEmit`
Expected: 57 PASS, sem erros de tipo.

Abrir o app no portal TorvWeb, ir a um grupo e tocar numa linha do ranking. O perfil abre, o calendário rola e o toque num dia mostra a data. É só uma conferência rápida, sem relatório; a usabilidade completa é a Task 8.

- [ ] **Step 6: Commit**

```bash
git add FrontEndTorv/src/components/ActivityHeatmap FrontEndTorv/src/screens/MemberProfile FrontEndTorv/src/routes/types.ts FrontEndTorv/src/routes/PrivateRoutes/index.tsx FrontEndTorv/src/screens/GroupDetail/index.tsx FrontEndTorv/src/screens/GroupManage/index.tsx FrontEndTorv/src/screens/GroupManage/styles.ts
git commit -m "feat(front): member profile screen with activity heatmap, opened from ranking and members" -- FrontEndTorv/src/components/ActivityHeatmap FrontEndTorv/src/screens/MemberProfile FrontEndTorv/src/routes/types.ts FrontEndTorv/src/routes/PrivateRoutes/index.tsx FrontEndTorv/src/screens/GroupDetail/index.tsx FrontEndTorv/src/screens/GroupManage/index.tsx FrontEndTorv/src/screens/GroupManage/styles.ts
```

(Se o `GroupManage/styles.ts` não mudou, tirá-lo dos dois comandos.)

---

### Task 7: Frontend — Perfil próprio no endpoint novo

**Recruit:** Torv Frontend · **Files:**
- Modify: `FrontEndTorv/src/screens/Profile/index.tsx`, `FrontEndTorv/src/screens/Profile/styles.ts`

**Interfaces:**
- Consumes: `usersApi`, `localDayQuery`, `MemberProfileData` (Task 5), `<ActivityHeatmap>` (Task 6), `deltaLabel`, `plural`, `activityMeta`.

- [ ] **Step 1: Carregar as estatísticas**

1. **Imports:**

```tsx
import { usersApi, localDayQuery, type MemberProfileData } from '../../services/users';
import { ActivityHeatmap } from '../../components/ActivityHeatmap';
import { deltaLabel, plural } from '../../utils/profileStats';
import { activityMeta } from '../../utils/activityMeta';
```

   `Activity` (lucide) já é importado.
2. **Estado:** `const [stats, setStats] = useState<MemberProfileData | null>(null);`
3. **`loadData`:**

   - O `Promise.all` passa a ser:

```tsx
          const [dietResponse, profileResponse, recentSessions, profileStats] = await Promise.all([
            api.get('/diet/summary'),
            api.get('/profile'),
            activitiesApi.list({ limit: 5 }).then((p) => p.activities).catch(() => [] as ActivityItem[]),
            user?.id ? usersApi.profile(user.id, localDayQuery()).catch(() => null) : Promise.resolve(null),
          ]);
          setSessions(recentSessions);
          setStats(profileStats);
```

     (O `type: 'STRENGTH'` saiu: a lista mostra qualquer tipo.)
   - As dependências do `useCallback` passam de `[]` para `[user?.id]`.

- [ ] **Step 2: Trocar os números**

- **Linha de stats:**
  - o 3º item usa `stats?.total_activities ?? 0`;
  - o rótulo passa a ser `atividades`.
- **Card "Streak":**
  - valor `stats?.streak.current ?? 0`;
  - destaque `Recorde: {plural(stats?.streak.longest ?? 0, 'dia', 'dias')}`.
- **Card "Este mês":**

```tsx
          <Card style={styles.gridCard}>
            <Text style={styles.gridCardTitle}>Este mês</Text>
            <Text style={styles.gridCardValue}>{stats?.month.active_days ?? 0}</Text>
            <Text style={styles.gridCardSubtitle}>
              {(stats?.month.active_days ?? 0) === 1 ? 'Dia ativo' : 'Dias ativos'} · {plural(stats?.month.activities ?? 0, 'atividade', 'atividades')}
            </Text>
            {stats && <Text style={styles.gridCardHighlight}>{deltaLabel(stats.month.active_days_delta)}</Text>}
          </Card>
```

- **Seção nova**, logo depois do `gridContainer` (antes de "Objetivo"):

```tsx
        {stats && (
          <Card style={styles.calendarCard}>
            <Text style={styles.calendarTitle}>Atividade nos últimos 12 meses</Text>
            <ActivityHeatmap start={stats.calendar.start} end={stats.calendar.end} days={stats.calendar.days} />
          </Card>
        )}
```

  `calendarCard` e `calendarTitle` entram no `styles.ts` do Profile, seguindo os cards da tela (passar por `/frontend-design`).
- **"Atividade Física":**
  - o ícone é `Dumbbell` para `STRENGTH` e `Activity` para os outros tipos;
  - só `STRENGTH` é botão para o `WorkoutSummary`; os outros tipos viram `View` (o GPX vai ligá-los à tela dele);
  - o subtítulo passa a ser `{activityMeta(s, { date: true })}`;
  - o texto do vazio passa a ser "Nenhuma atividade ainda" / "Suas atividades aparecem aqui."

- [ ] **Step 3: Verificar**

Run: `cd FrontEndTorv && node --test src/utils/*.test.mjs && npx tsc --noEmit`
Expected: 57 PASS, sem erros de tipo.

No portal, a aba Perfil mostra o streak e o recorde da conta, o card do mês com "vs mês passado" e o calendário. Nenhum "+0" fixo sobra.

- [ ] **Step 4: Commit**

```bash
git add FrontEndTorv/src/screens/Profile/index.tsx FrontEndTorv/src/screens/Profile/styles.ts
git commit -m "feat(front): own profile uses member stats (streak, real month delta, calendar, any activity type)" -- FrontEndTorv/src/screens/Profile/index.tsx FrontEndTorv/src/screens/Profile/styles.ts
```

---

### Task 8: Teste da etapa de Frontend (usabilidade no navegador)

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-member-profile-frontend-2026-10-14.md`

- [ ] **Step 1: Automatizados**

Em `FrontEndTorv`: `node --test src/utils/*.test.mjs` e `npx tsc --noEmit` → verdes. Anotar os totais (base 49).

- [ ] **Step 2: Ambiente (Maestro)**

O backend segue no Furnace e o Expo web no terminal "Expo" (porta 8081). O portal **TorvWeb** aponta para `http://localhost:8081`.

- [ ] **Step 3: Fluxos reais, um por um**

As contas: **A** é dona do grupo; **B** é membro, com treinos de hoje e de ontem pelo app, e com atividades antigas por SQL (mês passado e 11 meses atrás, mais de 20 no total para paginar). **C** fica fora.

1. **Pelo ranking:** A abre o grupo, toca em B → `MemberProfile` com:
   - foto ou inicial, nome, @, nível físico;
   - streak e recorde;
   - card do mês com os dois números e o "vs mês passado";
   - calendário;
   - histórico.

   Conferir cada número contra o SQL.
2. **Pelo Gerenciar:** A abre **Gerenciar** e toca no nome de B → o mesmo perfil. O botão de remover continua funcionando separado: o toque no ícone não abre o perfil.
3. **A própria linha:** A toca em si no ranking → o perfil mostra "(você)".
4. **Calendário:**
   - abre na semana atual (o fim da rolagem);
   - rola para os meses antigos;
   - tocar num dia com atividade mostra "D de mês. · N atividades", e num dia vazio, "nenhuma atividade";
   - os níveis de cor batem com 1, 2 e 3 ou mais.
5. **Histórico:** rolar até o fim carrega a 2ª página sem repetir item; o item **não** abre nada.
6. **Saiu do grupo (Review Focus 3):** com o perfil de B aberto em A, B sai do grupo (outra sessão). A puxa para atualizar → "Perfil indisponível", sem os dados antigos na tela.
7. **Conta vazia (Review Focus 2):** uma conta QA nova, sem atividade, entra no grupo. O perfil dela mostra 0, o calendário vazio e "Nenhuma atividade ainda."
8. **320 px e nome longo (Review Focus 5):**
   - redimensionar o portal para 320 px;
   - uma conta QA com nome de 60 caracteres e sem foto: o nome quebra em até 2 linhas, o @ em 1, a inicial aparece e os cards não cortam;
   - o calendário rola sem rolagem horizontal da página;
   - todos os alvos (voltar, linhas do ranking, nomes no Gerenciar) têm pelo menos 44 px.
9. **Perfil próprio:**
   - na aba Perfil, o streak e o recorde são iguais aos do `MemberProfile` de si mesmo;
   - o card do mês mostra o delta real (não "+0");
   - o calendário aparece;
   - "Atividade Física" lista os 5 últimos;
   - o número "atividades" é o total.
10. **Home:** o streak da Home é igual ao do Perfil.

- [ ] **Step 4: Relatório e limpeza**

Gravar `docs/qa-member-profile-frontend-2026-10-14.md` com PASS/FAIL por fluxo, a evidência (árvore de acessibilidade, estilos medidos e SQL) e os achados com severidade. Apagar os dados de teste, com a contagem antes/depois.

**Falha:** o ciclo não avança. O Maestro reabre só a task responsável (5, 6 ou 7), numa rodada `-round2`.

- [ ] **Step 5: Commit**

```bash
git add docs/qa-member-profile-frontend-2026-10-14.md
git commit -m "docs(qa): member profile frontend stage report" -- docs/qa-member-profile-frontend-2026-10-14.md
```

---

### Task 9: Teste completo (HEAD, todas as camadas)

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-member-profile-full-2026-10-14.md`

- [ ] **Step 1: Estado final**

`git status` limpo para os arquivos da feature. Backend no Furnace atualizado e Expo web no ar.

- [ ] **Step 2: Rodada completa**

1. `npm test` (backend), `node --test src/utils/*.test.mjs` e `npx tsc --noEmit` (frontend): totais antes e depois.
2. **Regressão**, cada item com pelo menos um fluxo real no navegador:
   - login e boas-vindas;
   - Home (streak, calorias, dieta);
   - treinos (rotina, sessão, resumo, editar e excluir);
   - histórico com filtros e períodos;
   - grupos (criar, convite, link, ranking, sair);
   - Perfil (foto, objetivo, nível, peso e altura);
   - dieta.
3. **Feature inteira:** repetir os Steps 3 e 4 da Task 4 e os 10 fluxos da Task 8 sobre o estado final.

- [ ] **Step 3: Relatório e commit**

Gravar `docs/qa-member-profile-full-2026-10-14.md` e commitar só ele (`docs(qa): member profile full test report`).

**Falha:** volta ao passo 1 do ciclo, numa nova rodada `-round2`, só na camada que falhou.

---

### Task 10: Security (só com os testes 100% verdes)

**Recruit:** Torv Security · **Files:**
- Create: `docs/security-member-profile-2026-10-14.md`

- [ ] **Step 1: Revisar o diff inteiro pela lente do OWASP Top 10**

O diff é `git diff 2354153..HEAD` (a spec é o `2354153`). Pontos obrigatórios:
- **A01, controle de acesso:**
  - `/users/:id/*` usa sempre o `userId` do token;
  - acesso só para o próprio usuário ou para membro de grupo em comum;
  - 404 igual para negado e inexistente;
  - a checagem roda em paralelo com a leitura, **sem** nada na resposta antes dela (confirmar no código e no teste);
  - `id` em maiúsculas não fura a regra.
- **A04, projeto e minimização:**
  - o schema de resposta é lista branca (`MemberProfile`, `ActivityPage`);
  - nenhum dado de saúde, corpo, contato ou nascimento sai para outros membros;
  - o título das rotinas aparece no histórico do membro. Avaliar e registrar como aceito ou não.
- **A03, injeção:** o `dayCounts` usa só template parametrizado do Prisma, e o fuso entra como `::int` parametrizado.
- **Enumeração:** UUID aleatório e UUID de usuário sem grupo em comum respondem igual, inclusive no tempo (anotar a diferença medida, se houver).
- **Entrada:**
  - faixas de `date`, `tz_offset_min`, `before` e `limit`;
  - o `urn:uuid:` é recusado.
- **Frontend:**
  - nenhum segredo;
  - só a nossa API;
  - nenhum `dangerouslySetInnerHTML`;
  - nenhum `Alert.alert` com dado do servidor.

- [ ] **Step 2: Relatório e commit**

Gravar `docs/security-member-profile-2026-10-14.md` (PASS/FAIL por item, achados com severidade e a correção sugerida) e commitar só ele (`docs(security): member profile OWASP review`).

**Falha:** volta ao passo 1 do ciclo, só nas camadas apontadas. Os testes rodam de novo só no que mudou (nova rodada `-round2`, e `-round2` do Security). A feature só termina com Testing e Security verdes na mesma rodada.

---

## Acompanhamento no canvas (Maestro, durante toda a execução)

Antes da Task 1, o Maestro cria a nota **"Feature- Perfil de membro"** (`maestri note create --name "Feature- Perfil de membro"`), com:
- o nome da feature;
- a etapa (Edit / Test / Security) e o recruit rodando;
- o resultado da última rodada, com o relatório em `docs/`;
- em retrabalho, a camada reaberta e o motivo.

A nota é atualizada a **cada** transição de etapa. O `revisar5.md` sai no fim do subprojeto do GPX, cobrindo os dois.

## Self-review do plano

- **Cobertura da spec:**

  | Item da spec | Task |
  |---|---|
  | Acesso (próprio ou grupo em comum, 404) | 2 e 3 |
  | Contrato do perfil e do histórico | 3 |
  | Streak unificado na Home | 1 e 3 |
  | Mês, delta e calendário | 1 |
  | `distance_m` no item | 2, 3 e 5 |
  | `GET /profile` sem os 4 campos | 3 |
  | Tela, calendário e entradas | 6 |
  | Perfil próprio | 7 |
  | Testes | 4, 8 e 9 |
  | Segurança | 10 |
  | `user_streaks` intocada | sem migration, conforme o fora do escopo |

- **Sem placeholders.** O que o recruit completa é só o visual (`styles.ts` das telas novas, via `/frontend-design`), com as chaves listadas.
- **Tipos consistentes:**
  - `dayCounts(userId, { before, tzOffsetMin })` → `{ day, count }[]`, igual nas Tasks 2, 3 e 4;
  - `buildProfileStats(dayCounts, today)` tem o shape do contrato;
  - `MemberProfileData` espelha o `MemberProfile` do TypeBox;
  - `activityPage(rows, limit)` é o mesmo nas duas rotas;
  - `usersApi.profile/activities`, `localDayQuery`, `buildHeatmap`, `cellAt(x, y, CELL, GAP)` e `deltaLabel` usam os mesmos nomes em todas as tasks.
- **Review Focus:** os 5 itens têm teste na task dona (1, 3, 4 e 8).
