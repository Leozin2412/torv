# Histórico de treinos e selo "Concluído" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **No TORV, cada task é executada pelo recruta Maestri indicado em "Owner"** (Anvil = Torv Backend, Lumen = Torv Frontend, Loupe = Torv Review and Tests, Warden = Torv Security), nunca por subagent interno. **Execução estritamente sequencial**: uma task de cada vez, e a próxima só começa quando a anterior estiver verde.

**Goal:** Aba Treinos com as visões "Meus treinos" e "Histórico" (activities por dia, com filtro por tipo), rota `GET /activities` paginada por cursor e selo "Concluído" nas rotinas feitas nos últimos 7 dias, com aviso não bloqueante ao refazer.

**Architecture:**
- **Backend:** plugin novo `/activities` (route/controller/repository), que só ordena e pagina. O `GET /workouts/routines` ganha `completed_recently`, com uma query a mais no `Promise.all`. A listagem `GET /workouts/sessions` sai.
- **Front:**
  - um segmentado no topo da aba Treinos;
  - um `SectionList` agrupado por dia no fuso do aparelho (função pura `groupByDay`);
  - o `ConfirmModal` que já existe faz o aviso.

**Tech Stack:** Node 24 + Fastify 5 + TypeBox + Prisma 6 (Postgres); `node:test`; React Native 0.86 / Expo 57 / TS; React Navigation 7.

**Spec:** `docs/superpowers/specs/2026-10-01-workout-history-design.md`

**Validação prévia:** todo o código abaixo foi aplicado e rodado numa worktree temporária a partir de `4d94ea2`:
- backend `npm test`: 83/83, sem banco;
- front `npx tsc --noEmit` sem erros e `node --test src/utils/*.test.mjs`: 17/17.

## Global Constraints

- **Branch e commits:**
  - Branch `feat/workout-module`. Sem push.
  - Commit com pathspec explícito: `git add -- <arquivos> && git commit -m "..." -- <arquivos>`.
  - Nunca commitar `FrontEndTorv/src/services/api.ts`, `FrontEndTorv/src/screens/Login/index.tsx` (mudanças locais do usuário), `FrontEndTorv/tsconfig.json` nem `revisar.md`.
- **Sem migration:** o schema já tem o que é preciso (`activities.routine_id` e o índice `activities_strength_user_start_key`). Ninguém toca em `BackEndTorv/prisma/`.
- **Valores exatos:**
  - `activity_type` `'STRENGTH'`, rótulo no app `'Musculação'`;
  - `limit` de 1 a 50, padrão 20;
  - janela do selo de 7 × 24 h;
  - selo `Concluído`;
  - aviso: título `Treino já concluído`, texto `Você já fez esse treino nos últimos 7 dias. O ideal é dar de 48 a 72 horas para o músculo se recuperar.`, botões `Treinar mesmo assim` / `Cancelar`;
  - visões `Meus treinos` / `Histórico`;
  - chips `Todos` / `Musculação`;
  - estados `Nenhum treino ainda` + `Ver meus treinos` e `Não foi possível carregar o histórico.` + `Tentar de novo`.
- **Isolamento:** o `user_id` vem sempre do token. Recurso de outro usuário nunca aparece.
- **Dependências:** nada de dependência nova. O front só chama a nossa API.
- **Ambiente de teste:**
  - O backend roda no terminal Maestri **Furnace** (`localhost:3000`, nodemon). Nunca suba uma segunda instância.
  - Expo web em `localhost:8081`, no terminal "Expo".
  - O `FrontEndTorv/.env` está **vazio** (problema conhecido, decisão do usuário). A usabilidade usa um shim **só na página**, que reescreve o host do XHR para `localhost:3000`. Não editar o `.env`.
  - Usabilidade no portal Maestri do navegador, em 412×915 e 320 de largura. Contrato HTTP via `maestri portal evaluate` com o token só na página.
- **Relatórios em `docs/`**, um por rodada, sem sobrescrever (`-roundN`):
  - `qa-workout-history-backend-2026-10-01.md`
  - `qa-workout-history-frontend-2026-10-01.md`
  - `qa-workout-history-full-2026-10-01.md`
  - `security-workout-history-2026-10-01.md`
- **Fora do escopo:** outros tipos de activity, filtro por período, busca, editar ou apagar treino do histórico, rate limit.

## Review Focus

1. **Paginação exata na borda:** o usuário tem exatamente `limit` treinos. A 1ª página traz `next_before` não nulo; a 2ª vem vazia, com `next_before: null`; a lista não duplica nem fica em loop de carregamento. Teste: Task 2 (contrato) e Task 4 (rolagem).
2. **Treino perto da meia-noite:** um treino iniciado às 23:30 no horário local aparece no dia local certo, não no dia seguinte (UTC). Teste: Task 4 (sessão com `started_at` local 23:30 via API → cabeçalho do dia certo).
3. **Trocar de chip rápido** enquanto a página anterior ainda carrega: a lista mostra só o resultado do filtro atual. Teste: Task 4.
4. **Borda dos 7 dias:** treino iniciado há 6 d 23 h → `completed_recently: true`; há 7 d 1 h → `false`. Teste: Task 2.
5. **Voltar do resumo para o Histórico:** a visão Histórico continua aberta e a lista recarrega. Depois de concluir um treino, a rotina já aparece com o selo "Concluído" em Meus treinos. Teste: Task 4 e Task 5.

---

### Task 1: Backend — `GET /activities`, `completed_recently` e remoção da listagem de sessões

**Owner:** Torv Backend (Anvil).

**Files:**
- Create: `BackEndTorv/src/routes/activities.routes.js`, `BackEndTorv/src/controller/activities.controller.js`, `BackEndTorv/src/repository/activities.repository.js`, `BackEndTorv/src/routes/activities.routes.test.js`
- Modify: `BackEndTorv/server.js`, `BackEndTorv/src/controller/workout.controller.js`, `BackEndTorv/src/repository/workout.repository.js`, `BackEndTorv/src/routes/workout.schemas.js`, `BackEndTorv/src/routes/workout.routes.js`, `BackEndTorv/src/routes/workout.routes.test.js`, `BackEndTorv/src/routes/workout.sessions.test.js`

**Interfaces:**
- Produces:
  - `GET /activities?type=STRENGTH&before=<ISO>&limit=<1..50>` → `{ activities: [{ id, activity_type, title, start_time, duration_sec, set_count }], next_before: string | null }`.
  - `GET /workouts/routines` e `POST /workouts/plan/accept`: cada rotina ganha `completed_recently: boolean`.
  - `GET /workouts/sessions` (listagem) deixa de existir. `POST /workouts/sessions` e `GET /workouts/sessions/:id` continuam.

