# QA — Histórico de treinos — etapa backend — 2026-10-01

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, código em `e2b6d71` (diff `1b6aa55..e2b6d71`) · **Plano:** Task 2 de `docs/superpowers/plans/2026-10-01-workout-history.md` + Review Focus 1 e 4 · **Spec:** `docs/superpowers/specs/2026-10-01-workout-history-design.md`

Contas **novas**, criadas pelo `POST /auth/register` do backend a partir da página (todas `@torvtest.dev`):
- `qa.hist.A.1790888637985`: F / Iniciante / Perder Peso
- `qa.hist.B.1790888637985`: M / Iniciante / Perder Peso
- `qa.hist.C.1790888637985`: M / Iniciante / Ganhar Massa

## Ambiente

- Backend no Furnace (`localhost:3000`, nodemon), sem reinício e sem outra instância.
- Contrato por `fetch` dentro do portal "Torv Mobile #2". Os tokens ficaram só em variáveis da página; a sessão do próprio portal não foi tocada.
- Sessões com `started_at` no passado gravadas por `POST /workouts/sessions`. O limite do backend é ≥ 2026-01-01; nenhuma passou de 8 dias atrás.
- Nenhum acesso direto ao banco nesta rodada.

## Veredito: PASS (100% verde)

Nenhuma falha. Só há observações INFO, listadas no fim.

## Step 1 — Automatizado

| Item | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ 83/83 |

## Step 2 — Contrato ao vivo

### Sem token e query inválida

| Item | Resultado |
|---|---|
| `GET /activities` sem token | ✅ 401 `Access token is missing` |
| Token inválido | ✅ 403 |
| `type=RUN`, `type=strength`, `limit=0`, `limit=51`, `limit=abc`, `before=ontem`, `before=2026-10-01` | ✅ todos 400 |
| Extras: `limit=1.5`, `limit=-1`, `type=` (vazio) | ✅ 400 |
| Bordas válidas: `limit=1`, `limit=50`, `type=STRENGTH`, `before=2026-10-01T10:00:00-03:00` (com offset), `before=…Z` | ✅ 200 |
| Conta nova, sem treino | ✅ `{ activities: [], next_before: null }` |

### Paginação (Review Focus 1) — conta A, 5 sessões em 5 dias (−1 d a −5 d, com 1 a 5 séries)

| Item | Resultado |
|---|---|
| 5× `POST /workouts/sessions` | ✅ 201 ×5 |
| `limit=2` | ✅ 3 páginas: 2 + 2 + 1. `next_before` não nulo, não nulo e depois `null` |
| `limit=2`: ordem e repetição | ✅ 5 ids **sem repetição**, em ordem decrescente de `start_time` (30/09 → 26/09), iguais aos ids devolvidos pelos POSTs |
| `limit=2`: cursor | ✅ `next_before` = `start_time` do último item de cada página cheia |
| **RF1** — `limit=5` com exatamente 5 treinos | ✅ A 1ª página traz 5 itens e `next_before` não nulo (`2026-09-26T20:27:15.131Z`). A 2ª vem com 200, `activities: []` e `next_before: null`, sem loop |
| Sem `limit` (padrão 20) | ✅ 5 itens, `next_before: null` |

### Formato

| Item | Resultado |
|---|---|
| `type=STRENGTH` | ✅ Todos os 5 itens com `activity_type: 'STRENGTH'` |
| `set_count` | ✅ = séries enviadas (1, 2, 3, 4, 5) |
| Campos | ✅ `duration_sec` = enviado (601–605), `start_time` = `started_at` enviado (ISO com `Z`) e `title` = nome da rotina. Só os 6 campos do schema |

### Isolamento A/B

| Item | Resultado |
|---|---|
| B (com 1 sessão própria) lista | ✅ Só o item de B; nenhum id de A |
| B com `?user_id=<uid de A>` | ✅ 200, ignorado: só o item de B. Paginando com `limit=1` também não aparece nada de A |
| B com `before` = cursor de uma página de A | ✅ Nenhum item de A (0 itens) |
| B `GET /workouts/sessions/<id de A>` | ✅ 404 |

### Borda dos 7 dias (Review Focus 4) — conta C

| Item | Resultado |
|---|---|
| Sessão da rotina X (Dia 1) em agora − 6 d 23 h; da rotina Y (Dia 2) em agora − 7 d 1 h | ✅ 201 / 201 |
| B grava uma sessão com o `routine_id` da rotina Z (Dia 3) de C | ✅ 201 **sem vínculo** ("Treino livre") |
| `GET /workouts/routines` de C | ✅ X `completed_recently: true`, Y `false`, Z `false`. A sessão de B não marca rotina de C |
| B | ✅ Só a rotina que B treinou fica `true` |
| A | ✅ As 3 rotinas treinadas há 1–5 dias ficam `true` |

### `POST /workouts/plan/accept`

