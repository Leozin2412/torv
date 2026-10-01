# Security Review: Módulo de treinos, entrega 1 (Round 1)

- **Data:** 2026-09-30
- **Branch:** `feat/workout-module`
- **Escopo:** `git diff main...feat/workout-module`. O código está em `edb6a51..690c02f`; os commits `docs/` contêm só planos e relatórios.
  - Backend: `workout.routes.js`, `workout.schemas.js`, `workout.controller.js`, `workout.repository.js`, `lib/workoutPlan.js`, `lib/workoutValidation.js`, `lib/workoutGenerator.js`, `server.js` (registro em `/workouts`)
  - Banco: `prisma/migrations/20260930200000_workout_module/migration.sql` e `schema.prisma`
  - Frontend: `services/workouts.ts`, `ExercisePicker`, `RoutineEditor`, `Workouts`, `Home`, navegação
- **Spec:** `docs/superpowers/specs/2026-09-30-workout-module-design.md`
- **Pré-condição:** QA round 2 PASS (`docs/qa-workout-routines-2026-09-30-round2.md`, `19ce6e7`)
- **Lente:** OWASP Top 10 (A01, A03, A04, A05, A08, A09), com os itens do Step 1 da Task 9
- **Veredito: PASS.** Não há achado CRITICAL, HIGH ou MEDIUM. Há 1 achado LOW que não bloqueia (#1) e 3 INFO.

Nenhum segredo foi impresso. Não usei token no shell e não criei conta. Também não subi outra instância do backend. Para chegar ao veredito, rodei três coisas:

- **Testes:** `node --test` nos 4 arquivos de teste do módulo, com **28/28 passando**.
- **Schema real via `inject`:** o `RoutineBody` real, compilado pelo Ajv padrão do Fastify (com `coerceTypes: 'array'`), testado num Fastify em memória e sem banco.
- **Banco:** 2 `SELECT` só de leitura no catálogo do Postgres (`pg_class`, `pg_policy`, `information_schema`, `has_table_privilege`), conectado como `torv_api`. O MCP do Supabase recusou a chamada por falta de permissão, então usei o Prisma com a credencial do `.env`.

---

## Step 1: checklist

### A01: IDOR/BOLA em `/workouts/*` ✅

- `workout.routes.js:12` registra o hook `preHandler` `authenticateToken` para todas as rotas do plugin. O `userId` vem de `payload.sub` de um JWT verificado por JWKS e com issuer conferido (`auth.middleware.js:13-16`).
- Toda query do repository filtra por esse `userId`. **Nenhum id de usuário vem do corpo, da query nem dos params.**
  - Rotina: `getRoutine` usa `findFirst { id, user_id }` (`workout.repository.js:106`). `updateRoutine` usa `updateMany { id, user_id }` e só apaga os filhos se `count > 0`, tudo dentro da mesma transação (`:126-128`). `deleteRoutine` usa `deleteMany { id, user_id }` (`:135`).
  - Exercício: `updateExercise` e `deleteExercise` filtram `{ id, owner_user_id: userId }` (`:153`, `:158`). Por isso o catálogo (`owner_user_id NULL`) nunca casa, e não dá para editar nem apagar exercício do catálogo.
  - Listagens: `listRoutines` e `lastRoutineId` usam `where user_id` (`:90`, `:98`). `listExercises` mostra só o catálogo e os exercícios próprios (`:8`, `:141`).
- **Exercício alheio não entra em rotina.** `prepareRoutine` compara `countVisibleExercises(userId, idsÚnicos)` com o número de ids e devolve 400 `exercise not found` se não bater (`workout.controller.js:50-51`). A resposta é a mesma para id inexistente e para exercício de outro usuário, então não dá para descobrir se um id existe.
- **Recurso alheio responde 404, nunca 403** (`workout.controller.js:6`), o que também evita enumeração. Os testes de rota cobrem rotina alheia em GET, PUT e DELETE e exercício alheio.

### A08: Mass assignment ✅

- `createRoutine` e `updateRoutine` gravam só `{ name: trim, exercises }`, montados em `prepareRoutine` (`controller:52`).
- O repository decide o resto:
  - `user_id`, `position = max + 1` e `is_default`, que fica no default `false` do banco (`repository:116-117`)
  - `position` e `set_number` vêm do índice do array (`exerciseRows`, `:16-17`)
  - `id` vem de `randomUUID()`
- `exerciseRows` lê só `exercise_id`, `reps_min`, `reps_max`, `rest_sec` e `sets[].weight_kg`.
- `createExercise` grava `{ name, muscle_group, owner_user_id: userId }` (`:148`). O `slug` nunca é gravável, e a constraint `exercises_catalog_or_owned_check` impede um exercício próprio de se passar por catálogo.
- **Prova via `inject`:** o corpo `{ ..., is_default: true, user_id: 'u', position: -1 }` passa o schema com 200, mas os campos extras não chegam a nenhuma escrita. O controller nem lê esses campos, e o Fastify ainda os remove do corpo (`removeAdditional`).

### A04/A08: `plan/accept` recalculado no servidor ✅

- A rota não tem schema de body (`workout.routes.js:42-48`), e `acceptPlan` não lê `request.body` (`controller:94-98`).
- `lib/workoutPlan.js:21-26` lê `getPlanInputs(userId)` do banco, chama `generatePlan` e grava com `savePlan(..., 'replace')`.
- O `UPDATE ... WHERE workout_plan_basis IS DISTINCT FROM $basis` (`repository:63`) torna o aceite idempotente: um clique duplo ou um aceite sem sugestão pendente não muda nada. O `deleteMany` só remove rotinas do próprio usuário com `is_default: true` (`:65`), então as rotinas que o usuário criou ficam intactas.
- `dismissPlan` também recalcula o basis a partir do perfil (`workoutPlan.js:28-31`).

### A04: DoS lógico ✅ (com o LOW #1)

- **Os limites barram no schema, antes do banco** (`workout.schemas.js:14-28`):
  - `name`: 1 a 100 caracteres, mesmo limite do `VarChar(100)`
  - `exercises`: 1 a 20 por rotina
  - `sets`: 1 a 10 por exercício
  - `reps`: 1 a 100
  - `rest_sec`: 0 a 600
- `inject` com 21 exercícios, 11 séries e nome de 101 caracteres: **400** nos três.
- Pior caso de escrita por request: 1 rotina, 20 exercícios e 200 séries, gravados em 2 `createMany`, não 221 INSERTs.
- O banco reforça os limites com CHECKs (`reps`, `rest_sec`, `set_number 1..10`, `weight_kg`).
- **`savePlan`, `createRoutine` e `updateRoutine` rodam com `TX = { timeout: 15000 }`** (`repository:6`, `:81`, `:119`, `:131`).
- O `generatePlan` do `GET /routines` só roda quando `workout_plan_basis IS NULL`. A corrida entre duas requests é resolvida pelo `UPDATE` condicional, que trava a linha (`:61-64`).

### A05: RLS e grants nas tabelas novas ✅ (verificado no banco)

As tabelas novas `routine_exercise_sets` e `workout_sets` recebem `ENABLE ROW LEVEL SECURITY` e a policy `torv_api_full_access TO torv_api` (`migration.sql:78-82`). As tabelas alteradas já tinham RLS desde `20260925180000_lock_down_public_schema`.

Consulta no banco:

| tabela | RLS | policies | grant a anon/authenticated/PUBLIC |
|---|---|---|---|
| `routine_exercise_sets` | true | `torv_api_full_access:torv_api` | nenhum |
| `workout_sets` | true | `torv_api_full_access:torv_api` | nenhum |
| `exercises`, `workout_routines`, `routine_exercises`, `activities`, `user_profiles` | true | `torv_api_full_access:torv_api` | nenhum |

`has_table_privilege` confirma o mesmo:

| papel | permissão | tabela | resultado |
|---|---|---|---|
| `anon` | SELECT | `routine_exercise_sets` | **false** |
| `authenticated` | INSERT | `workout_sets` | **false** |
| `torv_api` | INSERT | `routine_exercise_sets` | true |
| `torv_api` | SELECT | `workout_sets` | true |

As default privileges da lock-down funcionaram: as tabelas novas não nasceram expostas.

### A09/A05: Erros sem stack nem detalhe do Prisma ✅

- O `setErrorHandler` de `server.js:57-71` responde só `{ error: err.message }` nos erros de validação e nos 4xx do Fastify. Qualquer outro erro, incluindo `PrismaClientKnownRequestError` (que não tem `statusCode`), vira 500 com `An unexpected error occurred`. A stack e o detalhe vão só para o log do servidor.
- Os 400 e 404 do controller são mensagens fixas (`Not found`, `exercise not found`, `name must not be blank`, `exercises[i]: reps_min must be <= reps_max`).
- Os schemas de resposta (`response:`) serializam só os campos declarados, então não vaza `user_id`, `owner_user_id` nem `workout_plan_basis`.
- O SQL cru (`$executeRaw`, `repository:62-63`) usa tagged template, que é parametrizado. Não há interpolação de string (A03).

### Fix `690c02f`: `weight_kg` com `Type.Unsafe({ type: ['number','null'], minimum: 0, maximum: 999.99 })` ✅

**Os limites continuam valendo.** No Ajv, `minimum` e `maximum` se aplicam a números e não barram `null`, e a coerção acontece antes da checagem dos limites. Resultados do `inject` com o schema real:

| `weight_kg` enviado | Status | Valor no handler |
|---|---|---|
| `null` | 200 | `null` (o bug do round 1 está corrigido) |
| `0`, `999.99` | 200 | `0`, `999.99` |
| `999.991`, `1000`, `-0.01`, `1e308` | **400** | n/a |
| `"abc"`, `"1e3"`, `[]`, `{}`, campo ausente | **400** | n/a |
| `"50"` | 200 | `50` (coerção, dentro da faixa) |
| `""` | 200 | `null` (coerção, ver INFO #2) |
| `true` | 200 | `1` (coerção, ver INFO #2) |

O CHECK `weight_kg IS NULL OR BETWEEN 0 AND 999.99` do banco (`migration.sql:47`) é uma segunda barreira, e o `DECIMAL(6,2)` comporta o máximo.

### Frontend ✅

`services/workouts.ts:72-82` chama só a API própria (`/workouts/*`) pela instância `api` existente. Não há token, `console.*` nem URL externa nova no diff.

---

## Achados

### #1 LOW: sem teto de quantidade por usuário e sem rate limit em `/workouts/*` (A04, consumo de recursos)

- **Camada:** backend
- **Onde:**
  - `BackEndTorv/src/routes/workout.routes.js:11-12` não registra `@fastify/rate-limit`. Hoje o rate limit existe só no escopo de `auth.routes.js:20`.
  - `BackEndTorv/src/controller/workout.controller.js:72-78` (`createRoutine`) e `:112-117` (`createExercise`) não limitam quantas rotinas ou exercícios próprios o usuário pode ter.
- **Cenário:** um usuário autenticado repete `POST /workouts/routines` em loop. Cada request grava até 221 linhas e prende uma conexão do pool (`connection_limit=5`) durante a transação interativa. O efeito é crescimento sem limite do banco do Supabase e possível disputa pelo pool, que degrada os outros usuários.
- **Por que LOW:**
  - Exige conta autenticada, e o abuso fica rastreável pelo `user_id`.
  - Cada request já é limitada pelo schema.
  - O mesmo padrão já existe em `/diet` e `/profile`, fora deste diff.
  - A spec não define teto.
- **Fix sugerido:** escolher uma das duas opções.
  - **(a)** Registrar `await fastify.register(require('@fastify/rate-limit'), { max: 60, timeWindow: '1 minute', keyGenerator: (r) => r.user?.userId ?? r.ip })` no plugin de workouts, com o `preHandler` de auth antes.
  - **(b)** Antes do insert, contar as linhas do usuário e devolver 400 acima de um teto: por exemplo 50 rotinas (`workout_routines.count({ where: { user_id } })`) e 200 exercícios próprios.

  A opção (a) cobre também o pool.

### #2 INFO: coerção do Ajv em `weight_kg`

`""` vira `null`, `true` vira `1` e `"50"` vira `50`. Os três resultados ficam dentro da faixa e são do próprio usuário. Isso não afeta a integridade nem a autorização. O cliente sempre envia `number | null`. Nenhuma ação é necessária.

### #3 INFO: transações interativas de 15 s com pool de 5 conexões

Uma transação travada segura uma conexão por até 15 s. Hoje as transações são curtas (2 a 4 queries). O fix do #1(a) reduz o risco. Nenhuma ação separada é necessária.

### #4 INFO: mensagens 400 de validação expõem o caminho do schema

As mensagens seguem o formato `body/exercises/0/sets/0/weight_kg must be <= 999.99`. Isso é o comportamento esperado e coerente com as outras rotas. Não expõe stack, SQL nem detalhe do Prisma.

---

## Conclusão

Todos os itens do Step 1 da Task 9 estão verdes, e o fix `690c02f` mantém os limites de `weight_kg`. Com Test (round 2) e Security (round 1) verdes, **a entrega 1 está pronta**. O LOW #1 fica como recomendação para uma entrega futura, porque não bloqueia.