- [ ] **Step 1: Teste da rota nova** — criar `BackEndTorv/src/routes/activities.routes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

// O middleware real valida JWT contra o JWKS do Supabase. Aqui todo request é do USER.
const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const activitiesRepository = require('../repository/activities.repository');

async function build(t) {
  const app = Fastify();
  app.register(require('./activities.routes'), { prefix: '/activities' });
  t.after(() => app.close());
  await app.ready();
  return app;
}

const get = (app, url) => app.inject({ method: 'GET', url });
const row = (i, extra = {}) => ({
  id: `id-${i}`, activity_type: 'STRENGTH', title: `Treino ${i}`,
  start_time: new Date(Date.UTC(2026, 8, 30 - i, 20)), duration_sec: 3000, _count: { workout_sets: 3 }, ...extra,
});

test('GET /activities: limit padrão 20, sem filtro; página incompleta → next_before null', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => [
    row(0),
    row(1, { title: null, duration_sec: null, _count: { workout_sets: 0 } }),
  ]);
  const app = await build(t);
  const res = await get(app, '/activities');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    activities: [
      { id: 'id-0', activity_type: 'STRENGTH', title: 'Treino 0', start_time: '2026-09-30T20:00:00.000Z', duration_sec: 3000, set_count: 3 },
      { id: 'id-1', activity_type: 'STRENGTH', title: '', start_time: '2026-09-29T20:00:00.000Z', duration_sec: 0, set_count: 0 },
    ],
    next_before: null,
  });
  assert.deepEqual(list.mock.calls[0].arguments, [USER, { type: undefined, before: undefined, limit: 20 }]);
});

test('GET /activities: página cheia → next_before = start_time do último; type/before/limit repassados', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => [row(0), row(1)]);
  const app = await build(t);
  const res = await get(app, '/activities?type=STRENGTH&limit=2&before=2026-10-01T00:00:00.000Z');
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().next_before, '2026-09-29T20:00:00.000Z');
  const [userId, opts] = list.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.equal(opts.type, 'STRENGTH');
  assert.equal(opts.limit, 2);
  assert.ok(opts.before instanceof Date);
  assert.equal(opts.before.toISOString(), '2026-10-01T00:00:00.000Z');
});

test('GET /activities 400: type, limit e before inválidos não chegam ao repository', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => []);
  const app = await build(t);
  for (const qs of ['type=RUN', 'type=strength', 'limit=0', 'limit=51', 'limit=abc', 'before=ontem', 'before=2026-10-01']) {
    assert.equal((await get(app, `/activities?${qs}`)).statusCode, 400, qs);
  }
  assert.equal(list.mock.callCount(), 0);
});

test('GET /activities: user_id vindo do cliente é ignorado', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => []);
  const app = await build(t);
  const res = await get(app, '/activities?user_id=99999999-9999-4999-8999-999999999999');
  assert.equal(res.statusCode, 200);
  assert.equal(list.mock.calls[0].arguments[0], USER);
});
```

- [ ] **Step 2: Testes do `completed_recently`**, em `BackEndTorv/src/routes/workout.routes.test.js`. No teste `GET /routines: gera plano na 1ª vez...`, troque o trecho desde `t.mock.method(workoutRepository, 'lastRoutineId', async () => 'a');` até a lista `routines` esperada por:

```js
  t.mock.method(workoutRepository, 'lastRoutineId', async () => 'a');
  const recent = t.mock.method(workoutRepository, 'recentRoutineIds', async () => ['a']);
  const app = await build(t);
  const res = await call(app, 'GET', '/workouts/routines');
  assert.equal(res.statusCode, 200);
  assert.equal(save.mock.callCount(), 1);
  const [recentUser, since] = recent.mock.calls[0].arguments;
  assert.equal(recentUser, USER);
  assert.ok(Math.abs(Date.now() - 7 * 24 * 3600 * 1000 - since.getTime()) < 5000, 'janela de 7 dias');
  assert.deepEqual(res.json(), {
    routines: [
      { id: 'a', name: 'Dia 1', is_default: true, exercise_count: 2, set_count: 6, completed_recently: true },
      { id: 'b', name: 'Dia 2', is_default: true, exercise_count: 1, set_count: 4, completed_recently: false },
    ],
```

  Nos dois outros testes que mockam `lastRoutineId` com `null` (`GET /routines: perfil mudou...` e `POST /plan/accept...`), acrescente logo depois:

```js
  t.mock.method(workoutRepository, 'recentRoutineIds', async () => []);
```

  Em `BackEndTorv/src/routes/workout.sessions.test.js`, apague o teste inteiro `test('GET /sessions: limite padrão 10, máx 50; datas em ISO', ...)`.

- [ ] **Step 3: Rodar e ver falhar**

  Run: `cd BackEndTorv && node --test src/routes/activities.routes.test.js src/routes/workout.routes.test.js`

  Expected: FAIL. O `activities.routes` ainda não existe (`Cannot find module './activities.routes'`), e o `completed_recently` não vem na resposta.

- [ ] **Step 4: Repository** — criar `BackEndTorv/src/repository/activities.repository.js`:

```js
const prisma = require('../lib/prisma');

class ActivitiesRepository {
  // Mais recente primeiro. Sem start_time não dá para pôr no histórico, então fica de fora.
  // ponytail: cursor só por start_time (único por usuário em STRENGTH); com outro tipo, empate é possível → (start_time, id).
  async listActivities(userId, { type, before, limit }) {
    return prisma.activities.findMany({
      where: {
        user_id: userId,
        ...(type && { activity_type: type }),
        start_time: before ? { lt: before } : { not: null },
      },
      orderBy: { start_time: 'desc' },
      take: limit,
      select: {
        id: true, activity_type: true, title: true, start_time: true, duration_sec: true,
        _count: { select: { workout_sets: true } },
      },
    });
  }
}

module.exports = new ActivitiesRepository();
```

  Em `BackEndTorv/src/repository/workout.repository.js`:
  - logo depois do método `lastRoutineId`, adicionar:

```js
  // Rotinas com treino desde `since` (selo "Concluído" na lista de rotinas).
  async recentRoutineIds(userId, since) {
    const rows = await prisma.activities.findMany({
      where: { user_id: userId, activity_type: 'STRENGTH', routine_id: { not: null }, start_time: { gte: since } },
      distinct: ['routine_id'],
      select: { routine_id: true },
    });
    return rows.map((r) => r.routine_id);
  }
```

  - apagar o método `listSessions(userId, limit)` inteiro.