| Item | Resultado |
|---|---|
| C cria a rotina "Própria C" e treina há 1 h → `accept` **sem** sugestão | ✅ 200, mesmos ids. X `true`, Y `false`, Z `false`, Própria `true` |
| `PUT /profile {fitness_level: INTERMEDIÁRIO}` → `accept` | ✅ 200. As 4 defaults novas (ids novos) vêm `false`; "Própria C" vem `true`. Campo booleano em todos os itens |
| `POST /plan/dismiss` | ✅ continua `{ message }` |

### Listagem removida

| Item | Resultado |
|---|---|
| `GET /workouts/sessions` e `?limit=5` | ✅ 404 / 404 |
| OpenAPI (`/documentation/json`) | ✅ **Sessões:** `/workouts/sessions` só com `post` e `/workouts/sessions/{id}` com `get`. **Activities:** `/activities/` documentada com `type` enum `[STRENGTH]`, `before` `date-time`, `limit` 1–50 e respostas 200/400/401/403. **Rotinas:** `completed_recently` é obrigatório no item de rotina |
| `GET /workouts/sessions/:id` | ✅ 200 com título, duração e 3 séries em ordem (1, 2, 3); 1º descanso `null` |
| `POST /workouts/sessions` repetido (mesmo `started_at`) | ✅ 200 com o mesmo id; A continua com 5 activities |

## Step 3 — Revisão do diff (`1b6aa55..e2b6d71`)

| Arquivo | Resultado |
|---|---|
| `src/routes/activities.routes.js` | ✅ Plugin próprio com `preHandler` `authenticateToken`. Querystring TypeBox: `type` enum, `before` `date-time` e `limit` inteiro 1–50. Schema de resposta, `description`, `tags` e `security` presentes. Registrado no `server.js:56` com `prefix: '/activities'` |
| `src/controller/activities.controller.js` | ✅ **Usuário:** vem de `request.user.userId` (token). Da query só saem `type`, `before` e `limit`, então `user_id` do cliente não tem efeito. **Cursor:** `next_before` só com a página cheia (`length === limit`). **Nulos:** `title`/`duration_sec` caem para `''`/`0`, como no schema |
| `src/repository/activities.repository.js` | ✅ `where.user_id` sempre presente. `start_time < before` com cursor, ou `start_time NOT NULL` sem cursor. `orderBy start_time desc`, `take limit`, `_count.workout_sets`. A limitação do cursor só por `start_time` está marcada com `ponytail:` |
| `workout.repository.js` `recentRoutineIds` | ✅ Uma query só: `user_id` do token, `STRENGTH`, `routine_id` não nulo, `start_time >= since`, `distinct routine_id` |
| `workout.controller.js` `routinesPayload` | ✅ A 3ª query entra no `Promise.all`. Janela `7 × 24 h` (`RECENT_MS`) no relógio do servidor. Serve `GET /routines` e `plan/accept` |
| Remoções | ✅ Saíram rota, controller, repository, schema `SessionSummary` e teste da listagem. Nenhuma referência sobra no backend. Em `workout.routes.js`, `Type` continua em uso |
| Testes novos | ✅ Cobrem os itens da spec: formato, `next_before` cheio/incompleto, repasse de `type`/`before`/`limit`/`userId`, os 7 casos 400 sem chegar ao repository, `user_id` ignorado, `completed_recently` true/false e a janela de ~7 dias |
| Escopo | ✅ Sem migration, nada em `prisma/`, sem dependência nova |

## Observações (INFO, não bloqueantes)

- **Frontend, transitório, esperado pelo plano sequencial:** o Perfil ainda chama a listagem removida, em `FrontEndTorv/src/services/workouts.ts:119` (`listSessions`) e `FrontEndTorv/src/screens/Profile/index.tsx:63`. O 404 é engolido pelo `.catch(() => [])`, então até a Task 3 a seção "Atividade Física" mostra "Nenhum treino ainda" para quem já treinou. A Task 3 troca para `activitiesApi.list({ limit: 5 })`.
- **Produto, segue a spec:** depois de um `plan/accept` com sugestão, as rotinas default são recriadas com ids novos e voltam com `completed_recently: false`, mesmo que o "Dia 1" antigo tenha sido treinado ontem. A rotina própria mantém o selo. Vale lembrar disso no Teste completo (Review Focus 5).
- **Backend, cursor:** `next_before` sai com precisão de milissegundo (`toISOString`), e o `timestamptz` guarda microssegundos.
  - **Quando afeta:** só uma activity gravada por SQL com sub-ms (por exemplo `now()` em `BancoDeDadosTorv/Mock Dados.sql`) e outra no **mesmo** milissegundo.
  - **Efeito:** a segunda pode ser pulada entre páginas (`BackEndTorv/src/controller/activities.controller.js:23`). Nunca duplica.
  - **Hoje:** as sessões do app chegam com precisão de ms, então não há impacto prático. Fica para a Security avaliar junto com o `ponytail:` do cursor.
- **Dados de teste:** as contas `qa.hist.{A,B,C}.1790888637985@torvtest.dev` continuam no banco, porque não existe endpoint para apagar conta. Ficaram com:
  - sessões: 5 em A e 2 em B (uma delas "Treino livre"); C tem 3;
  - a rotina "Própria C";
  - o perfil de C em Intermediário.