- [ ] **Step 5: Controller** — criar `BackEndTorv/src/controller/activities.controller.js`:

```js
const activitiesRepository = require('../repository/activities.repository');

const DEFAULT_LIMIT = 20;

class ActivitiesController {
  async listActivities(request, reply) {
    const { type, before, limit = DEFAULT_LIMIT } = request.query;
    const rows = await activitiesRepository.listActivities(request.user.userId, {
      type,
      before: before ? new Date(before) : undefined,
      limit,
    });
    return reply.send({
      activities: rows.map((a) => ({
        id: a.id,
        activity_type: a.activity_type,
        title: a.title ?? '',
        start_time: a.start_time.toISOString(),
        duration_sec: a.duration_sec ?? 0,
        set_count: a._count.workout_sets,
      })),
      // Página cheia: pode haver mais. O cliente manda isto como `before` na próxima chamada.
      next_before: rows.length === limit ? rows[rows.length - 1].start_time.toISOString() : null,
    });
  }
}

module.exports = new ActivitiesController();
```

  Em `BackEndTorv/src/controller/workout.controller.js`:
  - trocar a função `routinesPayload` inteira por:

```js
// Janela do selo "Concluído": treino feito nos últimos 7 dias (corridos, relógio do servidor).
const RECENT_MS = 7 * 24 * 3600 * 1000;

async function routinesPayload(userId, inputs) {
  const [routines, last, recent] = await Promise.all([
    workoutRepository.listRoutines(userId),
    workoutRepository.lastRoutineId(userId),
    workoutRepository.recentRoutineIds(userId, new Date(Date.now() - RECENT_MS)),
  ]);
  const done = new Set(recent);
  return {
    routines: routines.map((r) => ({ ...routineSummary(r), completed_recently: done.has(r.id) })),
    next_routine_id: nextRoutineId(routines, last),
    plan_suggestion: planSuggestion(inputs),
  };
}
```

  - apagar o método `listSessions(request, reply)` inteiro.

- [ ] **Step 6: Rotas e schemas** — criar `BackEndTorv/src/routes/activities.routes.js`:

```js
const { Type } = require('@sinclair/typebox');
const activitiesController = require('../controller/activities.controller');
const authenticateToken = require('../middlewares/auth.middleware');

// Tipos que o app conhece. Tipo novo (cardio etc.): uma entrada aqui e em ACTIVITY_LABELS no front.
const ACTIVITY_TYPES = ['STRENGTH'];

const ErrorBody = Type.Object({ error: Type.String() });
const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));

const ActivityPage = Type.Object({
  activities: Type.Array(Type.Object({
    id: Type.String(),
    activity_type: Type.String(),
    title: Type.String(),
    start_time: Type.String(),
    duration_sec: Type.Integer(),
    set_count: Type.Integer(),
  })),
  next_before: Type.Union([Type.String(), Type.Null()]),
});

async function activitiesRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/', {
    schema: {
      description: 'Activities do usuário, mais recente primeiro. Próxima página: before = next_before da anterior',
      tags: ['Activities'],
      security: [{ bearerAuth: [] }],
      querystring: Type.Object({
        type: Type.Optional(Type.Union(ACTIVITY_TYPES.map((t) => Type.Literal(t)))),
        before: Type.Optional(Type.String({ format: 'date-time' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: { 200: ActivityPage, ...errors(400, 401, 403) },
    },
  }, activitiesController.listActivities);
}

module.exports = activitiesRoutes;
```

  Em `BackEndTorv/src/routes/workout.schemas.js`:
  - no `RoutineList`, depois de `set_count: Type.Integer(),` (dentro do item de `routines`), adicionar `completed_recently: Type.Boolean(),`;
  - apagar a constante `SessionSummary` inteira e tirá-la do `module.exports`, que fica `ExerciseBody, Exercise, SessionBody, SessionDetail,`.

  Em `BackEndTorv/src/routes/workout.routes.js`:
  - tirar `SessionSummary` do import, que fica `ExerciseBody, Exercise, SessionBody, SessionDetail,`;
  - apagar o bloco `fastify.get('/sessions', { ... }, workoutController.listSessions);` inteiro (o `POST /sessions` e o `GET /sessions/:id` ficam).

  Em `BackEndTorv/server.js`, logo depois da linha que registra `workout.routes`:

```js
fastify.register(require('./src/routes/activities.routes'), { prefix: '/activities' });
```

- [ ] **Step 7: Rodar tudo**

  Run: `cd BackEndTorv && npm test`

  Expected: 83 testes, 0 falhas. Para conferir que nenhum teste toca no banco, rode também com `DATABASE_URL` inválida: tem que dar o mesmo resultado.

- [ ] **Step 8: Fumaça no Furnace** — o nodemon recarrega sozinho. Conferir sem token:
  - `curl -s -o /dev/null -w "%{http_code}" localhost:3000/activities` → `401`;
  - `/activities?limit=0` → `400` ou `401` (o schema roda antes do auth, mesmo padrão das outras rotas);
  - `/workouts/sessions` (GET) → `404`.

  O log do Furnace não pode ter erro de boot.

- [ ] **Step 9: Commit**

```bash
git add -- BackEndTorv/server.js BackEndTorv/src/routes/activities.routes.js BackEndTorv/src/routes/activities.routes.test.js BackEndTorv/src/controller/activities.controller.js BackEndTorv/src/repository/activities.repository.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/routes/workout.routes.test.js BackEndTorv/src/routes/workout.sessions.test.js
git commit -m "feat(activities): paginated activity history route and completed_recently on routines" -- BackEndTorv/server.js BackEndTorv/src/routes/activities.routes.js BackEndTorv/src/routes/activities.routes.test.js BackEndTorv/src/controller/activities.controller.js BackEndTorv/src/repository/activities.repository.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/routes/workout.routes.test.js BackEndTorv/src/routes/workout.sessions.test.js
```

---

### Task 2: Test — etapa backend

**Owner:** Torv Review and Tests (Loupe). Começa só depois da Task 1 commitada.

**Relatório:** `docs/qa-workout-history-backend-2026-10-01.md`.

- [ ] **Step 1: Automatizado:** `cd BackEndTorv && npm test` → 83/83.
- [ ] **Step 2: Contrato ao vivo** (Furnace, `fetch` na página, contas novas criadas pelo `POST /auth/register` do próprio backend):
  - **Sem token e query inválida:**
    - `GET /activities` sem token → 401;
    - `type=RUN`, `type=strength`, `limit=0`, `limit=51`, `limit=abc`, `before=ontem` e `before=2026-10-01` → 400.
  - **Paginação (Review Focus 1):** na conta A, gravar 5 sessões via `POST /workouts/sessions`, com `started_at` em dias diferentes.
    - Com `limit=2`: 3 páginas (2 + 2 + 1), a última com `next_before: null`, sem itens repetidos, em ordem decrescente.
    - Com `limit=5`: a 1ª página traz `next_before` não nulo e a 2ª vem vazia, com `next_before: null`.
  - **Formato:** `type=STRENGTH` → todos os itens com `activity_type: 'STRENGTH'`; `set_count` igual ao número de séries enviadas.
  - **Isolamento:** a conta B não vê nenhum item da A. Um `user_id` na query é ignorado.
  - **Borda dos 7 dias (Review Focus 4):** na conta C, sessão da rotina X com `started_at` = agora − 6 d 23 h e sessão da rotina Y com agora − 7 d 1 h → no `GET /workouts/routines`, X tem `completed_recently: true` e Y tem `false`. Uma rotina sem treino fica `false`.
  - **`POST /workouts/plan/accept`** também traz `completed_recently`.
  - **Listagem removida:** `GET /workouts/sessions` → 404. `POST /workouts/sessions` e `GET /workouts/sessions/:id` continuam funcionando.
- [ ] **Step 3: Revisão do diff** da Task 1 (correção, padrões do projeto, nada de `user_id` vindo do cliente).
- [ ] **Step 4: Relatório** com pass/fail por item. Falha → rework só no backend, nova rodada (`-round2`).

---

### Task 3: Frontend — segmentado, Histórico, selo e aviso

**Owner:** Torv Frontend (Lumen). Começa só depois da Task 2 verde.

**Files:**
- Create:
  - `FrontEndTorv/src/services/activities.ts`
  - `FrontEndTorv/src/utils/activities.ts`
  - `FrontEndTorv/src/utils/historyGroups.ts`
  - `FrontEndTorv/src/utils/historyGroups.test.mjs`
  - `FrontEndTorv/src/screens/Workouts/History.tsx`
  - `FrontEndTorv/src/screens/Workouts/historyStyles.ts`
- Modify:
  - `FrontEndTorv/src/services/workouts.ts`
  - `FrontEndTorv/src/screens/Workouts/index.tsx`
  - `FrontEndTorv/src/screens/Workouts/styles.ts`
  - `FrontEndTorv/src/screens/Home/index.tsx`
  - `FrontEndTorv/src/screens/Profile/index.tsx`

**Interfaces:**
- Consumes: o contrato da Task 1 (`GET /activities` e `completed_recently`).
- Produces:
  - `activitiesApi.list({ type?, before?, limit? }): Promise<ActivityPage>`;
  - `groupByDay(items, now): DayGroup[]` e `dayTitle(date, now)`;
  - `ACTIVITY_LABELS` e `activityLabel(type)`.

- [ ] **Step 1: Teste do agrupamento** — criar `FrontEndTorv/src/utils/historyGroups.test.mjs`:

```js
// Roda com: node --test src/utils/historyGroups.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByDay, dayTitle } from './historyGroups.ts';

// Datas montadas no fuso local: o teste vale em qualquer TZ.
const at = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const item = (id, date) => ({ id, start_time: date.toISOString() });

test('groupByDay: Hoje, Ontem e dia da semana, na ordem recebida', () => {
  const now = at(2026, 10, 1, 12);
  const groups = groupByDay([
    item('a', at(2026, 10, 1, 10)),
    item('b', at(2026, 10, 1, 8)),
    item('c', at(2026, 9, 30, 23, 59)),
    item('d', at(2026, 9, 28, 7)),
  ], now);
  assert.deepEqual(groups.map((g) => [g.title, g.data.map((i) => i.id)]), [
    ['Hoje', ['a', 'b']],
    ['Ontem', ['c']],
    ['seg, 28/09', ['d']],
  ]);
  assert.equal(groups[0].key, '2026-10-01');
});

test('dayTitle: virada de mês e de ano', () => {
  assert.equal(dayTitle(at(2026, 9, 30, 23, 50), at(2026, 10, 1, 0, 30)), 'Ontem');
  assert.equal(dayTitle(at(2025, 12, 31), at(2026, 1, 2)), 'qua, 31/12/2025');
  assert.equal(dayTitle(at(2026, 1, 1), at(2026, 1, 2)), 'Ontem');
});

test('groupByDay: lista vazia', () => {
  assert.deepEqual(groupByDay([], at(2026, 10, 1)), []);
});
```

- [ ] **Step 2: Rodar e ver falhar.**

  Run: `cd FrontEndTorv && node --test src/utils/historyGroups.test.mjs`

  Expected: FAIL (`Cannot find module './historyGroups.ts'`).

- [ ] **Step 3: Agrupamento** — criar `FrontEndTorv/src/utils/historyGroups.ts`:

```ts
// Agrupa itens (já em ordem decrescente de start_time) por dia no fuso do aparelho.
// Rótulos: "Hoje", "Ontem", "qua, 30/09" (ano junto quando não é o ano atual).
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface DayGroup<T> {
  key: string;
  title: string;
  data: T[];
}

export function dayTitle(d: Date, now: Date) {
  const key = dayKey(d);
  if (key === dayKey(now)) return 'Hoje';
  if (key === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Ontem';
  const year = d.getFullYear() === now.getFullYear() ? '' : `/${d.getFullYear()}`;
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}${year}`;
}

export function groupByDay<T extends { start_time: string }>(items: T[], now: Date): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const d = new Date(item.start_time);
    const key = dayKey(d);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.data.push(item);
    else groups.push({ key, title: dayTitle(d, now), data: [item] });
  }
  return groups;
}
```

  Run: `node --test src/utils/*.test.mjs` → 17/17 (14 que já existiam + 3).

- [ ] **Step 4: Contrato** — criar `FrontEndTorv/src/services/activities.ts`:

```ts
import api from './api';

// Contrato de GET /activities (spec docs/superpowers/specs/2026-10-01-workout-history-design.md).
export const ACTIVITY_TYPES = ['STRENGTH'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  start_time: string; // ISO
  duration_sec: number;
  set_count: number;
}

export interface ActivityPage {
  activities: ActivityItem[];
  next_before: string | null; // mandar como `before` para a próxima página; null = acabou
}

export interface ActivityQuery {
  type?: ActivityType;
  before?: string;
  limit?: number;
}

export const activitiesApi = {
  list: (query: ActivityQuery = {}) => api.get<ActivityPage>('/activities', { params: query }).then((r) => r.data),
};
```

  Criar `FrontEndTorv/src/utils/activities.ts`:

```ts
import type { ActivityType } from '../services/activities';

// Rótulo de cada tipo no app. Tipo novo: uma linha aqui + o enum do backend (activities.routes.js).
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  STRENGTH: 'Musculação',
};

export const activityLabel = (type: string) => ACTIVITY_LABELS[type as ActivityType] ?? type;
```

  Em `FrontEndTorv/src/services/workouts.ts`:
  - em `RoutineSummary`, depois de `set_count: number;`, adicionar `completed_recently: boolean; // treino feito nos últimos 7 dias → selo "Concluído"`;
  - apagar a interface `SessionSummary` inteira e a linha `listSessions: ...` do `workoutsApi`.

  Em `FrontEndTorv/src/screens/Profile/index.tsx`, trocar:
  - `import { workoutsApi, type SessionSummary } from '../../services/workouts';` → `import { activitiesApi, type ActivityItem } from '../../services/activities';`
  - `useState<SessionSummary[]>([])` → `useState<ActivityItem[]>([])`
  - `workoutsApi.listSessions(5).catch(() => [] as SessionSummary[]),` → `activitiesApi.list({ limit: 5 }).then((p) => p.activities).catch(() => [] as ActivityItem[]),`

- [ ] **Step 5: Histórico** — criar `FrontEndTorv/src/screens/Workouts/History.tsx`:

```tsx
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, SectionList, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Dumbbell, ChevronRight } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { activitiesApi, ACTIVITY_TYPES, type ActivityItem, type ActivityType } from '../../services/activities';
import { ACTIVITY_LABELS, activityLabel } from '../../utils/activities';
import { groupByDay } from '../../utils/historyGroups';
import { formatClock } from '../../utils/clock';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { historyStyles as styles } from './historyStyles';

const PAGE = 20;
const pad = (n: number) => String(n).padStart(2, '0');
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type Status = 'loading' | 'ready' | 'error';

export default function History({ onShowRoutines }: { onShowRoutines: () => void }) {
  const navigation = useNavigation<AppNavigation>();
  const [type, setType] = useState<ActivityType | undefined>(undefined); // undefined = Todos
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0); // resposta de um filtro antigo chega depois → descarta

  const loadFirst = async (filter: ActivityType | undefined, refresh = false) => {
    const id = ++request.current;
    if (refresh) setRefreshing(true);
    else setStatus('loading');
    try {
      const page = await activitiesApi.list({ type: filter, limit: PAGE });
      if (id !== request.current) return;
      setItems(page.activities);
      setNextBefore(page.next_before);
      setStatus('ready');
    } catch {
      if (id === request.current) setStatus('error');
    } finally {
      if (id === request.current) setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!nextBefore || loadingMore || status !== 'ready') return;
    const id = request.current;
    setLoadingMore(true);
    try {
      const page = await activitiesApi.list({ type, before: nextBefore, limit: PAGE });
      if (id !== request.current) return;
      setItems((prev) => [...prev, ...page.activities]);
      setNextBefore(page.next_before);
    } catch {
      // Falha ao paginar não apaga o que já está na tela; o próximo fim de lista tenta de novo.
    } finally {
      setLoadingMore(false);
    }
  };

  // Recarrega ao voltar para a aba (ex.: depois de um treino) e ao trocar o filtro.
  useFocusEffect(useCallback(() => { loadFirst(type); }, [type]));

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
      {[undefined, ...ACTIVITY_TYPES].map((t) => {
        const active = t === type;
        return (
          <TouchableOpacity
            key={t ?? 'ALL'}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => setType(t)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{t ? ACTIVITY_LABELS[t] : 'Todos'}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  if (status !== 'ready') {
    return (
      <View style={[styles.container, styles.padded]}>
        {chips}
        {status === 'loading' ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          <View style={styles.centered}>
            <Text style={styles.message}>Não foi possível carregar o histórico.</Text>
            <Button title="Tentar de novo" outline onPress={() => loadFirst(type)} />
          </View>
        )}
      </View>
    );
  }

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.list}
      sections={groupByDay(items, new Date())}
      keyExtractor={(a) => a.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={chips}
      renderSectionHeader={({ section }) => <Text style={styles.dayTitle}>{section.title}</Text>}
      renderItem={({ item }) => {
        const title = item.title || activityLabel(item.activity_type);
        const content = (
          <Card style={styles.item}>
            <View style={styles.itemIcon}>
              <Dumbbell color={colors.brand} size={20} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
              <Text style={styles.itemMeta}>
                {timeOf(item.start_time)} · {formatClock(item.duration_sec)} · {item.set_count} {item.set_count === 1 ? 'série' : 'séries'}
              </Text>
            </View>
            {item.activity_type === 'STRENGTH' && <ChevronRight color={colors.textSecondary} size={20} />}
          </Card>
        );
        // Só musculação tem resumo (GET /workouts/sessions/:id).
        return item.activity_type === 'STRENGTH' ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('WorkoutSummary', { sessionId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`Ver treino ${title}`}
          >
            {content}
          </TouchableOpacity>
        ) : content;
      }}
      ListEmptyComponent={(
        <Card style={styles.empty}>
          <Dumbbell color={colors.textSecondary} size={28} />
          <Text style={styles.message}>Nenhum treino ainda</Text>
          <Button title="Ver meus treinos" outline onPress={onShowRoutines} />
        </Card>
      )}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={styles.footer} /> : null}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFirst(type, true)} tintColor={colors.brand} />}
    />
  );
}
```

  Criar `FrontEndTorv/src/screens/Workouts/historyStyles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

const TOUCH = 44;

export const historyStyles = StyleSheet.create({
  container: { flex: 1 },
  padded: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  loading: { marginTop: 32 },
  footer: { marginVertical: 16 },

  // Mesmo chip do ExercisePicker (grupo muscular).
  chipsScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -20, marginBottom: 4 },
  chipsRow: { gap: 8, paddingHorizontal: 20 },
  chip: {
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  chipText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },
  chipTextActive: { color: colors.brand },

  dayTitle: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13, marginTop: 16, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  itemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  itemMeta: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },

  centered: { alignItems: 'center', gap: 12, marginTop: 32 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, marginTop: 8 },
  message: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, textAlign: 'center' },
});
```

- [ ] **Step 6: Aba Treinos** — substituir `FrontEndTorv/src/screens/Workouts/index.tsx` inteiro por:

```tsx
import React, { useCallback, useContext, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Play, Plus, Sparkles, Dumbbell, ChevronRight } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AuthContext } from '../../contexts/AuthContext';
import { workoutsApi, type RoutineList, type RoutineSummary } from '../../services/workouts';
import { loadDraft, clearDraft } from '../../utils/workoutDraft';
import type { SessionState } from '../../utils/workoutSession';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import History from './History';
import { styles } from './styles';

const REASONS: Record<string, string> = {
  fitness_level: 'Seu nível físico mudou',
  goals: 'Seu objetivo mudou',
  gender: 'Seus dados mudaram',
};

type WorkoutsView = 'routines' | 'history';
const VIEWS: { key: WorkoutsView; label: string }[] = [
  { key: 'routines', label: 'Meus treinos' },
  { key: 'history', label: 'Histórico' },
];

export default function Workouts() {
  const navigation = useNavigation<AppNavigation>();
  const { user } = useContext(AuthContext);
  const [data, setData] = useState<RoutineList | null>(null);
  const [draft, setDraft] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  // Fica guardada enquanto a tela está montada: voltar de um resumo mantém o Histórico aberto.
  const [view, setView] = useState<WorkoutsView>('routines');
  const [repeatRoutineId, setRepeatRoutineId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [list, saved] = await Promise.all([
        workoutsApi.listRoutines(),
        user?.id ? loadDraft(user.id) : Promise.resolve(null),
      ]);
      setData(list);
      setDraft(saved);
    } catch {
      setError('Não foi possível carregar seus treinos.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  const regenerate = async () => {
    setBusy(true);
    try {
      setData(await workoutsApi.acceptPlan());
    } catch {
      setError('Não foi possível gerar o novo treino.');
    } finally {
      setBusy(false);
      setConfirmRegenerate(false);
    }
  };

  // Otimista: o banner some na hora; se o dismiss falhar, volta no próximo foco.
  const keepPlan = async () => {
    setData((d) => d && { ...d, plan_suggestion: { has_suggestion: false, changed: [] } });
    await workoutsApi.dismissPlan().catch(() => {});
  };

  const discardDraft = async () => {
    if (user?.id) await clearDraft(user.id);
    setDraft(null);
    setConfirmDiscard(false);
  };

  // Rotina feita nos últimos 7 dias: avisa antes, mas não impede.
  const startRoutine = (r: RoutineSummary) => {
    if (r.completed_recently) setRepeatRoutineId(r.id);
    else navigation.navigate('WorkoutSession', { routineId: r.id });
  };

  const confirmRepeat = () => {
    const id = repeatRoutineId;
    setRepeatRoutineId(null);
    if (id) navigation.navigate('WorkoutSession', { routineId: id });
  };

  const suggestion = data?.plan_suggestion;
  const reasons = [...new Set((suggestion?.changed ?? []).map((k) => REASONS[k]).filter(Boolean))];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Treinos</Text>
        <View style={styles.segmented} accessibilityRole="tablist">
          {VIEWS.map((v) => {
            const active = view === v.key;
            return (
              <TouchableOpacity
                key={v.key}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setView(v.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {view === 'history' ? (
        <History onShowRoutines={() => setView('routines')} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {draft && (
            <Card style={styles.draftCard}>
              <Text style={styles.draftTitle}>Treino em andamento</Text>
              <Text style={styles.draftName}>{draft.routine_name}</Text>
              <View style={styles.bannerActions}>
                <Button title="Continuar" style={styles.bannerButton} onPress={() => navigation.navigate('WorkoutSession', { resume: true })} />
                <Button title="Descartar" outline danger style={styles.bannerButton} onPress={() => setConfirmDiscard(true)} />
              </View>
            </Card>
          )}

          {suggestion?.has_suggestion && (
            <Card style={styles.suggestionCard}>
              <View style={styles.suggestionHeader}>
                <Sparkles color={colors.brand} size={18} />
                <Text style={styles.suggestionTitle}>Novo treino padrão disponível</Text>
              </View>
              {reasons.map((r) => <Text key={r} style={styles.suggestionReason}>{r}</Text>)}
              <View style={styles.bannerActions}>
                <Button title="Regerar" style={styles.bannerButton} onPress={() => setConfirmRegenerate(true)} />
                <Button title="Manter" outline style={styles.bannerButton} onPress={keepPlan} />
              </View>
            </Card>
          )}

          {!!error && (
            <TouchableOpacity onPress={load} accessibilityRole="button">
              <Text style={styles.error}>{error} Toque para tentar de novo.</Text>
            </TouchableOpacity>
          )}

          {loading && !data ? (
            <ActivityIndicator color={colors.brand} style={styles.loading} />
          ) : (
            data?.routines.map((r) => (
              // Card e ▶ são irmãos: botão dentro de botão quebra no web (<button> em <button>).
              <Card key={r.id} style={[styles.routineCard, r.id === data.next_routine_id && styles.routineCardNext]}>
                <TouchableOpacity
                  style={styles.routineEdit}
                  onPress={() => navigation.navigate('RoutineEditor', { routineId: r.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${r.name}`}
                >
                  <View style={styles.routineInfo}>
                    <View style={styles.tags}>
                      {r.id === data.next_routine_id && <Text style={styles.nextTag}>Próximo</Text>}
                      {r.is_default && <Text style={styles.defaultTag}>Padrão</Text>}
                      {r.completed_recently && <Text style={styles.doneTag}>Concluído</Text>}
                    </View>
                    <Text style={styles.routineName}>{r.name}</Text>
                    <Text style={styles.routineMeta}>{r.exercise_count} {r.exercise_count === 1 ? 'exercício' : 'exercícios'} · {r.set_count} {r.set_count === 1 ? 'série' : 'séries'}</Text>
                  </View>
                  {/* Com treino em andamento, só o banner continua/descarta: nada de 2 treinos ao mesmo tempo. */}
                  {draft && <ChevronRight color={colors.textSecondary} size={20} />}
                </TouchableOpacity>
                {!draft && (
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => startRoutine(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`Iniciar ${r.name}`}
                  >
                    <Play color={colors.background} size={18} fill={colors.background} />
                  </TouchableOpacity>
                )}
              </Card>
            ))
          )}

          {data && data.routines.length === 0 && (
            <Card style={styles.emptyCard}>
              <Dumbbell color={colors.textSecondary} size={28} />
              <Text style={styles.emptyText}>Nenhuma rotina ainda.</Text>
            </Card>
          )}

          <TouchableOpacity style={styles.newButton} onPress={() => navigation.navigate('RoutineEditor', {})} accessibilityRole="button">
            <Plus color={colors.brand} size={22} />
            <Text style={styles.newText}>Nova rotina</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <ConfirmModal
        visible={confirmRegenerate}
        title="Regerar treino padrão?"
        message="Suas rotinas padrão serão substituídas, inclusive edições. As rotinas que você criou não mudam."
        confirmLabel="Regerar"
        loading={busy}
        onConfirm={regenerate}
        onCancel={() => setConfirmRegenerate(false)}
      />
      <ConfirmModal
        visible={confirmDiscard}
        title="Descartar treino?"
        message="As séries feitas neste treino serão perdidas."
        confirmLabel="Descartar"
        danger
        onConfirm={discardDraft}
        onCancel={() => setConfirmDiscard(false)}
      />
      <ConfirmModal
        visible={!!repeatRoutineId}
        title="Treino já concluído"
        message="Você já fez esse treino nos últimos 7 dias. O ideal é dar de 48 a 72 horas para o músculo se recuperar."
        confirmLabel="Treinar mesmo assim"
        onConfirm={confirmRepeat}
        onCancel={() => setRepeatRoutineId(null)}
      />
    </SafeAreaView>
  );
}
```

  E `FrontEndTorv/src/screens/Workouts/styles.ts` inteiro por:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 48 },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 32, marginBottom: 16 },

  // Meus treinos | Histórico
  segmented: { flexDirection: 'row', padding: 4, marginBottom: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.brand },
  segmentText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },
  segmentTextActive: { color: colors.background },
  loading: { marginTop: 32 },
  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, marginBottom: 16 },

  // Âmbar = treino em andamento; não confunde com o verde da sugestão de plano.
  draftCard: { borderColor: colors.accentIntermediate, borderLeftWidth: 4, backgroundColor: 'rgba(232, 163, 61, 0.08)' },
  draftTitle: { color: colors.accentIntermediate, fontFamily: fontFamily.semiBold, fontSize: 13 },
  draftName: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 18, lineHeight: 24, marginTop: 4 },

  suggestionCard: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  suggestionReason: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: 4, marginLeft: 26 },
  bannerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  bannerButton: { flex: 1 },

  routineCard: { flexDirection: 'row', alignItems: 'center', minHeight: 76, marginBottom: 12, padding: 0 },
  routineEdit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  routineCardNext: { borderColor: colors.brand },
  routineInfo: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nextTag: { color: colors.background, backgroundColor: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 11, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  defaultTag: { color: colors.textSecondary, borderColor: colors.border, borderWidth: 1, fontFamily: fontFamily.semiBold, fontSize: 11, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  doneTag: { color: colors.brand, borderColor: colors.brand, borderWidth: 1, fontFamily: fontFamily.semiBold, fontSize: 11, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  routineName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 22, marginTop: 6 },
  routineMeta: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2 },
  // paddingLeft centraliza o triângulo opticamente.
  playButton: { width: 48, height: 48, borderRadius: 24, marginRight: 16, paddingLeft: 3, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },

  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    marginTop: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  newText: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 16 },
});
```

  O arquivo acima é o atual com três diferenças: `header`, `scroll` sem `paddingTop`, e os estilos `segmented*` e `doneTag`. O singular "1 exercício · 1 série" do rework `3d2e995` e o ▶ fora do card (`d6bdbc1`) estão preservados.

- [ ] **Step 7: Home** — em `FrontEndTorv/src/screens/Home/index.tsx`:
  - importar `ConfirmModal` (`import { ConfirmModal } from '../../components/ConfirmModal';`) e `type RoutineSummary` (`import { workoutsApi, type RoutineSummary } from '../../services/workouts';`);
  - o estado `nextRoutine` passa a ser `useState<RoutineSummary | null | undefined>(undefined)`, e entra `const [confirmRepeat, setConfirmRepeat] = useState(false);`;
  - trocar o `onWorkoutPress` por:

```tsx
  const startNext = () => {
    setConfirmRepeat(false);
    if (nextRoutine) navigation.navigate('WorkoutSession', { routineId: nextRoutine.id });
  };

  // Treino feito nos últimos 7 dias: mesmo aviso da aba Treinos, sem impedir.
  const onWorkoutPress = () => {
    if (hasDraft) navigation.navigate('WorkoutSession', { resume: true });
    else if (nextRoutine?.completed_recently) setConfirmRepeat(true);
    else if (nextRoutine) startNext();
    else navigation.navigate('Workouts' as never);
  };
```

  - antes do `</SafeAreaView>` final (depois do `</ScrollView>`), adicionar:

```tsx
      <ConfirmModal
        visible={confirmRepeat}
        title="Treino já concluído"
        message="Você já fez esse treino nos últimos 7 dias. O ideal é dar de 48 a 72 horas para o músculo se recuperar."
        confirmLabel="Treinar mesmo assim"
        onConfirm={startNext}
        onCancel={() => setConfirmRepeat(false)}
      />
```

- [ ] **Step 8: Typecheck e testes.** `cd FrontEndTorv && npx tsc --noEmit && node --test src/utils/*.test.mjs` → sem erros, 17/17.

- [ ] **Step 9: Refinamento visual com `/frontend-design`.**
  - **Escopo:** só nos estilos (`Workouts/styles.ts`, `Workouts/historyStyles.ts`) e em props `style=` dos novos elementos: segmentado, chips, cabeçalho do dia, item do histórico, selo "Concluído".
  - **Regras:**
    - alvos ≥ 44 px;
    - cabe em 320 px sem rolagem horizontal da página;
    - o selo "Concluído" se distingue de "Próximo" (sólido) e de "Padrão" (cinza);
    - usar só os tokens de `theme/tokens.ts`.
  - **Não mudar:** lógica, textos, `accessibilityLabel`/`accessibilityRole`, handlers. `npx tsc --noEmit` de novo.

- [ ] **Step 10: Fumaça no Expo web** (portal, shim só na página). Alternar entre "Meus treinos" e "Histórico", abrir um item e voltar. Console sem erro vermelho.

- [ ] **Step 11: Commit**

```bash
git add -- FrontEndTorv/src/services/activities.ts FrontEndTorv/src/utils/activities.ts FrontEndTorv/src/utils/historyGroups.ts FrontEndTorv/src/utils/historyGroups.test.mjs FrontEndTorv/src/screens/Workouts/History.tsx FrontEndTorv/src/screens/Workouts/historyStyles.ts FrontEndTorv/src/services/workouts.ts FrontEndTorv/src/screens/Workouts/index.tsx FrontEndTorv/src/screens/Workouts/styles.ts FrontEndTorv/src/screens/Home/index.tsx FrontEndTorv/src/screens/Profile/index.tsx
git commit -m "feat(workouts): history view with type filter, completed badge and repeat warning" -- FrontEndTorv/src/services/activities.ts FrontEndTorv/src/utils/activities.ts FrontEndTorv/src/utils/historyGroups.ts FrontEndTorv/src/utils/historyGroups.test.mjs FrontEndTorv/src/screens/Workouts/History.tsx FrontEndTorv/src/screens/Workouts/historyStyles.ts FrontEndTorv/src/services/workouts.ts FrontEndTorv/src/screens/Workouts/index.tsx FrontEndTorv/src/screens/Workouts/styles.ts FrontEndTorv/src/screens/Home/index.tsx FrontEndTorv/src/screens/Profile/index.tsx
```

---

### Task 4: Test — etapa frontend

**Owner:** Torv Review and Tests (Loupe). Começa só depois da Task 3 commitada.

**Relatório:** `docs/qa-workout-history-frontend-2026-10-01.md`.

- [ ] **Step 1: Automatizado:** `cd FrontEndTorv && npx tsc --noEmit && node --test src/utils/*.test.mjs` → limpo, 17/17.
- [ ] **Step 2: Usabilidade** (portal 412×915 e 320, shim só na página, conta nova com treinos gravados via API em dias diferentes):
  1. **Aba Treinos:**
     - o segmentado alterna entre "Meus treinos" e "Histórico";
     - "Meus treinos" fica idêntico ao de antes (banners, ▶, editor, "Nova rotina");
     - o `accessibilityRole` é `tab`, com `selected`.
  2. **Histórico:**
     - os chips "Todos" e "Musculação" filtram;
     - cabeçalhos "Hoje", "Ontem" e "ddd, dd/mm";
     - cada item mostra hora, duração e "1 série" / "N séries".
  3. **Meia-noite (Review Focus 2):** um treino com `started_at` às 23:30 local aparece sob o dia local certo.
  4. **Rolagem:** com mais de 20 treinos, rolar até o fim carrega a próxima página sem repetir itens e o spinner some no fim. Com exatamente 20, não fica em loop (Review Focus 1).
  5. **Troca rápida de chip (Review Focus 3):** trocar de chip com a rede lenta (hook de XHR atrasando a 1ª resposta) mostra só o resultado do chip final.
  6. **Resumo (Review Focus 5):** tocar num item abre o resumo do histórico. "Concluir"/voltar retorna com o **Histórico ainda aberto**, e a lista recarrega.
  7. **Estados:**
     - conta sem treinos → "Nenhum treino ainda" + "Ver meus treinos", que volta para a outra visão;
     - falha de rede no hook → "Não foi possível carregar o histórico." + "Tentar de novo", que recupera;
     - puxar para baixo recarrega.
  8. **Selo:** a rotina feita nos últimos 7 dias mostra "Concluído" e as outras não. Concluir um treino novo pelo app → voltar para Meus treinos → selo na rotina (Review Focus 5).
  9. **Aviso:**
     - ▶ numa rotina concluída → modal com o título, o texto e os botões exatos;
     - "Cancelar" não abre a sessão; "Treinar mesmo assim" abre;
     - ▶ numa rotina não concluída abre direto;
     - o mesmo vale no "Iniciar" da Home, e "Continuar treino" (rascunho) não mostra aviso.
  10. **Perfil:** "Atividade Física" continua listando os 5 últimos e abrindo o resumo.
  11. **Layout e console:**
      - em 320 px, segmentado, chips, itens e modal sem corte e sem rolagem horizontal;
      - alvos ≥ 44 px;
      - console sem erros vermelhos.
- [ ] **Step 3: Revisão do diff** da Task 3.
- [ ] **Step 4: Relatório.** Falha → rework só no frontend, nova rodada.

---

### Task 5: Teste completo

**Owner:** Torv Review and Tests (Loupe). Começa só depois das Tasks 2 e 4 verdes.

**Relatório:** `docs/qa-workout-history-full-2026-10-01.md`.

- [ ] **Step 1:** Rodada única sobre o HEAD, com **contas novas**: todos os itens das Tasks 2 e 4 de novo, sobre o estado final.
- [ ] **Step 2: Regressão do módulo de treinos**, na mesma rodada:
  - plano padrão gerado do banco: Iniciante com 3 rotinas;
  - itens 1 e 2 do Review Focus da entrega 1 (GETs paralelos e accept duplo);
  - editor de rotina (carga em branco, carga com vírgula);
  - execução: cronômetros e descanso vermelho;
  - reload no meio do descanso;
  - resumo e reenvio idempotente.
- [ ] **Step 3:** Relatório com uma tabela por área. Falha → rework na camada responsável, depois o teste da etapa e esta rodada de novo.

---

### Task 6: Security

**Owner:** Torv Security (Warden). Começa só depois da Task 5 verde.

**Relatório:** `docs/security-workout-history-2026-10-01.md`.

- [ ] **Step 1: OWASP Top 10** no diff `4d94ea2..HEAD`, com foco em:
  - **IDOR:**
    - `/activities` filtra por `request.user.userId`;
    - o `recentRoutineIds` só olha activities do próprio usuário;
    - nenhum id vem do cliente.
  - **Limites e cursor:** `limit` ≤ 50; `before` validado como `date-time`; `type` em enum; nada de `user_id` ou ordenação controlados pelo cliente.
  - **Exposição:** a resposta não traz `user_id`, `routine_id` nem dados de outras tabelas.
  - **Erros** sem detalhe do Prisma.
  - **Front:** só a nossa API, nada novo em `EXPO_PUBLIC_*`, nada de token em log.
- [ ] **Step 2:** Falha → rework só na camada apontada, depois as Tasks 4/5 de novo sobre o que mudou e um novo relatório.

**Feature pronta** quando as Tasks 5 e 6 estiverem verdes. Depois disso, o Maestro atualiza o `revisar2.md` na raiz para o usuário.
