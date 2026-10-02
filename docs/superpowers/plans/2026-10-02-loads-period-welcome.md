# Cargas por série, filtro de período, senha, boas-vindas e API no celular — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** registrar a carga de cada série e deixar o treino concluído atualizar a rotina; filtrar o Histórico por período; trocar os quadrados da senha por bolinhas; mostrar boas-vindas uma vez por conta; e fazer o app no Expo Go chamar a API.

**Architecture:**
- **Database:** uma migration com duas colunas, `workout_sets.weight_kg` e `user_profiles.welcomed_at`.
- **Backend:**
  - aceita e devolve a carga nas séries;
  - ganha `PATCH /workouts/routines/:id/weights`, que atualiza só as séries que ainda batem com a rotina;
  - ganha `from` no `GET /activities`;
  - ganha `welcome_pending` e `POST /profile/welcome`;
  - libera `PATCH` no CORS.
- **Frontend:**
  - guarda a carga no estado da sessão (função pura `setWeight`, com snapshot `planned_weights`);
  - mostra o card de atualizar a rotina no resumo;
  - calcula o período no fuso do aparelho (`utils/historyPeriod.ts`);
  - tira o host da API do `hostUri` do Expo.

**Tech Stack:**
- **Backend:** Node 24, Fastify 5 + TypeBox (Ajv com `coerceTypes`), Prisma 6.4.1 em Postgres/Supabase, testes com `node:test`.
- **Frontend:** React Native 0.86, Expo 57 e react-native-web 0.21.
  - Testes: `node --test` sobre `.mjs`, que importam `.ts` com type stripping.

**Spec:** `docs/superpowers/specs/2026-10-02-loads-period-welcome-design.md`

## Global Constraints

- Branch `feat/workout-module`. Nada de push.
- **Execução estritamente sequencial:** um recruit por vez. Cada etapa só começa depois do teste da etapa anterior verde.
- **Commit só dos arquivos da própria tarefa, com pathspec explícito.** Nunca entram em commit:
  - `FrontEndTorv/src/screens/Login/index.tsx` e `FrontEndTorv/tsconfig.json`;
  - `revisar*.md`;
  - o `FrontEndTorv/.env`.
  - Exceção: o `FrontEndTorv/src/services/api.ts` entra só no passo 5.1, que é a correção pedida pelo usuário.
- **Carga num corpo de request:** `Type.Unsafe({ type: ['number', 'null'], minimum: 0, maximum: 999.99 })`, nunca `Type.Union` (por causa do `coerceTypes` do Ajv).
- **Recurso de outro usuário:** responde 404, nunca 403.
- **O front chama só a nossa API:** sem cliente Supabase, sem segredo em `EXPO_PUBLIC_*`.
- **Backend:** roda no Furnace, e só o Maestro o para ou reinicia. Nunca suba outra instância na porta 3000.
- **Usabilidade:** no Expo web, pelo portal de navegador do Maestri. O token nunca sai do navegador.
- **Textos de UI:** em pt-BR, com vírgula decimal ("7,5 kg").
- **Toque e largura:** alvos de 44 px e layout que caiba em 320 px.
- **Relatórios** em `docs/`, um arquivo novo por rodada (`-roundN`), nunca sobrescrevendo.
- **Patches:** o código validado de cada passo está em `docs/superpowers/plans/2026-10-02-loads-period-welcome/*.diff`.
  - Aplique com `git apply <arquivo>` a partir da raiz do repositório. Se não aplicar, pare e avise o Maestro; não "conserte" o patch na mão.
  - Os mesmos diffs aparecem abaixo para leitura.

## Review Focus

1. **Carga digitada no treino:** o usuário digita "7,", "abc", "1000" ou apaga tudo.
   - O esperado: o app não quebra, texto inválido não muda a carga, 1000 vira 999,99 e campo vazio vira "Sem carga".
   - Coberto por `setWeight`/`parseWeight` (Task 5, passo 5.4) e pela usabilidade (Task 6).
2. **Rascunho de treino em andamento quando o app atualiza:** o treino continua, envia `weight_kg: null` nas séries antigas e não quebra o resumo.
   - Coberto pelo teste de `upgradeState` (5.4).
3. **Rotina editada entre o início e o fim do treino:** "Atualizar rotina" aplica só o que bate; se nada bater, mostra "A rotina mudou…". Rotina apagada mostra "Essa rotina não existe mais."
   - Coberto pelo teste do repository (Task 3, passo 3.1) e pela usabilidade (Task 6).
4. **Período Personalizado:**
   - cancelar no 1º ou no 2º passo mantém o filtro anterior;
   - o fim nunca fica antes do início;
   - os limites estão certos em qualquer fuso, inclusive virando mês e ano.
   - Coberto pelo teste de `periodRange` em 5 fusos (5.7) e pela usabilidade (Task 6).
5. **Boas-vindas:**
   - o POST falhando (sem rede) fecha o modal, que volta no próximo login;
   - "Começar" duas vezes não grava duas vezes, porque o `updateMany` só grava com `welcomed_at` nulo.
   - Coberto pelo teste de rota (3.3) e pela usabilidade (Task 6).

## Arquivos

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| DB | `BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql` | **Novo.** As 2 colunas e o CHECK |
| DB | `BackEndTorv/prisma/schema.prisma` | Os 2 campos |
| DB | `BancoDeDadosTorv/SQL BANCO DE DADOS.sql`, `Regras BD.sql` | Cópia de documentação do DDL e do CHECK |
| BE | `src/routes/workout.schemas.js` | `Weight` compartilhado; `weight_kg` em `SessionBody`/`SessionDetail`; `RoutineWeightsBody` |
| BE | `src/routes/workout.routes.js`, `src/controller/workout.controller.js` | `PATCH /routines/:id/weights`; `getSession` converte o Decimal |
| BE | `src/repository/workout.repository.js` | `updateRoutineWeights`; `weight_kg` no `createSession`/`getSession` |
| BE | `src/routes/activities.routes.js`, `src/controller/activities.controller.js`, `src/repository/activities.repository.js` | `from` |
| BE | `src/routes/profile.routes.js`, `src/controller/profile.controller.js`, `src/repository/profile.repository.js` | `welcome_pending`, `POST /welcome`, `markWelcomed` |
| BE | `server.js` | `PATCH` no CORS |
| BE | `src/repository/tests/workout.repository.test.js` (novo), `src/routes/profile.routes.test.js` (novo), `workout.sessions.test.js`, `workout.routes.test.js`, `activities.routes.test.js` | Testes |
| FE | `src/services/api.ts`, `package.json` (+ lock) | Host da API pelo `hostUri`; dependência `expo-constants` |
| FE | `src/components/Input/*` | Bolinhas na senha |
| FE | `src/contexts/AuthContext.tsx`, `src/components/WelcomeModal/*` (novo), `src/screens/Home/index.tsx` | Boas-vindas |
| FE | `src/utils/workoutSession.ts` (+ teste), `src/utils/workoutDraft.ts`, `src/services/workouts.ts` | Carga no estado, mudanças, payload e contrato |
| FE | `src/screens/WorkoutSession/*` | Controle − valor + |
| FE | `src/screens/WorkoutSummary/*` | Carga por série e card "Cargas diferentes da rotina" |
| FE | `src/utils/historyPeriod.ts` (+ teste), `src/services/activities.ts`, `src/components/DatePickerModal/*`, `src/screens/Workouts/History.tsx` | Filtro de período |

## Protocolo do Maestro

- **Antes da Task 1:** para o backend no Furnace (Ctrl-C), porque o `prisma generate` no Windows falha com EPERM com o engine em uso. Atualiza a nota "Feature- Módulo de Treinos".
- **Depois da Task 1:** sobe o backend de novo no Furnace (`npm run dev`).
- **Antes da Task 5:** guarda o diff local do usuário em `api.ts` no scratchpad. Ele tem 2 linhas:
  - fallback `127.0.0.1`;
  - um comentário com uma URL colada.
  - A correção da Task 5 absorve as duas (o fallback continua `127.0.0.1`), e isso fica registrado no `revisar3.md`.
- **Entre etapas:** confere o relatório e o commit, e atualiza a nota.
- **Rework:** se um teste falhar, o rework vai só para a camada responsável, e o teste da etapa roda de novo (`-round2`).
- **Fim:** escreve o `revisar3.md` (Task 9).

---

### Task 1: Database (Torv Database)

**Files:**
- Create: `BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql`
- Modify: `BackEndTorv/prisma/schema.prisma`
- Modify: `BancoDeDadosTorv/SQL BANCO DE DADOS.sql`, `BancoDeDadosTorv/Regras BD.sql`

**Interfaces:**
- **Produces:**
  - `workout_sets.weight_kg DECIMAL(6,2) NULL`, com CHECK 0–999,99;
  - `user_profiles.welcomed_at TIMESTAMPTZ NULL`;
  - Prisma Client regenerado com `workout_sets.weight_kg: Decimal | null` e `user_profiles.welcomed_at: Date | null`.

- [ ] **Passo 1.1: aplicar o patch**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/db.diff`

```diff
diff --git a/BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql b/BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql
new file mode 100644
index 0000000..2b4711c
--- /dev/null
+++ b/BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql
@@ -0,0 +1,7 @@
+-- Carga feita em cada série (NULL = sem carga, ou treino gravado antes desta migration)
+-- e o momento em que a pessoa viu a mensagem de boas-vindas (NULL = ainda não viu).
+ALTER TABLE "workout_sets"
+  ADD COLUMN "weight_kg" DECIMAL(6,2),
+  ADD CONSTRAINT "workout_sets_weight_kg_check" CHECK ("weight_kg" IS NULL OR "weight_kg" BETWEEN 0 AND 999.99);
+
+ALTER TABLE "user_profiles" ADD COLUMN "welcomed_at" TIMESTAMPTZ;
diff --git a/BackEndTorv/prisma/schema.prisma b/BackEndTorv/prisma/schema.prisma
index f361f97..7bcd789 100644
--- a/BackEndTorv/prisma/schema.prisma
+++ b/BackEndTorv/prisma/schema.prisma
@@ -40,6 +40,8 @@ model user_profiles {
   gender        String?   @db.VarChar(50)
   // basis {fitness_level, goals, gender} da última geração/decisão do plano default; NULL = nunca gerado
   workout_plan_basis Json? @db.JsonB
+  // NULL = ainda não viu a mensagem de boas-vindas
+  welcomed_at   DateTime? @db.Timestamptz
 
   user          users     @relation(fields: [user_id], references: [id], onDelete: Cascade)
 }
@@ -217,6 +219,7 @@ model workout_sets {
   set_number      Int
   duration_sec    Int
   rest_before_sec Int?
+  weight_kg       Decimal?   @db.Decimal(6, 2)
 
   activity        activities @relation(fields: [activity_id], references: [id], onDelete: Cascade)
   exercise        exercises? @relation(fields: [exercise_id], references: [id], onDelete: SetNull)
diff --git a/BancoDeDadosTorv/Regras BD.sql b/BancoDeDadosTorv/Regras BD.sql
index 83d9d44..a05f341 100644
--- a/BancoDeDadosTorv/Regras BD.sql	
+++ b/BancoDeDadosTorv/Regras BD.sql	
@@ -329,6 +329,9 @@ ALTER TABLE routine_exercise_sets ADD CONSTRAINT routine_exercise_sets_weight_kg
 ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_duration_sec_check CHECK (duration_sec BETWEEN 0 AND 3600);
 ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_rest_before_sec_check CHECK (rest_before_sec IS NULL OR rest_before_sec BETWEEN 0 AND 7200);
 
+--Carga por série (20261002120000_loads_welcome)
+ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_weight_kg_check CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 999.99);
+
 --Slots do gerador de treino (20261001150000_workout_generator_rules)
 ALTER TABLE workout_template_slots ADD CONSTRAINT workout_template_slots_day_check CHECK (day BETWEEN 1 AND days_per_week);
 ALTER TABLE workout_template_slots ADD CONSTRAINT workout_template_slots_position_check CHECK (position >= 1);
diff --git a/BancoDeDadosTorv/SQL BANCO DE DADOS.sql b/BancoDeDadosTorv/SQL BANCO DE DADOS.sql
index f603766..bb73606 100644
--- a/BancoDeDadosTorv/SQL BANCO DE DADOS.sql	
+++ b/BancoDeDadosTorv/SQL BANCO DE DADOS.sql	
@@ -8,6 +8,7 @@
 --   20260925210000_revoke_global_function_execute - tira o EXECUTE global de PUBLIC em functions novas (ver Gestao_e_Performance.sql, passo 1.3)
 --   20260930200000_workout_module      - módulo de treinos: catálogo + exercícios próprios, rotinas com séries, treinos finalizados (workout_sets)
 --   20261001150000_workout_generator_rules - regras do gerador de treino no banco (type/min_level/catalog_order + workout_template_slots)
+--   20261002120000_loads_welcome       - carga por série (workout_sets.weight_kg) e boas-vindas (user_profiles.welcomed_at)
 -- CHECKs ficam em "Regras BD.sql"; RLS e índices não-únicos em Gestao_e_Performance.sql.
 -- This file has no runtime effect; it exists for readability/presentation only.
 -- No CREATE DATABASE / USE statement here: Supabase already scopes a project to
@@ -36,7 +37,9 @@ CREATE TABLE user_profiles (
     -- basis (nível, objetivos, sexo) da última geração/aceite do plano de treino
     -- default; comparar com o perfil atual gera a sugestão de novo plano.
     -- NULL = plano default nunca gerado.
-    workout_plan_basis JSONB
+    workout_plan_basis JSONB,
+    -- momento em que a pessoa viu a mensagem de boas-vindas; NULL = ainda não viu
+    welcomed_at TIMESTAMPTZ
 );
 
 -- Os CHECKs abaixo saíram do antigo authController.register e viraram regra do
@@ -160,7 +163,7 @@ CREATE TABLE routine_exercise_sets (
     weight_kg DECIMAL(6,2)
 );
 
--- Séries de um treino finalizado (activities.activity_type = 'STRENGTH'). Só tempos;
+-- Séries de um treino finalizado (activities.activity_type = 'STRENGTH'): tempos e carga;
 -- exercise_name é cópia do nome no momento do treino (sobrevive ao exercício apagado).
 CREATE TABLE workout_sets (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
@@ -170,7 +173,8 @@ CREATE TABLE workout_sets (
     position INT NOT NULL,
     set_number INT NOT NULL,
     duration_sec INT NOT NULL,
-    rest_before_sec INT
+    rest_before_sec INT,
+    weight_kg DECIMAL(6,2) -- NULL = sem carga (ou treino anterior a 20261002120000_loads_welcome)
 );
 
 -- Aba Sessoes do gerador de treino: os slots do plano default por frequência
```

- [ ] **Passo 1.2: validar o schema**

Run: `cd BackEndTorv && npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`. O schema já não passava no `prisma format --check` antes desta mudança, então não rode `prisma format`.

- [ ] **Passo 1.3: aplicar no banco e gerar o client**

Run: `cd BackEndTorv && npx prisma migrate deploy && npx prisma generate && npx prisma migrate status`
Expected:
- `Applying migration 20261002120000_loads_welcome`;
- `Generated Prisma Client`;
- `Database schema is up to date!`.
- Com EPERM no generate (engine em uso): pare e avise o Maestro.

- [ ] **Passo 1.4: conferir a regra no banco** (Supabase MCP `execute_sql`, só estrutura; não leia dados de usuário)

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'workout_sets_weight_kg_check';
SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
 WHERE (table_name, column_name) IN (('workout_sets','weight_kg'), ('user_profiles','welcomed_at'));
```
Expected:
- o CHECK com `weight_kg >= 0 AND weight_kg <= 999.99` (ou `BETWEEN`);
- `numeric` e `timestamp with time zone`, os dois com `is_nullable = YES`.

- [ ] **Passo 1.5: backend continua verde**

Run: `cd BackEndTorv && npm test`
Expected: os 83 testes atuais passam, e nenhum teste novo ainda.

- [ ] **Passo 1.6: commit**

```bash
git add "BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql" BackEndTorv/prisma/schema.prisma "BancoDeDadosTorv/SQL BANCO DE DADOS.sql" "BancoDeDadosTorv/Regras BD.sql"
git commit -m "feat(db): workout_sets.weight_kg and user_profiles.welcomed_at" -- "BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql" BackEndTorv/prisma/schema.prisma "BancoDeDadosTorv/SQL BANCO DE DADOS.sql" "BancoDeDadosTorv/Regras BD.sql"
```

### Task 2: Teste da etapa Database (Torv Review and Tests)

- [ ] Relatório `docs/qa-loads-welcome-database-2026-10-02.md`. Cobre:
  - `prisma migrate status` em dia;
  - o CHECK no catálogo;
  - um teste do CHECK numa transação com ROLLBACK, sem gravar dados: um INSERT em `workout_sets` com `weight_kg` -1 e com 1000 falha; com 0, 999,99 e NULL passa (`BEGIN; … ROLLBACK;`, usando uma activity criada na própria transação);
  - `npm test` do backend verde;
  - o diff do commit da Task 1 só com os 4 arquivos.
- [ ] Commit só do relatório.

### Task 3: Backend (Torv Backend)

**Interfaces:**
- **Consumes:** as colunas da Task 1, já com o Prisma Client regenerado.
- **Produces:**
  - **Sessões:**
    - `POST /workouts/sessions`: cada item de `sets` aceita `weight_kg` opcional (`number` 0–999,99 ou `null`);
    - `GET /workouts/sessions/:id`: cada série traz `weight_kg: number | null`.
  - **`PATCH /workouts/routines/:id/weights`:**
    - body `{ sets: [{ position: 1..20, exercise_id: uuid, set_number: 1..10, weight_kg: number|null }] }` (1–200 itens);
    - responde 200 `{ updated: number }`, ou 404 para rotina de outro usuário ou inexistente.
  - **`GET /activities`:** `from` opcional (date-time, inclusivo), combinável com `before`.
  - **Perfil:**
    - `GET /profile` ganha `welcome_pending: boolean`;
    - `POST /profile/welcome` responde 204 e é idempotente.
  - **CORS:** `methods` inclui `PATCH`.

- [ ] **Passo 3.1: testes de carga e do PATCH (vermelho)**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/be_w_tests.diff`

```diff
diff --git a/BackEndTorv/src/repository/tests/workout.repository.test.js b/BackEndTorv/src/repository/tests/workout.repository.test.js
new file mode 100644
index 0000000..ae6722a
--- /dev/null
+++ b/BackEndTorv/src/repository/tests/workout.repository.test.js
@@ -0,0 +1,64 @@
+const test = require('node:test');
+const assert = require('node:assert/strict');
+
+// Prisma falso (o client real é um Proxy que o mock.method não alcança): $transaction roda o callback
+// com a transação do teste em andamento.
+let tx = null;
+const prismaPath = require.resolve('../../lib/prisma');
+require.cache[prismaPath] = {
+  id: prismaPath, filename: prismaPath, loaded: true,
+  exports: { $transaction: async (fn) => fn(tx) },
+};
+
+const workoutRepository = require('../workout.repository');
+
+const USER = '11111111-1111-4111-8111-111111111111';
+const ROUTINE = '22222222-2222-4222-8222-222222222222';
+const SUPINO = '33333333-3333-4333-8333-333333333333';
+const REMADA = '55555555-5555-4555-8555-555555555555';
+
+// Rotina com Supino na posição 1 e Remada na 2, as duas com 3 séries.
+function useTx(routine) {
+  const calls = { findFirst: [], updateMany: [] };
+  tx = {
+    workout_routines: {
+      findFirst: async (args) => { calls.findFirst.push(args); return routine; },
+    },
+    routine_exercise_sets: {
+      updateMany: async (args) => { calls.updateMany.push(args); return { count: args.where.set_number <= 3 ? 1 : 0 }; },
+    },
+  };
+  return calls;
+}
+
+const routine = {
+  routine_exercises: [
+    { id: 're-supino', position: 1, exercise_id: SUPINO },
+    { id: 're-remada', position: 2, exercise_id: REMADA },
+  ],
+};
+
+test('updateRoutineWeights: só muda séries que batem com posição + exercício; conta as atualizadas', async () => {
+  const calls = useTx(routine);
+  const updated = await workoutRepository.updateRoutineWeights(USER, ROUTINE, [
+    { position: 1, exercise_id: SUPINO, set_number: 2, weight_kg: 65 },
+    { position: 2, exercise_id: REMADA, set_number: 1, weight_kg: null },
+    { position: 2, exercise_id: SUPINO, set_number: 1, weight_kg: 50 }, // exercício trocou de lugar na rotina
+    { position: 3, exercise_id: REMADA, set_number: 1, weight_kg: 50 }, // posição não existe mais
+    { position: 1, exercise_id: SUPINO, set_number: 4, weight_kg: 70 }, // série removida da rotina: UPDATE conta 0
+  ]);
+  assert.equal(updated, 2);
+  assert.deepEqual(calls.findFirst[0].where, { id: ROUTINE, user_id: USER });
+  assert.deepEqual(calls.updateMany, [
+    { where: { routine_exercise_id: 're-supino', set_number: 2 }, data: { weight_kg: 65 } },
+    { where: { routine_exercise_id: 're-remada', set_number: 1 }, data: { weight_kg: null } },
+    { where: { routine_exercise_id: 're-supino', set_number: 4 }, data: { weight_kg: 70 } },
+  ]);
+});
+
+test('updateRoutineWeights: rotina de outro usuário (ou inexistente) → null, sem UPDATE', async () => {
+  const calls = useTx(null);
+  const sets = [{ position: 1, exercise_id: SUPINO, set_number: 1, weight_kg: 40 }];
+  assert.equal(await workoutRepository.updateRoutineWeights(USER, ROUTINE, sets), null);
+  assert.equal(calls.updateMany.length, 0);
+});
diff --git a/BackEndTorv/src/routes/workout.routes.test.js b/BackEndTorv/src/routes/workout.routes.test.js
index 63083dd..0109959 100644
--- a/BackEndTorv/src/routes/workout.routes.test.js
+++ b/BackEndTorv/src/routes/workout.routes.test.js
@@ -205,3 +205,37 @@ test('exercícios: lista marca is_custom; criar valida grupo e nome; alheio →
   assert.equal((await call(app, 'PUT', `/workouts/exercises/${EX}`, { name: 'Y', muscle_group: 'Costas' })).statusCode, 200);
   assert.equal((await call(app, 'DELETE', `/workouts/exercises/${EX}`)).statusCode, 204);
 });
+
+test('PATCH /routines/:id/weights: repassa userId, id e séries (null e 0 intactos); null do repository → 404', async (t) => {
+  const update = t.mock.method(workoutRepository, 'updateRoutineWeights', async () => 3);
+  const app = await build(t);
+  const sets = [
+    { position: 1, exercise_id: EX, set_number: 1, weight_kg: 42.5 },
+    { position: 1, exercise_id: EX, set_number: 2, weight_kg: null },
+    { position: 1, exercise_id: EX, set_number: 3, weight_kg: 0 },
+  ];
+  const res = await call(app, 'PATCH', `/workouts/routines/${ID}/weights`, { sets });
+  assert.equal(res.statusCode, 200);
+  assert.deepEqual(res.json(), { updated: 3 });
+  assert.deepEqual(update.mock.calls[0].arguments, [USER, ID, sets]);
+  update.mock.mockImplementation(async () => null);
+  assert.equal((await call(app, 'PATCH', `/workouts/routines/${ID}/weights`, { sets })).statusCode, 404);
+});
+
+test('PATCH /routines/:id/weights 400: corpo e id inválidos não chegam ao repository', async (t) => {
+  const update = t.mock.method(workoutRepository, 'updateRoutineWeights', async () => 0);
+  const app = await build(t);
+  const set = { position: 1, exercise_id: EX, set_number: 1, weight_kg: 40 };
+  const { weight_kg, ...noWeight } = set;
+  for (const body of [
+    {}, { sets: [] }, { sets: Array(201).fill(set) },
+    { sets: [{ ...set, position: 0 }] }, { sets: [{ ...set, position: 21 }] },
+    { sets: [{ ...set, set_number: 0 }] }, { sets: [{ ...set, set_number: 11 }] },
+    { sets: [{ ...set, weight_kg: -1 }] }, { sets: [{ ...set, weight_kg: 1000 }] },
+    { sets: [{ ...set, exercise_id: 'nope' }] }, { sets: [noWeight] },
+  ]) {
+    assert.equal((await call(app, 'PATCH', `/workouts/routines/${ID}/weights`, body)).statusCode, 400, JSON.stringify(body).slice(0, 80));
+  }
+  assert.equal((await call(app, 'PATCH', '/workouts/routines/nope/weights', { sets: [set] })).statusCode, 400);
+  assert.equal(update.mock.callCount(), 0);
+});
diff --git a/BackEndTorv/src/routes/workout.sessions.test.js b/BackEndTorv/src/routes/workout.sessions.test.js
index 3f1bb4e..dc055ad 100644
--- a/BackEndTorv/src/routes/workout.sessions.test.js
+++ b/BackEndTorv/src/routes/workout.sessions.test.js
@@ -136,3 +136,37 @@ test('POST /sessions: null fica null, 0 fica 0 (rest_before_sec e routine_id)',
   }
   assert.equal(create.mock.callCount(), 2);
 });
+
+test('POST /sessions: weight_kg número, 0, null e ausente chegam ao repository; fora da faixa → 400', async (t) => {
+  t.mock.method(workoutRepository, 'findSessionByStart', async () => null);
+  const create = t.mock.method(workoutRepository, 'createSession', async () => ACT);
+  const app = await build(t);
+  const [a, b] = validSession.sets;
+  const sets = [
+    { ...a, weight_kg: 62.5 },
+    { ...b, weight_kg: 0 },
+    { ...b, set_number: 3, weight_kg: null },
+    { ...b, set_number: 4 }, // app antigo: sem o campo
+  ];
+  assert.equal((await call(app, 'POST', '/workouts/sessions', { ...validSession, sets })).statusCode, 201);
+  assert.deepEqual(create.mock.calls[0].arguments[1].sets.map((s) => s.weight_kg), [62.5, 0, null, undefined]);
+  for (const weight_kg of [-1, 1000, '60kg']) {
+    const res = await call(app, 'POST', '/workouts/sessions', { ...validSession, sets: [{ ...a, weight_kg }] });
+    assert.equal(res.statusCode, 400, String(weight_kg));
+  }
+  assert.equal(create.mock.callCount(), 1);
+});
+
+test('GET /sessions/:id: weight_kg Decimal vira número; null fica null', async (t) => {
+  t.mock.method(workoutRepository, 'getSession', async () => ({
+    id: ACT, title: 'Peito', start_time: new Date(startedAt), duration_sec: 3000,
+    workout_sets: [
+      { exercise_name: 'Supino', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null, weight_kg: '62.50' },
+      { exercise_name: 'Supino', position: 1, set_number: 2, duration_sec: 40, rest_before_sec: 90, weight_kg: null },
+    ],
+  }));
+  const app = await build(t);
+  const res = await call(app, 'GET', `/workouts/sessions/${ACT}`);
+  assert.equal(res.statusCode, 200);
+  assert.deepEqual(res.json().sets.map((s) => s.weight_kg), [62.5, null]);
+});
```

Run: `cd BackEndTorv && npm test`
Expected: FAIL nos testes novos. São estes:
- `updateRoutineWeights is not a function`;
- PATCH → 404 da rota inexistente;
- `weight_kg` ausente nos argumentos do `createSession`;
- carga -1 aceita.

- [ ] **Passo 3.2: implementação de carga e do PATCH (verde)**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/be_w_impl.diff`

```diff
diff --git a/BackEndTorv/src/controller/workout.controller.js b/BackEndTorv/src/controller/workout.controller.js
index 08f794e..20d3c9c 100644
--- a/BackEndTorv/src/controller/workout.controller.js
+++ b/BackEndTorv/src/controller/workout.controller.js
@@ -94,6 +94,11 @@ class WorkoutController {
     return reply.send(routineDetail(await workoutRepository.getRoutine(userId, id)));
   }
 
+  async updateRoutineWeights(request, reply) {
+    const updated = await workoutRepository.updateRoutineWeights(request.user.userId, request.params.id, request.body.sets);
+    return updated === null ? reply.status(404).send(NOT_FOUND) : reply.send({ updated });
+  }
+
   async deleteRoutine(request, reply) {
     const deleted = await workoutRepository.deleteRoutine(request.user.userId, request.params.id);
     return deleted ? reply.status(204).send() : reply.status(404).send(NOT_FOUND);
@@ -160,7 +165,13 @@ class WorkoutController {
   async getSession(request, reply) {
     const s = await workoutRepository.getSession(request.user.userId, request.params.id);
     if (!s) return reply.status(404).send(NOT_FOUND);
-    return reply.send({ id: s.id, title: s.title, start_time: s.start_time.toISOString(), duration_sec: s.duration_sec, sets: s.workout_sets });
+    return reply.send({
+      id: s.id,
+      title: s.title,
+      start_time: s.start_time.toISOString(),
+      duration_sec: s.duration_sec,
+      sets: s.workout_sets.map((w) => ({ ...w, weight_kg: w.weight_kg == null ? null : Number(w.weight_kg) })),
+    });
   }
 }
 
diff --git a/BackEndTorv/src/repository/workout.repository.js b/BackEndTorv/src/repository/workout.repository.js
index 9953fce..e8a1cf4 100644
--- a/BackEndTorv/src/repository/workout.repository.js
+++ b/BackEndTorv/src/repository/workout.repository.js
@@ -151,6 +151,31 @@ class WorkoutRepository {
     }, TX);
   }
 
+  // Só as séries que ainda batem com a rotina (posição + exercício + nº da série) mudam: rotina editada no
+  // meio do treino não recebe carga no lugar errado. null = rotina não é do usuário.
+  // ponytail: 1 UPDATE por série (≤ 200, em geral poucas); um UPDATE ... FROM (VALUES ...) se pesar.
+  async updateRoutineWeights(userId, routineId, sets) {
+    return prisma.$transaction(async (tx) => {
+      const routine = await tx.workout_routines.findFirst({
+        where: { id: routineId, user_id: userId },
+        select: { routine_exercises: { select: { id: true, position: true, exercise_id: true } } },
+      });
+      if (!routine) return null;
+      const byPosition = new Map(routine.routine_exercises.map((e) => [e.position, e]));
+      let updated = 0;
+      for (const s of sets) {
+        const ex = byPosition.get(s.position);
+        if (!ex || ex.exercise_id !== s.exercise_id) continue;
+        const { count } = await tx.routine_exercise_sets.updateMany({
+          where: { routine_exercise_id: ex.id, set_number: s.set_number },
+          data: { weight_kg: s.weight_kg },
+        });
+        updated += count;
+      }
+      return updated;
+    }, TX);
+  }
+
   async deleteRoutine(userId, id) {
     const { count } = await prisma.workout_routines.deleteMany({ where: { id, user_id: userId } });
     return count > 0;
@@ -218,6 +243,7 @@ class WorkoutRepository {
           set_number: s.set_number,
           duration_sec: s.duration_sec,
           rest_before_sec: s.rest_before_sec,
+          weight_kg: s.weight_kg ?? null,
         })),
       });
       return activity.id;
@@ -234,7 +260,7 @@ class WorkoutRepository {
         duration_sec: true,
         workout_sets: {
           orderBy: [{ position: 'asc' }, { set_number: 'asc' }],
-          select: { exercise_name: true, position: true, set_number: true, duration_sec: true, rest_before_sec: true },
+          select: { exercise_name: true, position: true, set_number: true, duration_sec: true, rest_before_sec: true, weight_kg: true },
         },
       },
     });
diff --git a/BackEndTorv/src/routes/workout.routes.js b/BackEndTorv/src/routes/workout.routes.js
index 16413ce..f10a641 100644
--- a/BackEndTorv/src/routes/workout.routes.js
+++ b/BackEndTorv/src/routes/workout.routes.js
@@ -3,7 +3,7 @@ const workoutController = require('../controller/workout.controller');
 const authenticateToken = require('../middlewares/auth.middleware');
 const {
   errors, IdParams, RoutineBody, RoutineList, RoutineDetail,
-  ExerciseBody, Exercise, SessionBody, SessionDetail,
+  ExerciseBody, Exercise, SessionBody, SessionDetail, RoutineWeightsBody,
 } = require('./workout.schemas');
 
 const tags = ['Workouts'];
@@ -36,6 +36,14 @@ async function workoutRoutes(fastify) {
     },
   }, workoutController.updateRoutine);
 
+  fastify.patch('/routines/:id/weights', {
+    schema: {
+      description: 'Atualiza só as cargas das séries que ainda batem com a rotina (posição + exercício + nº da série)',
+      tags, security, params: IdParams, body: RoutineWeightsBody,
+      response: { 200: Type.Object({ updated: Type.Integer() }), ...errors(400, 401, 403, 404) },
+    },
+  }, workoutController.updateRoutineWeights);
+
   fastify.delete('/routines/:id', {
     schema: { tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
   }, workoutController.deleteRoutine);
diff --git a/BackEndTorv/src/routes/workout.schemas.js b/BackEndTorv/src/routes/workout.schemas.js
index 30b1235..6f45118 100644
--- a/BackEndTorv/src/routes/workout.schemas.js
+++ b/BackEndTorv/src/routes/workout.schemas.js
@@ -10,6 +10,9 @@ const ErrorBody = Type.Object({ error: Type.String() });
 const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));
 const IdParams = Type.Object({ id: Uuid });
 const MuscleGroup = Type.Union(MUSCLE_GROUPS.map((g) => Type.Literal(g)));
+// Carga nullable num corpo: type array, não Union. Com coerceTypes o Ajv coage no 1º ramo do anyOf
+// (Number: null→0; Null: 0→null); com type ['number','null'] só coage o que não for nenhum dos dois.
+const Weight = Type.Unsafe({ type: ['number', 'null'], minimum: 0, maximum: 999.99 });
 
 const RoutineBody = Type.Object({
   name: Type.String({ minLength: 1, maxLength: 100 }),
@@ -18,12 +21,7 @@ const RoutineBody = Type.Object({
     reps_min: Type.Integer({ minimum: 1, maximum: 100 }),
     reps_max: Type.Integer({ minimum: 1, maximum: 100 }),
     rest_sec: Type.Integer({ minimum: 0, maximum: 600 }),
-    sets: Type.Array(
-      // type array, não Union: com coerceTypes o Ajv coage no 1º ramo do anyOf (Number: null→0; Null: 0→null).
-      // Com type ['number','null'] só coage o que não for nenhum dos dois.
-      Type.Object({ weight_kg: Type.Unsafe({ type: ['number', 'null'], minimum: 0, maximum: 999.99 }) }),
-      { minItems: 1, maxItems: 10 },
-    ),
+    sets: Type.Array(Type.Object({ weight_kg: Weight }), { minItems: 1, maxItems: 10 }),
   }), { minItems: 1, maxItems: 20 }),
 });
 
@@ -85,6 +83,7 @@ const SessionBody = Type.Object({
     set_number: Type.Integer({ minimum: 1, maximum: 10 }),
     duration_sec: Type.Integer({ minimum: 0, maximum: 3600 }),
     rest_before_sec: Type.Unsafe({ type: ['integer', 'null'], minimum: 0, maximum: 7200 }),
+    weight_kg: Type.Optional(Weight), // ausente (app antigo) → grava null
   }), { minItems: 1, maxItems: 200 }),
 });
 
@@ -99,10 +98,21 @@ const SessionDetail = Type.Object({
     set_number: Type.Integer(),
     duration_sec: Type.Integer(),
     rest_before_sec: Type.Union([Type.Integer(), Type.Null()]),
+    weight_kg: Type.Union([Type.Number(), Type.Null()]),
   })),
 });
 
+// Cargas feitas no treino → rotina. Série que não bate com a rotina atual (posição + exercício + nº) é ignorada.
+const RoutineWeightsBody = Type.Object({
+  sets: Type.Array(Type.Object({
+    position: Type.Integer({ minimum: 1, maximum: 20 }),
+    exercise_id: Uuid,
+    set_number: Type.Integer({ minimum: 1, maximum: 10 }),
+    weight_kg: Weight,
+  }), { minItems: 1, maxItems: 200 }),
+});
+
 module.exports = {
   MUSCLE_GROUPS, errors, IdParams, RoutineBody, RoutineList, RoutineDetail,
-  ExerciseBody, Exercise, SessionBody, SessionDetail,
+  ExerciseBody, Exercise, SessionBody, SessionDetail, RoutineWeightsBody,
 };
```

Run: `cd BackEndTorv && npm test`
Expected: todos passam.

Commit:
```bash
git add BackEndTorv/src/repository/tests/workout.repository.test.js
git commit -m "feat(workouts): weight per set in sessions and PATCH routine weights" -- BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/routes/workout.sessions.test.js BackEndTorv/src/routes/workout.routes.test.js BackEndTorv/src/repository/tests/workout.repository.test.js
```

- [ ] **Passo 3.3: perfil e boas-vindas (vermelho → verde)**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/be_p_tests.diff`

```diff
diff --git a/BackEndTorv/src/routes/profile.routes.test.js b/BackEndTorv/src/routes/profile.routes.test.js
new file mode 100644
index 0000000..9c3d26d
--- /dev/null
+++ b/BackEndTorv/src/routes/profile.routes.test.js
@@ -0,0 +1,55 @@
+const test = require('node:test');
+const assert = require('node:assert/strict');
+const Fastify = require('fastify');
+
+// O middleware real valida JWT contra o JWKS do Supabase. Aqui todo request é do USER.
+const USER = '11111111-1111-4111-8111-111111111111';
+const authPath = require.resolve('../middlewares/auth.middleware');
+require.cache[authPath] = {
+  id: authPath, filename: authPath, loaded: true,
+  exports: async (request) => { request.user = { userId: USER }; },
+};
+
+const profileRepository = require('../repository/profile.repository');
+
+async function build(t) {
+  const app = Fastify();
+  app.register(require('./profile.routes'), { prefix: '/profile' });
+  t.after(() => app.close());
+  await app.ready();
+  return app;
+}
+
+const userRow = (profile) => ({
+  id: USER,
+  email: 'ana@torvtest.dev',
+  user_profiles: profile,
+  user_streaks: null,
+  user_measurements: [],
+  workout_counts: { total: 0, month: 0 },
+});
+const baseProfile = {
+  username: 'ana', name: 'Ana', fitness_level: 'INICIANTE', goal: 'Perder Peso',
+  photo_url: null, birth_date: null, gender: 'Feminino',
+};
+
+test('GET /profile: welcome_pending = welcomed_at nulo', async (t) => {
+  const get = t.mock.method(profileRepository, 'getUserProfile', async () => userRow({ ...baseProfile, welcomed_at: null }));
+  const app = await build(t);
+  let res = await app.inject({ method: 'GET', url: '/profile' });
+  assert.equal(res.statusCode, 200);
+  assert.equal(res.json().welcome_pending, true);
+  assert.equal(get.mock.calls[0].arguments[0], USER);
+
+  get.mock.mockImplementation(async () => userRow({ ...baseProfile, welcomed_at: new Date() }));
+  res = await app.inject({ method: 'GET', url: '/profile' });
+  assert.equal(res.json().welcome_pending, false);
+});
+
+test('POST /profile/welcome: 204 e grava para o usuário do token (sem corpo ou com {})', async (t) => {
+  const mark = t.mock.method(profileRepository, 'markWelcomed', async () => {});
+  const app = await build(t);
+  assert.equal((await app.inject({ method: 'POST', url: '/profile/welcome' })).statusCode, 204);
+  assert.equal((await app.inject({ method: 'POST', url: '/profile/welcome', payload: {} })).statusCode, 204);
+  assert.deepEqual(mark.mock.calls.map((c) => c.arguments), [[USER], [USER]]);
+});
```

Run: `cd BackEndTorv && node --test src/routes/profile.routes.test.js`
Expected: FAIL, com `welcome_pending` undefined e `POST /profile/welcome` → 404.

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/be_p_impl.diff`

```diff
diff --git a/BackEndTorv/src/controller/profile.controller.js b/BackEndTorv/src/controller/profile.controller.js
index d9d6b2b..06071bf 100644
--- a/BackEndTorv/src/controller/profile.controller.js
+++ b/BackEndTorv/src/controller/profile.controller.js
@@ -61,6 +61,7 @@ class ProfileController {
         followers: 0,
         following: 0,
         total_workouts: user.workout_counts.total,
+        welcome_pending: profile.welcomed_at == null,
       });
     } catch (error) {
       request.log.error(error);
@@ -69,6 +70,11 @@ class ProfileController {
     }
   }
 
+  async markWelcomed(request, reply) {
+    await profileRepository.markWelcomed(request.user.userId);
+    return reply.status(204).send();
+  }
+
   async uploadPhoto(request, reply) {
     try {
       const { userId } = request.user;
diff --git a/BackEndTorv/src/repository/profile.repository.js b/BackEndTorv/src/repository/profile.repository.js
index 339b644..b546317 100644
--- a/BackEndTorv/src/repository/profile.repository.js
+++ b/BackEndTorv/src/repository/profile.repository.js
@@ -25,6 +25,11 @@ class ProfileRepository {
     };
   }
 
+  // Só a 1ª vez grava: repetir não muda o horário.
+  async markWelcomed(userId) {
+    await prisma.user_profiles.updateMany({ where: { user_id: userId, welcomed_at: null }, data: { welcomed_at: new Date() } });
+  }
+
   async updatePhotoUrl(userId, photoUrl) {
     return await prisma.user_profiles.update({
       where: { user_id: userId },
diff --git a/BackEndTorv/src/routes/profile.routes.js b/BackEndTorv/src/routes/profile.routes.js
index eef4d77..3cf4d66 100644
--- a/BackEndTorv/src/routes/profile.routes.js
+++ b/BackEndTorv/src/routes/profile.routes.js
@@ -30,6 +30,7 @@ async function profileRoutes(fastify) {
         followers: Type.Number(),
         following: Type.Number(),
         total_workouts: Type.Number(),
+        welcome_pending: Type.Boolean(),
       }),
       404: Type.Object({ error: Type.String() }),
       500: Type.Object({ error: Type.String() }),
@@ -38,6 +39,15 @@ async function profileRoutes(fastify) {
 
   fastify.get('/', { schema: getProfileSchema }, profileController.getProfile);
 
+  fastify.post('/welcome', {
+    schema: {
+      description: 'Marca a mensagem de boas-vindas como vista. Idempotente: só a 1ª chamada grava o horário',
+      tags: ['Profile'],
+      security: [{ bearerAuth: [] }],
+      response: { 204: Type.Null() },
+    },
+  }, profileController.markWelcomed);
+
   const uploadPhotoSchema = {
     description: 'Faz upload de uma nova foto de perfil (multipart/form-data, campo "photo")',
     tags: ['Profile'],
```

Run: `cd BackEndTorv && npm test`
Expected: todos passam.

Commit:
```bash
git add BackEndTorv/src/routes/profile.routes.test.js
git commit -m "feat(profile): welcome_pending and POST /profile/welcome" -- BackEndTorv/src/routes/profile.routes.js BackEndTorv/src/controller/profile.controller.js BackEndTorv/src/repository/profile.repository.js BackEndTorv/src/routes/profile.routes.test.js
```

- [ ] **Passo 3.4: `from` no `/activities` (vermelho → verde)**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/be_a_tests.diff`

```diff
diff --git a/BackEndTorv/src/routes/activities.routes.test.js b/BackEndTorv/src/routes/activities.routes.test.js
index 25252a5..6861d71 100644
--- a/BackEndTorv/src/routes/activities.routes.test.js
+++ b/BackEndTorv/src/routes/activities.routes.test.js
@@ -41,7 +41,7 @@ test('GET /activities: limit padrão 20, sem filtro; página incompleta → next
     ],
     next_before: null,
   });
-  assert.deepEqual(list.mock.calls[0].arguments, [USER, { type: undefined, before: undefined, limit: 20 }]);
+  assert.deepEqual(list.mock.calls[0].arguments, [USER, { type: undefined, from: undefined, before: undefined, limit: 20 }]);
 });
 
 test('GET /activities: página cheia → next_before = start_time do último; type/before/limit repassados', async (t) => {
@@ -65,6 +65,7 @@ test('GET /activities 400: type, limit e before inválidos não chegam ao reposi
     'type=RUN', 'type=strength', 'limit=0', 'limit=51', 'limit=abc', 'before=ontem', 'before=2026-10-01',
     // Passam no date-time do ajv-formats, mas o Date do JS não parseia (fuso só com hora, segundo bissexto). %2B = '+'.
     'before=2026-10-01T10:00:00-03', 'before=2026-06-30T23:59:60Z', 'before=2026-10-01T02:59:60%2B03:00',
+    'from=ontem', 'from=2026-10-01', 'from=2026-10-01T10:00:00-03', 'from=2026-06-30T23:59:60Z',
   ]) {
     assert.equal((await get(app, `/activities?${qs}`)).statusCode, 400, qs);
   }
@@ -78,3 +79,13 @@ test('GET /activities: user_id vindo do cliente é ignorado', async (t) => {
   assert.equal(res.statusCode, 200);
   assert.equal(list.mock.calls[0].arguments[0], USER);
 });
+
+test('GET /activities: from e before viram Date e chegam juntos ao repository', async (t) => {
+  const list = t.mock.method(activitiesRepository, 'listActivities', async () => []);
+  const app = await build(t);
+  const res = await get(app, '/activities?from=2026-09-01T03:00:00.000Z&before=2026-10-01T03:00:00.000Z');
+  assert.equal(res.statusCode, 200);
+  const { from, before } = list.mock.calls[0].arguments[1];
+  assert.ok(from instanceof Date && before instanceof Date);
+  assert.deepEqual([from.toISOString(), before.toISOString()], ['2026-09-01T03:00:00.000Z', '2026-10-01T03:00:00.000Z']);
+});
```

Run: `cd BackEndTorv && node --test src/routes/activities.routes.test.js`
Expected: FAIL. O `from` não chega ao repository, e os `from` inválidos passam com 200.

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/be_a_impl.diff`

```diff
diff --git a/BackEndTorv/src/controller/activities.controller.js b/BackEndTorv/src/controller/activities.controller.js
index 4d5a904..c726a0c 100644
--- a/BackEndTorv/src/controller/activities.controller.js
+++ b/BackEndTorv/src/controller/activities.controller.js
@@ -4,13 +4,16 @@ const DEFAULT_LIMIT = 20;
 
 class ActivitiesController {
   async listActivities(request, reply) {
-    const { type, before, limit = DEFAULT_LIMIT } = request.query;
-    // O date-time do schema aceita formas que o Date do JS não parseia (fuso só com hora, segundo bissexto).
+    const { type, from, before, limit = DEFAULT_LIMIT } = request.query;
+    const fromDate = from ? new Date(from) : undefined;
     const beforeDate = before ? new Date(before) : undefined;
-    if (beforeDate && Number.isNaN(beforeDate.getTime())) {
-      return reply.status(400).send({ error: 'querystring/before must match format "date-time"' });
+    // O date-time do schema aceita formas que o Date do JS não parseia (fuso só com hora, segundo bissexto).
+    for (const [name, date] of [['from', fromDate], ['before', beforeDate]]) {
+      if (date && Number.isNaN(date.getTime())) {
+        return reply.status(400).send({ error: `querystring/${name} must match format "date-time"` });
+      }
     }
-    const rows = await activitiesRepository.listActivities(request.user.userId, { type, before: beforeDate, limit });
+    const rows = await activitiesRepository.listActivities(request.user.userId, { type, from: fromDate, before: beforeDate, limit });
     return reply.send({
       activities: rows.map((a) => ({
         id: a.id,
diff --git a/BackEndTorv/src/repository/activities.repository.js b/BackEndTorv/src/repository/activities.repository.js
index 6de9919..23cca91 100644
--- a/BackEndTorv/src/repository/activities.repository.js
+++ b/BackEndTorv/src/repository/activities.repository.js
@@ -1,14 +1,14 @@
 const prisma = require('../lib/prisma');
 
 class ActivitiesRepository {
-  // Mais recente primeiro. Sem start_time não dá para pôr no histórico, então fica de fora.
+  // Mais recente primeiro. Sem start_time não dá para pôr no histórico, então fica de fora (gte/lt já excluem NULL).
   // ponytail: cursor só por start_time (único por usuário em STRENGTH); com outro tipo, empate é possível → (start_time, id).
-  async listActivities(userId, { type, before, limit }) {
+  async listActivities(userId, { type, from, before, limit }) {
     return prisma.activities.findMany({
       where: {
         user_id: userId,
         ...(type && { activity_type: type }),
-        start_time: before ? { lt: before } : { not: null },
+        start_time: from || before ? { ...(from && { gte: from }), ...(before && { lt: before }) } : { not: null },
       },
       orderBy: { start_time: 'desc' },
       take: limit,
diff --git a/BackEndTorv/src/routes/activities.routes.js b/BackEndTorv/src/routes/activities.routes.js
index 0f3be24..3ad0fb9 100644
--- a/BackEndTorv/src/routes/activities.routes.js
+++ b/BackEndTorv/src/routes/activities.routes.js
@@ -25,11 +25,12 @@ async function activitiesRoutes(fastify) {
 
   fastify.get('/', {
     schema: {
-      description: 'Activities do usuário, mais recente primeiro. Próxima página: before = next_before da anterior',
+      description: 'Activities do usuário, mais recente primeiro. Período: from (inclusivo) e before (exclusivo). Próxima página: before = next_before da anterior',
       tags: ['Activities'],
       security: [{ bearerAuth: [] }],
       querystring: Type.Object({
         type: Type.Optional(Type.Union(ACTIVITY_TYPES.map((t) => Type.Literal(t)))),
+        from: Type.Optional(Type.String({ format: 'date-time' })),
         before: Type.Optional(Type.String({ format: 'date-time' })),
         limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
       }),
```

Run: `cd BackEndTorv && npm test`
Expected: todos passam.

Commit:
```bash
git commit -m "feat(activities): from filter (inclusive) alongside before" -- BackEndTorv/src/routes/activities.routes.js BackEndTorv/src/controller/activities.controller.js BackEndTorv/src/repository/activities.repository.js BackEndTorv/src/routes/activities.routes.test.js
```

- [ ] **Passo 3.5: PATCH no CORS**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/be_cors.diff`

```diff
diff --git a/BackEndTorv/server.js b/BackEndTorv/server.js
index a631528..b0d8279 100644
--- a/BackEndTorv/server.js
+++ b/BackEndTorv/server.js
@@ -13,7 +13,7 @@ fastify.addHook('onResponse', (request, reply, done) => {
 });
 
 fastify.register(require('@fastify/cors'), {
-  methods: ['GET', 'POST', 'PUT', 'DELETE'],
+  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
 });
 fastify.register(require('@fastify/multipart'));
 fastify.register(require('@fastify/static'), {
```

Commit:
```bash
git commit -m "fix(server): allow PATCH in CORS" -- BackEndTorv/server.js
```

- [ ] **Passo 3.6: conferência final da etapa**

Run: `cd BackEndTorv && npm test`
Expected: `ℹ pass 92`, `ℹ fail 0`.

Avise o Maestro para reiniciar o backend no Furnace, caso o nodemon não tenha recarregado.

### Task 4: Teste da etapa Backend (Torv Review and Tests)

- [ ] Relatório `docs/qa-loads-welcome-backend-2026-10-02.md`.
  - Rodar `npm test`.
  - **Contrato ao vivo, com duas contas novas `qa.lw.*@torvtest.dev`:**
    1. **Sessões:**
       - POST de sessão com `weight_kg` 62.5, 0, null e sem o campo;
       - o GET da sessão devolve 62.5, 0, null, null;
       - `weight_kg` -1 e 1000 → 400.
    2. **PATCH das cargas:**
       - PATCH na rotina própria muda as cargas, conferido via `GET /workouts/routines/:id`;
       - item com posição ou exercício trocado não muda nada (`updated` conta só o que bateu);
       - PATCH na rotina da outra conta → 404, e a rotina dela continua igual;
       - corpo inválido → 400.
    3. **Período:** `GET /activities` com `from` e `before` (incluindo `from` > `before` → lista vazia) e `from` inválido → 400.
    4. **Boas-vindas:** conta nova com `welcome_pending: true` → `POST /profile/welcome` 204 → `false`. Um segundo POST → 204, sem mudar nada.
    5. **CORS:** `OPTIONS /workouts/routines/<id>/weights` com `Origin: http://localhost:8081` e `Access-Control-Request-Method: PATCH` → `access-control-allow-methods` contém `PATCH`.
- [ ] Commit só do relatório.

### Task 5: Frontend (Torv Frontend, com `/frontend-design` no passo 5.9)

**Interfaces:**
- **Consumes:** o contrato da Task 3.
- **Produces:** as telas da spec, mais os utilitários `setWeight`, `stepWeight`, `formatWeight`, `weightChanges`, `upgradeState` e `periodRange`, `periodKey`, `customLabel`, `PERIOD_PRESETS`.

- [ ] **Passo 5.1: API no celular**

Run, na ordem:
1. `git checkout -- FrontEndTorv/src/services/api.ts`. O Maestro já guardou o diff local do usuário, e esta correção o substitui.
2. `cd FrontEndTorv && npx expo install expo-constants`. Expected: `package.json` com `"expo-constants": "~57.0.19"` e o `package-lock.json` atualizado.
3. `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_api.diff`

```diff
diff --git a/FrontEndTorv/src/services/api.ts b/FrontEndTorv/src/services/api.ts
index a93de90..a163999 100644
--- a/FrontEndTorv/src/services/api.ts
+++ b/FrontEndTorv/src/services/api.ts
@@ -1,9 +1,12 @@
 import axios, { InternalAxiosRequestConfig } from 'axios';
+import Constants from 'expo-constants';
 import { getSession, setSession, clearSession, Session } from './session';
 
-// Web/iOS simulator: default localhost. Android emulator: http://10.0.2.2:3000.
-// Physical phone (Expo Go): set EXPO_PUBLIC_API_URL=http://<LAN IP>:3000 in FrontEndTorv/.env.
-const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
+// Dev: o backend roda na mesma máquina do Metro. O hostUri do Expo ("192.168.x.x:8081") dá o IP dela
+// na rede local, que o celular no Expo Go alcança; sem hostUri fica 127.0.0.1 (web e simulador no PC).
+// EXPO_PUBLIC_API_URL sobrepõe (túnel, outra rede, produção); vazio conta como ausente.
+const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
+const baseURL = process.env.EXPO_PUBLIC_API_URL || `http://${devHost || '127.0.0.1'}:3000`;
 
 // /auth/* goes through here: no interceptors, so a failing refresh can't loop.
 export const authApi = axios.create({ baseURL });
```

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros.

Commit:
```bash
git commit -m "fix(api): reach the backend from Expo Go via the dev server hostUri" -- FrontEndTorv/src/services/api.ts FrontEndTorv/package.json FrontEndTorv/package-lock.json
```

- [ ] **Passo 5.2: senha com bolinhas**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_input.diff`

```diff
diff --git a/FrontEndTorv/src/components/Input/index.tsx b/FrontEndTorv/src/components/Input/index.tsx
index c0b994f..7353970 100644
--- a/FrontEndTorv/src/components/Input/index.tsx
+++ b/FrontEndTorv/src/components/Input/index.tsx
@@ -12,6 +12,8 @@ interface InputProps extends TextInputProps {
 export const Input: React.FC<InputProps> = ({ label, error, style, ...rest }) => {
   const [isFocused, setIsFocused] = useState(false);
   const [visible, setVisible] = useState(false);
+  // Senha oculta com texto: fonte do sistema, que desenha bolinhas. Na Sora o "•" da máscara é um quadrado.
+  const masked = !!rest.secureTextEntry && !visible && !!rest.value;
 
   return (
     <View style={styles.container}>
@@ -24,6 +26,7 @@ export const Input: React.FC<InputProps> = ({ label, error, style, ...rest }) =>
             error ? { borderColor: colors.error } : null,
             rest.secureTextEntry ? styles.inputWithToggle : null,
             style,
+            masked && styles.inputMasked,
           ]}
           placeholderTextColor={colors.textSecondary}
           onFocus={(e) => {
diff --git a/FrontEndTorv/src/components/Input/styles.ts b/FrontEndTorv/src/components/Input/styles.ts
index 8134dd0..bbb14cb 100644
--- a/FrontEndTorv/src/components/Input/styles.ts
+++ b/FrontEndTorv/src/components/Input/styles.ts
@@ -1,4 +1,4 @@
-import { StyleSheet } from 'react-native';
+import { Platform, StyleSheet } from 'react-native';
 import { colors, radius, fontFamily } from '../../theme/tokens';
 
 export const styles = StyleSheet.create({
@@ -26,6 +26,11 @@ export const styles = StyleSheet.create({
   inputWithToggle: {
     paddingRight: 48,
   },
+  // Nome explícito: no web o react-native-web traduz 'System' para a pilha de fontes do sistema
+  // (undefined seria ignorado e a Sora continuaria).
+  inputMasked: {
+    fontFamily: Platform.select({ android: 'sans-serif', default: 'System' }),
+  },
   toggle: {
     position: 'absolute',
     right: 0,
```

Commit:
```bash
git commit -m "fix(input): system font while the password is masked (Sora draws the mask bullet as a square)" -- FrontEndTorv/src/components/Input/index.tsx FrontEndTorv/src/components/Input/styles.ts
```

- [ ] **Passo 5.3: boas-vindas**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_welcome.diff`

```diff
diff --git a/FrontEndTorv/src/components/WelcomeModal/index.tsx b/FrontEndTorv/src/components/WelcomeModal/index.tsx
new file mode 100644
index 0000000..4ade278
--- /dev/null
+++ b/FrontEndTorv/src/components/WelcomeModal/index.tsx
@@ -0,0 +1,50 @@
+import React from 'react';
+import { Modal, View, Text } from 'react-native';
+import { Dumbbell, Stethoscope, Pencil } from 'lucide-react-native';
+import { Button } from '../Button';
+import { colors } from '../../theme/tokens';
+import { styles } from './styles';
+
+// Mostrada uma vez por conta, no 1º acesso (GET /profile → welcome_pending).
+interface Props {
+  visible: boolean;
+  name?: string;
+  onClose: () => void;
+}
+
+const POINTS = [
+  {
+    Icon: Dumbbell,
+    text: 'Com os dados do seu cadastro, montamos um plano de treinos e metas de calorias e macronutrientes iniciais. Eles são genéricos.',
+  },
+  {
+    Icon: Stethoscope,
+    text: 'O ideal é ter o acompanhamento de um profissional (educador físico e nutricionista). Em breve isso estará aqui no app.',
+  },
+  {
+    Icon: Pencil,
+    text: 'Fique à vontade para editar seus treinos e suas metas quando quiser.',
+  },
+];
+
+export const WelcomeModal: React.FC<Props> = ({ visible, name, onClose }) => {
+  const firstName = name?.trim().split(/\s+/)[0];
+  return (
+    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
+      <View style={styles.overlay}>
+        <View style={styles.content} accessibilityRole="alert">
+          <Text style={styles.title}>{firstName ? `Bem-vindo(a) ao Torv, ${firstName}!` : 'Bem-vindo(a) ao Torv!'}</Text>
+          {POINTS.map(({ Icon, text }) => (
+            <View key={text} style={styles.point}>
+              <View style={styles.pointIcon}>
+                <Icon color={colors.brand} size={18} />
+              </View>
+              <Text style={styles.pointText}>{text}</Text>
+            </View>
+          ))}
+          <Button title="Começar" onPress={onClose} />
+        </View>
+      </View>
+    </Modal>
+  );
+};
diff --git a/FrontEndTorv/src/components/WelcomeModal/styles.ts b/FrontEndTorv/src/components/WelcomeModal/styles.ts
new file mode 100644
index 0000000..f1b9e9f
--- /dev/null
+++ b/FrontEndTorv/src/components/WelcomeModal/styles.ts
@@ -0,0 +1,11 @@
+import { StyleSheet } from 'react-native';
+import { colors, radius, fontFamily } from '../../theme/tokens';
+
+export const styles = StyleSheet.create({
+  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.7)' },
+  content: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, gap: 16, width: '100%', maxWidth: 420, alignSelf: 'center' },
+  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22, lineHeight: 28 },
+  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
+  pointIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
+  pointText: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
+});
diff --git a/FrontEndTorv/src/contexts/AuthContext.tsx b/FrontEndTorv/src/contexts/AuthContext.tsx
index 78a9552..8dba653 100644
--- a/FrontEndTorv/src/contexts/AuthContext.tsx
+++ b/FrontEndTorv/src/contexts/AuthContext.tsx
@@ -11,6 +11,7 @@ interface Profile {
   goal?: string;
   photo_url?: string;
   goalCalories?: number;
+  welcome_pending?: boolean; // true até a pessoa fechar a mensagem de boas-vindas
 }
 
 export interface RegisterPayload {
@@ -34,6 +35,7 @@ interface AuthContextData {
   // Resolves to true when the account needs e-mail confirmation before login.
   register: (payload: RegisterPayload) => Promise<boolean>;
   logout: () => Promise<void>;
+  dismissWelcome: () => void;
 }
 
 export const AuthContext = createContext<AuthContextData>({} as AuthContextData);
@@ -105,8 +107,14 @@ export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) =>
     setUser(null);
   };
 
+  // Fecha na hora; o POST é melhor-esforço: se falhar, a mensagem volta no próximo login.
+  const dismissWelcome = () => {
+    setUser((current) => (current ? { ...current, welcome_pending: false } : current));
+    api.post('/profile/welcome', {}).catch(() => {});
+  };
+
   return (
-    <AuthContext.Provider value={{ signed, user, loading, login, register, logout }}>
+    <AuthContext.Provider value={{ signed, user, loading, login, register, logout, dismissWelcome }}>
       {children}
     </AuthContext.Provider>
   );
diff --git a/FrontEndTorv/src/screens/Home/index.tsx b/FrontEndTorv/src/screens/Home/index.tsx
index 4a82545..60174c3 100644
--- a/FrontEndTorv/src/screens/Home/index.tsx
+++ b/FrontEndTorv/src/screens/Home/index.tsx
@@ -8,6 +8,7 @@ import { useNavigation, useFocusEffect } from '@react-navigation/native';
 import { ProgressBar } from '../../components/ProgressBar';
 import { Card } from '../../components/Card';
 import { ConfirmModal } from '../../components/ConfirmModal';
+import { WelcomeModal } from '../../components/WelcomeModal';
 import { AuthContext } from '../../contexts/AuthContext';
 import api from '../../services/api';
 import { workoutsApi, type RoutineSummary } from '../../services/workouts';
@@ -18,7 +19,7 @@ import { styles } from './styles';
 
 export default function Home() {
   const navigation = useNavigation<AppNavigation>();
-  const { user } = useContext(AuthContext);
+  const { user, dismissWelcome } = useContext(AuthContext);
   const [loading, setLoading] = useState(true);
   const [loadError, setLoadError] = useState(false);
   const [consumed, setConsumed] = useState(0);
@@ -300,6 +301,7 @@ export default function Home() {
         onConfirm={startNext}
         onCancel={() => setConfirmRepeat(false)}
       />
+      <WelcomeModal visible={!!user?.welcome_pending} name={user?.name} onClose={dismissWelcome} />
     </SafeAreaView>
   );
 }
```

Run: `cd FrontEndTorv && npx tsc --noEmit`. Expected: sem erros.

Commit:
```bash
git add FrontEndTorv/src/components/WelcomeModal
git commit -m "feat(home): one-time welcome message" -- FrontEndTorv/src/contexts/AuthContext.tsx FrontEndTorv/src/components/WelcomeModal FrontEndTorv/src/screens/Home/index.tsx
```

- [ ] **Passo 5.4: carga no estado da sessão (vermelho → verde)**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_s_tests.diff`

```diff
diff --git a/FrontEndTorv/src/utils/workoutSession.test.mjs b/FrontEndTorv/src/utils/workoutSession.test.mjs
index 46a4298..cb21dbf 100644
--- a/FrontEndTorv/src/utils/workoutSession.test.mjs
+++ b/FrontEndTorv/src/utils/workoutSession.test.mjs
@@ -5,6 +5,7 @@ import {
   createSession, startSet, finishSet, skipSet, skipExercise, finish,
   totalElapsedSec, phaseElapsedSec, isRestOverdue, toSessionPayload,
   summaryFromState, summaryFromDetail,
+  setWeight, stepWeight, formatWeight, weightChanges, upgradeState,
 } from './workoutSession.ts';
 
 const T0 = Date.parse('2026-09-30T10:00:00Z');
@@ -24,6 +25,7 @@ test('createSession copia a rotina e começa em ready', () => {
   const s = createSession(routine, T0);
   assert.equal(s.phase, 'ready');
   assert.deepEqual(s.exercises[0].weights, [40, null]);
+  assert.deepEqual(s.exercises[0].planned_weights, [40, null]);
   assert.equal(s.started_at, T0);
   assert.deepEqual([s.exercise_index, s.set_index], [0, 0]);
 });
@@ -38,7 +40,7 @@ test('fluxo completo: série → descanso → série, com tempos e alvo do desca
   assert.equal(s.phase, 'resting');
   assert.equal(s.rest_target_sec, 120);
   assert.deepEqual([s.exercise_index, s.set_index], [0, 1]);
-  assert.deepEqual(s.sets[0], { exercise_id: 'e1', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null, rest_target_sec: null });
+  assert.deepEqual(s.sets[0], { exercise_id: 'e1', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null, rest_target_sec: null, weight_kg: 40 });
 
   assert.equal(isRestOverdue(s, at(165)), false); // 120s exatos: ainda não estourou
   assert.equal(isRestOverdue(s, at(166)), true);
@@ -48,7 +50,7 @@ test('fluxo completo: série → descanso → série, com tempos e alvo do desca
   assert.equal(s.pending_rest_sec, 180);
   assert.equal(isRestOverdue(s, at(300)), false); // em série: nunca vermelho
   s = finishSet(s, at(260));
-  assert.deepEqual(s.sets[1], { exercise_id: 'e1', position: 1, set_number: 2, duration_sec: 35, rest_before_sec: 180, rest_target_sec: 120 });
+  assert.deepEqual(s.sets[1], { exercise_id: 'e1', position: 1, set_number: 2, duration_sec: 35, rest_before_sec: 180, rest_target_sec: 120, weight_kg: null });
 
   // Último exercício de um: descanso conta contra o rest_sec do Supino (acabou de terminar).
   assert.equal(s.rest_target_sec, 120);
@@ -132,3 +134,99 @@ test('resumo: agrupa por exercício, média de descanso e vermelho só no ao viv
   assert.equal(history.groups[0].sets[1].overdue, false);
   assert.equal(history.avg_rest_sec, 500);
 });
+
+test('setWeight muda só a série atual (em ready, set e resting) e grava no finishSet', () => {
+  let s = setWeight(createSession(routine, T0), 42.5); // Supino série 1 (rotina: 40)
+  assert.deepEqual(s.exercises[0].weights, [42.5, null]);
+  assert.deepEqual(s.exercises[0].planned_weights, [40, null]); // a base do "diferente" não muda
+  s = startSet(s, at(0));
+  s = setWeight(s, 45); // durante a série
+  s = finishSet(s, at(40));
+  assert.equal(s.sets[0].weight_kg, 45);
+  // No descanso, o controle mostra a próxima série (Supino 2): muda ela, não a que acabou.
+  s = setWeight(s, 20);
+  assert.deepEqual(s.exercises[0].weights, [45, 20]);
+  assert.equal(s.sets[0].weight_kg, 45);
+  s = finishSet(startSet(s, at(100)), at(130));
+  assert.equal(s.sets[1].weight_kg, 20);
+  assert.deepEqual(s.exercises[1].weights, [null]); // Remada intacta
+});
+
+test('setWeight: limita a 0–999,99 com 2 casas; NaN, mesmo valor e treino encerrado não mudam o estado', () => {
+  const s = createSession(routine, T0);
+  assert.equal(setWeight(s, 1500).exercises[0].weights[0], 999.99);
+  assert.equal(setWeight(s, -5).exercises[0].weights[0], 0);
+  assert.equal(setWeight(s, 7.255).exercises[0].weights[0], 7.26);
+  assert.equal(setWeight(s, null).exercises[0].weights[0], null);
+  assert.equal(setWeight(s, Number.NaN), s);
+  assert.equal(setWeight(s, 40), s);
+  const done = finish(s, at(1));
+  assert.equal(setWeight(done, 50), done);
+});
+
+test('stepWeight: passo de 2,5; abaixo de 2,5 vira sem carga; sem carga + 1 passo = 2,5; teto 999,99', () => {
+  assert.equal(stepWeight(null, 1), 2.5);
+  assert.equal(stepWeight(null, -1), null);
+  assert.equal(stepWeight(2.5, -1), null);
+  assert.equal(stepWeight(1, -1), null);
+  assert.equal(stepWeight(7.5, 1), 10);
+  assert.equal(stepWeight(0.1 + 0.2, 1), 2.8); // sem lixo de ponto flutuante
+  assert.equal(stepWeight(999, 1), 999.99);
+});
+
+test('formatWeight: vírgula decimal; null = Sem carga', () => {
+  assert.equal(formatWeight(7.5), '7,5 kg');
+  assert.equal(formatWeight(60), '60 kg');
+  assert.equal(formatWeight(0), '0 kg');
+  assert.equal(formatWeight(null), 'Sem carga');
+});
+
+test('weightChanges: só séries feitas com carga diferente do início; pulada não conta; treino livre → nada', () => {
+  let s = createSession(routine, T0);
+  s = finishSet(startSet(setWeight(s, 45), at(0)), at(30)); // Supino 1: 40 → 45
+  s = finishSet(startSet(s, at(60)), at(90)); // Supino 2: null → null (igual)
+  s = skipSet(setWeight(s, 30), at(100)); // Remada 1: mudou mas foi pulada
+  assert.equal(s.phase, 'done');
+  assert.deepEqual(weightChanges(s), [{ position: 1, exercise_id: 'e1', set_number: 1, name: 'Supino', from: 40, to: 45 }]);
+  assert.deepEqual(weightChanges({ ...s, routine_id: '' }), []);
+
+  let none = createSession(routine, T0);
+  none = finishSet(startSet(none, at(0)), at(30));
+  assert.deepEqual(weightChanges(none), []);
+});
+
+test('toSessionPayload manda weight_kg de cada série', () => {
+  let s = createSession(routine, T0);
+  s = finishSet(startSet(setWeight(s, 42.5), at(0)), at(30));
+  s = finish(finishSet(startSet(s, at(60)), at(90)), at(100));
+  assert.deepEqual(toSessionPayload(s).sets.map((x) => x.weight_kg), [42.5, null]);
+});
+
+test('upgradeState: rascunho antigo ganha planned_weights = weights e weight_kg null; atual passa intacto', () => {
+  let current = createSession(routine, T0);
+  current = finishSet(startSet(current, at(0)), at(30));
+  const old = {
+    ...current,
+    exercises: current.exercises.map(({ planned_weights, ...e }) => e),
+    sets: current.sets.map(({ weight_kg, ...set }) => set),
+  };
+  const up = upgradeState(old);
+  assert.deepEqual(up.exercises[0].planned_weights, [40, null]);
+  assert.equal(up.sets[0].weight_kg, null);
+  assert.deepEqual(weightChanges(up), [{ position: 1, exercise_id: 'e1', set_number: 1, name: 'Supino', from: 40, to: null }]);
+  assert.deepEqual(upgradeState(current), current);
+});
+
+test('resumo leva a carga de cada série (ao vivo e do histórico, com null no treino antigo)', () => {
+  let s = createSession(routine, T0);
+  s = finishSet(startSet(s, at(0)), at(30));
+  assert.equal(summaryFromState(s).groups[0].sets[0].weight_kg, 40);
+  const history = summaryFromDetail({
+    id: 'a1', title: 'Peito', start_time: '2026-09-30T10:00:00.000Z', duration_sec: 60,
+    sets: [
+      { exercise_name: 'Supino', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null, weight_kg: 62.5 },
+      { exercise_name: 'Supino', position: 1, set_number: 2, duration_sec: 40, rest_before_sec: 60 },
+    ],
+  });
+  assert.deepEqual(history.groups[0].sets.map((x) => x.weight_kg), [62.5, null]);
+});
```

Run: `cd FrontEndTorv && node --test src/utils/workoutSession.test.mjs`
Expected: FAIL. `setWeight`, `stepWeight`, `formatWeight`, `weightChanges` e `upgradeState` não existem, e `planned_weights`/`weight_kg` ainda faltam.

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_s_impl.diff`

```diff
diff --git a/FrontEndTorv/src/services/workouts.ts b/FrontEndTorv/src/services/workouts.ts
index 976ca1f..346502e 100644
--- a/FrontEndTorv/src/services/workouts.ts
+++ b/FrontEndTorv/src/services/workouts.ts
@@ -79,6 +79,7 @@ export interface SessionPayload {
     set_number: number;
     duration_sec: number;
     rest_before_sec: number | null;
+    weight_kg: number | null;
   }[];
 }
 
@@ -93,15 +94,26 @@ export interface SessionDetail {
     set_number: number;
     duration_sec: number;
     rest_before_sec: number | null;
+    weight_kg: number | null;
   }[];
 }
 
+// PATCH /workouts/routines/:id/weights: série que não bate com a rotina atual (posição + exercício + nº) é ignorada.
+export interface RoutineWeightUpdate {
+  position: number;
+  exercise_id: string;
+  set_number: number;
+  weight_kg: number | null;
+}
+
 export const workoutsApi = {
   listRoutines: () => api.get<RoutineList>('/workouts/routines').then((r) => r.data),
   getRoutine: (id: string) => api.get<RoutineDetail>(`/workouts/routines/${id}`).then((r) => r.data),
   createRoutine: (body: RoutineInput) => api.post<RoutineDetail>('/workouts/routines', body).then((r) => r.data),
   updateRoutine: (id: string, body: RoutineInput) => api.put<RoutineDetail>(`/workouts/routines/${id}`, body).then((r) => r.data),
   deleteRoutine: (id: string) => api.delete(`/workouts/routines/${id}`),
+  updateRoutineWeights: (id: string, sets: RoutineWeightUpdate[]) =>
+    api.patch<{ updated: number }>(`/workouts/routines/${id}/weights`, { sets }).then((r) => r.data.updated),
   acceptPlan: () => api.post<RoutineList>('/workouts/plan/accept', {}).then((r) => r.data),
   dismissPlan: () => api.post('/workouts/plan/dismiss', {}),
   listExercises: () => api.get<{ exercises: Exercise[] }>('/workouts/exercises').then((r) => r.data.exercises),
diff --git a/FrontEndTorv/src/utils/workoutDraft.ts b/FrontEndTorv/src/utils/workoutDraft.ts
index d738188..39b62a4 100644
--- a/FrontEndTorv/src/utils/workoutDraft.ts
+++ b/FrontEndTorv/src/utils/workoutDraft.ts
@@ -1,5 +1,5 @@
 import AsyncStorage from '@react-native-async-storage/async-storage';
-import type { SessionState } from './workoutSession';
+import { upgradeState, type SessionState } from './workoutSession';
 
 // Treino em andamento salvo no aparelho, por usuário. Sai após o servidor confirmar o
 // POST /workouts/sessions, ao descartar e no logout (AuthContext).
@@ -9,7 +9,7 @@ export async function loadDraft(userId: string): Promise<SessionState | null> {
   const raw = await AsyncStorage.getItem(key(userId));
   if (!raw) return null;
   try {
-    return JSON.parse(raw) as SessionState;
+    return upgradeState(JSON.parse(raw) as SessionState);
   } catch {
     await AsyncStorage.removeItem(key(userId));
     return null;
diff --git a/FrontEndTorv/src/utils/workoutSession.ts b/FrontEndTorv/src/utils/workoutSession.ts
index 8d18e54..1458873 100644
--- a/FrontEndTorv/src/utils/workoutSession.ts
+++ b/FrontEndTorv/src/utils/workoutSession.ts
@@ -13,7 +13,8 @@ export interface SessionExercise {
   reps_min: number;
   reps_max: number;
   rest_sec: number;
-  weights: (number | null)[]; // carga de cada série; length = nº de séries
+  weights: (number | null)[]; // carga atual de cada série (muda no treino com setWeight); length = nº de séries
+  planned_weights: (number | null)[]; // carga da rotina no início do treino: base de weightChanges
 }
 
 export interface DoneSet {
@@ -23,6 +24,7 @@ export interface DoneSet {
   duration_sec: number;
   rest_before_sec: number | null; // null na 1ª série do treino
   rest_target_sec: number | null; // alvo desse descanso; só pro resumo (não vai pro servidor)
+  weight_kg: number | null; // carga com que a série foi feita; null = sem carga
 }
 
 export interface SessionState {
@@ -44,6 +46,8 @@ export interface SessionState {
 export const MAX_TOTAL_SEC = 21600;
 export const MAX_SET_SEC = 3600;
 export const MAX_REST_SEC = 7200;
+export const MAX_WEIGHT = 999.99;
+export const WEIGHT_STEP = 2.5;
 
 const secondsBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / 1000));
 const canSkip = (s: SessionState) => s.phase === 'ready' || s.phase === 'resting';
@@ -60,6 +64,7 @@ export function createSession(routine: RoutineDetail, now: number): SessionState
       reps_max: e.reps_max,
       rest_sec: e.rest_sec,
       weights: e.sets.map((s) => s.weight_kg),
+      planned_weights: e.sets.map((s) => s.weight_kg),
     })),
     started_at: now,
     finished_at: null,
@@ -105,6 +110,7 @@ export function finishSet(s: SessionState, now: number): SessionState {
     duration_sec: secondsBetween(s.phase_started_at, now),
     rest_before_sec: s.pending_rest_sec,
     rest_target_sec: s.pending_rest_sec === null ? null : s.rest_target_sec,
+    weight_kg: ex.weights[s.set_index] ?? null,
   }];
   const next = after(s, s.exercise_index, s.set_index);
   if (!next) return done({ ...s, sets }, now);
@@ -125,6 +131,27 @@ export function skipExercise(s: SessionState, now: number): SessionState {
   return e < s.exercises.length ? { ...s, exercise_index: e, set_index: 0 } : done(s, now);
 }
 
+// Carga da série atual (a em andamento ou, no descanso, a próxima). Só ela muda: as seguintes continuam
+// com a carga da rotina. Limita a 0–999,99 com 2 casas; NaN (texto inválido) não muda nada.
+export function setWeight(s: SessionState, kg: number | null): SessionState {
+  if (s.phase === 'done' || Number.isNaN(kg)) return s;
+  const value = kg === null ? null : Math.round(Math.min(MAX_WEIGHT, Math.max(0, kg)) * 100) / 100;
+  const ex = s.exercises[s.exercise_index];
+  if (ex.weights[s.set_index] === value) return s;
+  const weights = ex.weights.map((w, i) => (i === s.set_index ? value : w));
+  return { ...s, exercises: s.exercises.map((e, i) => (i === s.exercise_index ? { ...e, weights } : e)) };
+}
+
+// Botões −/+ (passo de 2,5 kg): de 2,5 o "−" vai para sem carga (null); de sem carga o "+" vai para 2,5.
+export function stepWeight(kg: number | null, dir: 1 | -1): number | null {
+  if (kg === null) return dir > 0 ? WEIGHT_STEP : null;
+  const next = Math.round((kg + dir * WEIGHT_STEP) * 100) / 100;
+  return next <= 0 ? null : Math.min(MAX_WEIGHT, next);
+}
+
+// "7,5 kg"; null = "Sem carga".
+export const formatWeight = (kg: number | null) => (kg === null ? 'Sem carga' : `${String(kg).replace('.', ',')} kg`);
+
 // "Finalizar treino": série em andamento conta como feita.
 export function finish(s: SessionState, now: number): SessionState {
   if (s.phase === 'done') return s;
@@ -148,10 +175,38 @@ export function toSessionPayload(s: SessionState): SessionPayload {
       set_number: set.set_number,
       duration_sec: Math.min(set.duration_sec, MAX_SET_SEC),
       rest_before_sec: set.rest_before_sec === null ? null : Math.min(set.rest_before_sec, MAX_REST_SEC),
+      weight_kg: set.weight_kg,
     })),
   };
 }
 
+// Rascunho gravado antes da carga por série: sem planned_weights (vira a carga atual) e séries sem weight_kg.
+export const upgradeState = (s: SessionState): SessionState => ({
+  ...s,
+  exercises: s.exercises.map((e) => ({ ...e, planned_weights: e.planned_weights ?? e.weights })),
+  sets: s.sets.map((set) => ({ ...set, weight_kg: set.weight_kg ?? null })),
+});
+
+export interface WeightChange {
+  position: number;
+  exercise_id: string;
+  set_number: number;
+  name: string;
+  from: number | null; // carga da rotina no início do treino
+  to: number | null; // carga feita
+}
+
+// Séries feitas com carga diferente da que a rotina tinha no início do treino (pulada não conta).
+export function weightChanges(s: SessionState): WeightChange[] {
+  if (!s.routine_id) return [];
+  return s.sets.flatMap((set) => {
+    const ex = s.exercises[set.position - 1];
+    const from = ex.planned_weights[set.set_number - 1] ?? null;
+    if (set.weight_kg === from) return [];
+    return [{ position: set.position, exercise_id: set.exercise_id, set_number: set.set_number, name: ex.name, from, to: set.weight_kg }];
+  });
+}
+
 // Modelo único do resumo: treino recém-finalizado (rascunho) ou do histórico (servidor).
 export interface SummaryView {
   title: string;
@@ -160,14 +215,14 @@ export interface SummaryView {
   avg_rest_sec: number | null;
   groups: {
     name: string;
-    sets: { set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean }[];
+    sets: { set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean; weight_kg: number | null }[];
   }[];
 }
 
 function buildSummary(
   title: string,
   total_sec: number,
-  sets: { position: number; name: string; set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean }[],
+  sets: { position: number; name: string; set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean; weight_kg: number | null }[],
 ): SummaryView {
   const rests = sets.map((s) => s.rest_before_sec).filter((r): r is number => r !== null);
   const groups: SummaryView['groups'] = [];
@@ -194,6 +249,7 @@ export const summaryFromState = (s: SessionState) =>
     duration_sec: set.duration_sec,
     rest_before_sec: set.rest_before_sec,
     overdue: set.rest_before_sec !== null && set.rest_target_sec !== null && set.rest_before_sec > set.rest_target_sec,
+    weight_kg: set.weight_kg,
   })));
 
 // Histórico não guarda o alvo do descanso: nada fica em vermelho.
@@ -205,4 +261,5 @@ export const summaryFromDetail = (d: SessionDetail) =>
     duration_sec: set.duration_sec,
     rest_before_sec: set.rest_before_sec,
     overdue: false,
+    weight_kg: set.weight_kg ?? null, // treino anterior à carga por série: null
   })));
```

Run: `cd FrontEndTorv && node --test src/utils/workoutSession.test.mjs && npx tsc --noEmit`
Expected: 15 passam, e o `tsc` sem erros.

Commit:
```bash
git commit -m "feat(workouts): weight per set in the session state, routine weight changes and payload" -- FrontEndTorv/src/utils/workoutSession.ts FrontEndTorv/src/utils/workoutSession.test.mjs FrontEndTorv/src/utils/workoutDraft.ts FrontEndTorv/src/services/workouts.ts
```

- [ ] **Passo 5.5: controle de carga na tela de treino**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_session.diff`

```diff
diff --git a/FrontEndTorv/src/screens/WorkoutSession/index.tsx b/FrontEndTorv/src/screens/WorkoutSession/index.tsx
index 8fc6552..6973e87 100644
--- a/FrontEndTorv/src/screens/WorkoutSession/index.tsx
+++ b/FrontEndTorv/src/screens/WorkoutSession/index.tsx
@@ -1,17 +1,18 @@
 import React, { useContext, useEffect, useState } from 'react';
-import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
+import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
-import { X, SkipForward, ChevronsRight } from 'lucide-react-native';
+import { X, SkipForward, ChevronsRight, Minus, Plus } from 'lucide-react-native';
 
 import { Button } from '../../components/Button';
 import { ConfirmModal } from '../../components/ConfirmModal';
 import { AuthContext } from '../../contexts/AuthContext';
 import { workoutsApi } from '../../services/workouts';
 import {
-  createSession, startSet, finishSet, skipSet, skipExercise, finish,
-  totalElapsedSec, phaseElapsedSec, isRestOverdue, type SessionState,
+  createSession, startSet, finishSet, skipSet, skipExercise, finish, setWeight, stepWeight, formatWeight,
+  totalElapsedSec, phaseElapsedSec, isRestOverdue, MAX_WEIGHT, type SessionState,
 } from '../../utils/workoutSession';
+import { parseWeight } from '../../utils/routineForm';
 import { formatClock } from '../../utils/clock';
 import { loadDraft, saveDraft, clearDraft } from '../../utils/workoutDraft';
 import type { AppNavigation, AppStackParamList } from '../../routes/types';
@@ -29,6 +30,7 @@ export default function WorkoutSession() {
   const [now, setNow] = useState(Date.now());
   const [error, setError] = useState('');
   const [confirmFinish, setConfirmFinish] = useState(false);
+  const [weightText, setWeightText] = useState<string | null>(null); // digitando a carga; null = mostrando o valor
 
   // Carrega o rascunho (Continuar) ou começa a rotina do zero, sobrescrevendo qualquer rascunho.
   useEffect(() => {
@@ -76,6 +78,14 @@ export default function WorkoutSession() {
     if (next.phase === 'done') navigation.replace('WorkoutSummary', {});
   };
 
+  // Cada texto válido já vale (o rascunho grava): sair do campo, ou tocar em "Terminei a série" com ele
+  // aberto, não perde nada. Texto inválido ("7,", "abc") só não muda a carga.
+  const typeWeight = (text: string) => {
+    setWeightText(text);
+    const kg = parseWeight(text);
+    if (!Number.isNaN(kg)) apply((s) => setWeight(s, kg));
+  };
+
   const discard = async () => {
     if (userId) await clearDraft(userId);
     setConfirmFinish(false);
@@ -142,9 +152,53 @@ export default function WorkoutSession() {
           <Text style={styles.exerciseGroup}>{exercise.muscle_group}</Text>
           <Text style={styles.exerciseName}>{exercise.name}</Text>
           <Text style={styles.setInfo}>Série {state.set_index + 1} de {exercise.weights.length}</Text>
-          <View style={styles.targets}>
-            <Text style={styles.target}>{exercise.reps_min}–{exercise.reps_max} reps</Text>
-            <Text style={styles.target}>{weight === null ? 'Sem carga' : `${weight} kg`}</Text>
+          <Text style={styles.target}>{exercise.reps_min}–{exercise.reps_max} reps</Text>
+
+          <View style={styles.weightRow}>
+            <TouchableOpacity
+              style={[styles.weightStep, weight === null && styles.weightStepDisabled]}
+              onPress={() => apply((s) => setWeight(s, stepWeight(weight, -1)))}
+              disabled={weight === null}
+              accessibilityRole="button"
+              accessibilityLabel="Diminuir carga em 2,5 kg"
+            >
+              <Minus color={colors.text} size={20} />
+            </TouchableOpacity>
+            {weightText === null ? (
+              <TouchableOpacity
+                style={styles.weightValue}
+                onPress={() => setWeightText(weight === null ? '' : String(weight).replace('.', ','))}
+                accessibilityRole="button"
+                accessibilityLabel={`Carga desta série: ${formatWeight(weight)}. Toque para digitar`}
+              >
+                <Text style={styles.weightText}>{formatWeight(weight)}</Text>
+              </TouchableOpacity>
+            ) : (
+              <TextInput
+                style={[styles.weightValue, styles.weightInput]}
+                value={weightText}
+                onChangeText={typeWeight}
+                onBlur={() => setWeightText(null)}
+                onSubmitEditing={() => setWeightText(null)}
+                keyboardType="decimal-pad"
+                returnKeyType="done"
+                autoFocus
+                selectTextOnFocus
+                maxLength={6}
+                placeholder="Sem carga"
+                placeholderTextColor={colors.textSecondary}
+                accessibilityLabel="Carga desta série em kg"
+              />
+            )}
+            <TouchableOpacity
+              style={[styles.weightStep, weight === MAX_WEIGHT && styles.weightStepDisabled]}
+              onPress={() => apply((s) => setWeight(s, stepWeight(weight, 1)))}
+              disabled={weight === MAX_WEIGHT}
+              accessibilityRole="button"
+              accessibilityLabel="Aumentar carga em 2,5 kg"
+            >
+              <Plus color={colors.text} size={20} />
+            </TouchableOpacity>
           </View>
         </View>
 
diff --git a/FrontEndTorv/src/screens/WorkoutSession/styles.ts b/FrontEndTorv/src/screens/WorkoutSession/styles.ts
index 388b539..af32b7d 100644
--- a/FrontEndTorv/src/screens/WorkoutSession/styles.ts
+++ b/FrontEndTorv/src/screens/WorkoutSession/styles.ts
@@ -44,8 +44,32 @@ export const styles = StyleSheet.create({
   exerciseGroup: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 13 },
   exerciseName: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24, lineHeight: 30, marginTop: 4 },
   setInfo: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: 16, marginTop: 10 },
-  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
-  target: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 15 },
+  target: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 15, marginTop: 6 },
+
+  // Carga da série atual: − valor +. Tocar no valor abre a digitação.
+  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
+  weightStep: {
+    width: TOUCH,
+    height: TOUCH,
+    borderRadius: TOUCH / 2,
+    borderWidth: 1,
+    borderColor: colors.border,
+    backgroundColor: colors.surfaceAlt,
+    alignItems: 'center',
+    justifyContent: 'center',
+  },
+  weightStepDisabled: { opacity: 0.35 },
+  weightValue: {
+    flex: 1,
+    minHeight: TOUCH,
+    borderRadius: radius.sm,
+    backgroundColor: colors.background,
+    alignItems: 'center',
+    justifyContent: 'center',
+    paddingHorizontal: 12,
+  },
+  weightText: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20, fontVariant: ['tabular-nums'] },
+  weightInput: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20, textAlign: 'center' },
 
   mainButton: { height: 64, marginTop: 0, paddingHorizontal: 16 },
   secondaryRow: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' },
```

Commit:
```bash
git commit -m "feat(workout-session): adjust the current set's weight (−/+ 2,5 kg or type it)" -- FrontEndTorv/src/screens/WorkoutSession/index.tsx FrontEndTorv/src/screens/WorkoutSession/styles.ts
```

- [ ] **Passo 5.6: resumo com carga e card de atualizar a rotina**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_summary.diff`

```diff
diff --git a/FrontEndTorv/src/screens/WorkoutSummary/index.tsx b/FrontEndTorv/src/screens/WorkoutSummary/index.tsx
index 4c5e0a6..44b5b63 100644
--- a/FrontEndTorv/src/screens/WorkoutSummary/index.tsx
+++ b/FrontEndTorv/src/screens/WorkoutSummary/index.tsx
@@ -1,4 +1,4 @@
-import React, { useContext, useEffect, useState } from 'react';
+import React, { useContext, useEffect, useMemo, useState } from 'react';
 import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
@@ -9,7 +9,9 @@ import { Button } from '../../components/Button';
 import { Card } from '../../components/Card';
 import { AuthContext } from '../../contexts/AuthContext';
 import { workoutsApi } from '../../services/workouts';
-import { summaryFromDetail, summaryFromState, toSessionPayload, type SessionState, type SummaryView } from '../../utils/workoutSession';
+import {
+  summaryFromDetail, summaryFromState, toSessionPayload, weightChanges, formatWeight, type SessionState, type SummaryView,
+} from '../../utils/workoutSession';
 import { formatClock } from '../../utils/clock';
 import { loadDraft, clearDraft } from '../../utils/workoutDraft';
 import type { AppNavigation, AppStackParamList } from '../../routes/types';
@@ -18,6 +20,8 @@ import { styles } from './styles';
 
 // saving → saved | retry (rede/5xx: rascunho fica) | invalid (400: só descartar) | history (vindo do Perfil)
 type Status = 'loading' | 'saving' | 'saved' | 'retry' | 'invalid' | 'history' | 'missing';
+// Card "Cargas diferentes da rotina": stale = rotina mudou e nada bateu; gone = rotina apagada (404).
+type WeightsStatus = 'idle' | 'saving' | 'done' | 'stale' | 'gone' | 'error' | 'kept';
 
 export default function WorkoutSummary() {
   const navigation = useNavigation<AppNavigation>();
@@ -27,6 +31,9 @@ export default function WorkoutSummary() {
   const [summary, setSummary] = useState<SummaryView | null>(null);
   const [draft, setDraft] = useState<SessionState | null>(null);
   const [status, setStatus] = useState<Status>('loading');
+  const [weightsStatus, setWeightsStatus] = useState<WeightsStatus>('idle');
+  // Do estado da tela: o clearDraft depois do save não apaga o card.
+  const changes = useMemo(() => (draft ? weightChanges(draft) : []), [draft]);
 
   const save = async (state: SessionState) => {
     if (!userId) return;
@@ -63,6 +70,20 @@ export default function WorkoutSummary() {
     })();
   }, [sessionId, userId]);
 
+  const updateRoutineWeights = async () => {
+    if (!draft) return;
+    setWeightsStatus('saving');
+    try {
+      const updated = await workoutsApi.updateRoutineWeights(
+        draft.routine_id,
+        changes.map(({ position, exercise_id, set_number, to }) => ({ position, exercise_id, set_number, weight_kg: to })),
+      );
+      setWeightsStatus(updated > 0 ? 'done' : 'stale');
+    } catch (error) {
+      setWeightsStatus(axios.isAxiosError(error) && error.response?.status === 404 ? 'gone' : 'error');
+    }
+  };
+
   const discard = async () => {
     if (userId) await clearDraft(userId);
     navigation.popTo('Tabs', { screen: 'Workouts' });
@@ -120,12 +141,40 @@ export default function WorkoutSummary() {
           </View>
         </View>
 
+        {status === 'saved' && changes.length > 0 && weightsStatus !== 'kept' && (
+          <Card style={styles.changes}>
+            <Text style={styles.changesTitle}>Cargas diferentes da rotina</Text>
+            {changes.map((c) => (
+              <Text key={`${c.position}-${c.set_number}`} style={styles.changeItem}>
+                {c.name} · série {c.set_number}: {formatWeight(c.from)} → {formatWeight(c.to)}
+              </Text>
+            ))}
+            {weightsStatus === 'done' && <Text style={styles.changesOk}>Rotina atualizada</Text>}
+            {weightsStatus === 'stale' && <Text style={styles.changesNote}>A rotina mudou e as cargas não foram aplicadas.</Text>}
+            {weightsStatus === 'gone' && <Text style={styles.changesNote}>Essa rotina não existe mais.</Text>}
+            {weightsStatus === 'error' && <Text style={styles.error}>Não foi possível atualizar.</Text>}
+            {(weightsStatus === 'idle' || weightsStatus === 'saving' || weightsStatus === 'error') && (
+              <>
+                <Button
+                  title={weightsStatus === 'error' ? 'Tentar de novo' : 'Atualizar rotina'}
+                  loading={weightsStatus === 'saving'}
+                  onPress={updateRoutineWeights}
+                />
+                <Button title="Manter" outline disabled={weightsStatus === 'saving'} onPress={() => setWeightsStatus('kept')} />
+              </>
+            )}
+          </Card>
+        )}
+
         {summary.groups.map((g, gi) => (
           <Card key={`${g.name}-${gi}`}>
             <Text style={styles.groupName}>{g.name}</Text>
             {g.sets.map((s) => (
               <View key={s.set_number} style={styles.setRow}>
-                <Text style={styles.setLabel}>Série {s.set_number}</Text>
+                <View style={styles.setLabelBox}>
+                  <Text style={styles.setLabel}>Série {s.set_number}</Text>
+                  {s.weight_kg !== null && <Text style={styles.setWeight}>{formatWeight(s.weight_kg)}</Text>}
+                </View>
                 <Text style={styles.setValue}>{formatClock(s.duration_sec)}</Text>
                 <Text style={[styles.restValue, s.overdue && styles.overdue]}>
                   {s.rest_before_sec === null ? '—' : `descanso ${formatClock(s.rest_before_sec)}`}
diff --git a/FrontEndTorv/src/screens/WorkoutSummary/styles.ts b/FrontEndTorv/src/screens/WorkoutSummary/styles.ts
index 67b68ce..db07a25 100644
--- a/FrontEndTorv/src/screens/WorkoutSummary/styles.ts
+++ b/FrontEndTorv/src/screens/WorkoutSummary/styles.ts
@@ -20,10 +20,19 @@ export const styles = StyleSheet.create({
   statLabel: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2, textAlign: 'center' },
   groupName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, marginBottom: 8 },
   setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderTopWidth: 1, borderTopColor: colors.border },
-  setLabel: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
+  // Rótulo e carga empilhados: em 320 px não cabe "Série 1 · 62,5 kg" ao lado da duração e do descanso.
+  setLabelBox: { flex: 1, paddingVertical: 6 },
+  setLabel: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
+  setWeight: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 13, marginTop: 1, fontVariant: ['tabular-nums'] },
   setValue: { width: 56, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
   restValue: { width: 116, color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, textAlign: 'right', fontVariant: ['tabular-nums'] },
   // Mesmo vermelho da sessão, em negrito pra não depender só da cor.
   overdue: { color: colors.error, fontFamily: fontFamily.semiBold },
   error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 14, textAlign: 'center' },
+
+  changes: { gap: 10, borderWidth: 1, borderColor: colors.brand },
+  changesTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16 },
+  changeItem: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
+  changesOk: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14 },
+  changesNote: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },
 });
```

Run: `cd FrontEndTorv && npx tsc --noEmit`. Expected: sem erros.

Commit:
```bash
git commit -m "feat(workout-summary): weight per set and update routine weights card" -- FrontEndTorv/src/screens/WorkoutSummary/index.tsx FrontEndTorv/src/screens/WorkoutSummary/styles.ts
```

- [ ] **Passo 5.7: período (vermelho → verde)**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_p_tests.diff`

```diff
diff --git a/FrontEndTorv/src/utils/historyPeriod.test.mjs b/FrontEndTorv/src/utils/historyPeriod.test.mjs
new file mode 100644
index 0000000..25d3b77
--- /dev/null
+++ b/FrontEndTorv/src/utils/historyPeriod.test.mjs
@@ -0,0 +1,46 @@
+// Roda com: node --test src/utils/historyPeriod.test.mjs (Node 24 remove os tipos do .ts sozinho).
+// Os esperados são montados com o Date local, então o teste passa em qualquer fuso.
+import test from 'node:test';
+import assert from 'node:assert/strict';
+import { PERIOD_PRESETS, periodKey, periodRange, customLabel } from './historyPeriod.ts';
+
+const local = (y, m, d) => new Date(y, m - 1, d).toISOString();
+const now = new Date(2026, 9, 2, 22, 45); // 02/10/2026 22:45 local
+
+test('Tudo: sem limites', () => {
+  assert.deepEqual(periodRange({ kind: 'all' }, now), {});
+});
+
+test('7 e 30 dias: de hoje 00:00 contando hoje, sem fim', () => {
+  assert.deepEqual(periodRange({ kind: 'days', days: 7 }, now), { from: local(2026, 9, 26) });
+  assert.deepEqual(periodRange({ kind: 'days', days: 30 }, now), { from: local(2026, 9, 3) });
+});
+
+test('3 meses: mesmo dia; dia que não existe no mês de destino cai no último dia', () => {
+  assert.deepEqual(periodRange({ kind: 'months', months: 3 }, now), { from: local(2026, 7, 2) });
+  assert.deepEqual(periodRange({ kind: 'months', months: 3 }, new Date(2026, 4, 31, 9)), { from: local(2026, 2, 28) });
+  assert.deepEqual(periodRange({ kind: 'months', months: 3 }, new Date(2026, 0, 15)), { from: local(2025, 10, 15) });
+});
+
+test('Personalizado: início 00:00 até o dia seguinte ao fim 00:00 (fim incluso), virando mês e ano', () => {
+  assert.deepEqual(periodRange({ kind: 'custom', start: '2026-09-12', end: '2026-09-30' }, now), {
+    from: local(2026, 9, 12), before: local(2026, 10, 1),
+  });
+  assert.deepEqual(periodRange({ kind: 'custom', start: '2025-12-31', end: '2025-12-31' }, now), {
+    from: local(2025, 12, 31), before: local(2026, 1, 1),
+  });
+});
+
+test('periodKey: mesmo período em objetos diferentes = mesma chave; períodos diferentes = chaves diferentes', () => {
+  assert.equal(periodKey({ kind: 'days', days: 7 }), periodKey({ kind: 'days', days: 7 }));
+  const keys = [
+    ...PERIOD_PRESETS.map((p) => periodKey(p.period)),
+    periodKey({ kind: 'custom', start: '2026-09-12', end: '2026-09-30' }),
+    periodKey({ kind: 'custom', start: '2026-09-12', end: '2026-09-29' }),
+  ];
+  assert.equal(new Set(keys).size, keys.length);
+});
+
+test('customLabel: dd/mm – dd/mm', () => {
+  assert.equal(customLabel({ start: '2026-09-12', end: '2026-10-01' }), '12/09 – 01/10');
+});
```

Run: `cd FrontEndTorv && node --test src/utils/historyPeriod.test.mjs`
Expected: FAIL, `Cannot find module …historyPeriod.ts`.

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_p_impl.diff`

```diff
diff --git a/FrontEndTorv/src/utils/historyPeriod.ts b/FrontEndTorv/src/utils/historyPeriod.ts
new file mode 100644
index 0000000..0c29d99
--- /dev/null
+++ b/FrontEndTorv/src/utils/historyPeriod.ts
@@ -0,0 +1,55 @@
+// Filtro de período do Histórico. Os limites saem no fuso do aparelho (o mesmo do agrupamento por dia)
+// e viram ISO para o GET /activities: from inclusivo, before exclusivo.
+
+export type Period =
+  | { kind: 'all' }
+  | { kind: 'days'; days: number } // hoje + os (days - 1) dias anteriores
+  | { kind: 'months'; months: number } // do mesmo dia, N meses atrás
+  | { kind: 'custom'; start: string; end: string }; // YYYY-MM-DD, os dois dias inclusos
+
+export const PERIOD_PRESETS: { label: string; period: Period }[] = [
+  { label: 'Tudo', period: { kind: 'all' } },
+  { label: '7 dias', period: { kind: 'days', days: 7 } },
+  { label: '30 dias', period: { kind: 'days', days: 30 } },
+  { label: '3 meses', period: { kind: 'months', months: 3 } },
+];
+
+// Chave estável para comparar filtros (o mesmo período em objetos diferentes = mesma chave).
+export function periodKey(p: Period): string {
+  switch (p.kind) {
+    case 'all': return 'all';
+    case 'days': return `days:${p.days}`;
+    case 'months': return `months:${p.months}`;
+    case 'custom': return `custom:${p.start}:${p.end}`;
+  }
+}
+
+// Sem import do utils/date: o node --test só resolve import de .ts com extensão, e o tsc do app não aceita a extensão.
+const ymd = (iso: string) => iso.split('-').map(Number);
+
+export function periodRange(p: Period, now: Date): { from?: string; before?: string } {
+  const y = now.getFullYear();
+  const m = now.getMonth();
+  const d = now.getDate();
+  switch (p.kind) {
+    case 'all':
+      return {};
+    case 'days':
+      return { from: new Date(y, m, d - (p.days - 1)).toISOString() };
+    case 'months': {
+      // 31/05 − 3 meses = 28/02 (ou 29), não 03/03.
+      const lastDay = new Date(y, m - p.months + 1, 0).getDate();
+      return { from: new Date(y, m - p.months, Math.min(d, lastDay)).toISOString() };
+    }
+    case 'custom': {
+      const [sy, sm, sd] = ymd(p.start);
+      const [ey, em, ed] = ymd(p.end);
+      return { from: new Date(sy, sm - 1, sd).toISOString(), before: new Date(ey, em - 1, ed + 1).toISOString() };
+    }
+  }
+}
+
+const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
+
+// Rótulo do chip "Personalizado" depois de escolher: "12/09 – 30/09".
+export const customLabel = (p: { start: string; end: string }) => `${dayMonth(p.start)} – ${dayMonth(p.end)}`;
```

Run, em bash:
```bash
cd FrontEndTorv && for tz in "" America/Sao_Paulo Asia/Tokyo Pacific/Kiritimati America/Los_Angeles; do TZ=$tz node --test src/utils/historyPeriod.test.mjs | grep -E "^ℹ (pass|fail)"; done
```
Expected: `pass 6` / `fail 0` nos 5 fusos.

Commit:
```bash
git add FrontEndTorv/src/utils/historyPeriod.ts FrontEndTorv/src/utils/historyPeriod.test.mjs
git commit -m "feat(history): period ranges in the device time zone" -- FrontEndTorv/src/utils/historyPeriod.ts FrontEndTorv/src/utils/historyPeriod.test.mjs
```

- [ ] **Passo 5.8: chips de período e Personalizado**

Run: `git apply docs/superpowers/plans/2026-10-02-loads-period-welcome/fe_history.diff`

```diff
diff --git a/FrontEndTorv/src/components/DatePickerModal/index.tsx b/FrontEndTorv/src/components/DatePickerModal/index.tsx
index e04f7b7..33ef269 100644
--- a/FrontEndTorv/src/components/DatePickerModal/index.tsx
+++ b/FrontEndTorv/src/components/DatePickerModal/index.tsx
@@ -24,6 +24,7 @@ const NAV_HIT_SLOP = { top: 4, bottom: 4 };
 
 interface Props {
   visible: boolean;
+  title?: string; // acima da data; ex.: "Desde quando?"
   value: string; // YYYY-MM-DD
   minDate?: string;
   maxDate?: string;
@@ -31,7 +32,7 @@ interface Props {
   onClose: () => void;
 }
 
-export const DatePickerModal: React.FC<Props> = ({ visible, value, minDate, maxDate, onConfirm, onClose }) => {
+export const DatePickerModal: React.FC<Props> = ({ visible, title, value, minDate, maxDate, onConfirm, onClose }) => {
   // Páginas de anos terminam no ano de maxDate (ou no ano de hoje): [end-11 .. end], end = anchor - 12k.
   const anchor = (maxDate ? parseLocalDate(maxDate) : new Date()).getFullYear();
 
@@ -150,6 +151,7 @@ export const DatePickerModal: React.FC<Props> = ({ visible, value, minDate, maxD
     <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
       <View style={styles.overlay}>
         <View style={styles.content}>
+          {!!title && <Text style={styles.title}>{title}</Text>}
           <Text style={styles.year}>{selectedDate.getFullYear()}</Text>
           <Text style={styles.selectedLabel}>
             {`${WEEKDAYS[selectedDate.getDay()].slice(0, 3)}., ${selectedDate.getDate()} de ${MONTHS[selectedDate.getMonth()].slice(0, 3)}.`}
diff --git a/FrontEndTorv/src/components/DatePickerModal/styles.ts b/FrontEndTorv/src/components/DatePickerModal/styles.ts
index 1d636b5..2f9e59d 100644
--- a/FrontEndTorv/src/components/DatePickerModal/styles.ts
+++ b/FrontEndTorv/src/components/DatePickerModal/styles.ts
@@ -15,6 +15,7 @@ export const styles = StyleSheet.create({
     maxWidth: 400,
     alignSelf: 'center',
   },
+  title: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14, marginBottom: 8 },
   year: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },
   selectedLabel: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 28, marginTop: 4, marginBottom: 16 },
   monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
diff --git a/FrontEndTorv/src/screens/Workouts/History.tsx b/FrontEndTorv/src/screens/Workouts/History.tsx
index 45124a1..3334146 100644
--- a/FrontEndTorv/src/screens/Workouts/History.tsx
+++ b/FrontEndTorv/src/screens/Workouts/History.tsx
@@ -5,52 +5,66 @@ import { Dumbbell, ChevronRight } from 'lucide-react-native';
 
 import { Card } from '../../components/Card';
 import { Button } from '../../components/Button';
+import { DatePickerModal } from '../../components/DatePickerModal';
 import { activitiesApi, ACTIVITY_TYPES, type ActivityItem, type ActivityType } from '../../services/activities';
 import { ACTIVITY_LABELS, activityLabel } from '../../utils/activities';
 import { groupByDay, prependNew, type DayGroup } from '../../utils/historyGroups';
+import { PERIOD_PRESETS, periodKey, periodRange, customLabel, type Period } from '../../utils/historyPeriod';
 import { formatClock } from '../../utils/clock';
+import { toISODate } from '../../utils/date';
 import type { AppNavigation } from '../../routes/types';
 import { colors } from '../../theme/tokens';
 import { historyStyles as styles } from './historyStyles';
 
 const PAGE = 20;
+const ALL: Period = { kind: 'all' };
 const pad = (n: number) => String(n).padStart(2, '0');
 const timeOf = (iso: string) => {
   const d = new Date(iso);
   return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
 };
+// Filtro inteiro (tipo + período) numa string, para comparar com o que está carregado.
+const filterKey = (type: ActivityType | undefined, period: Period) => `${type ?? 'ALL'}|${periodKey(period)}`;
 
 type Status = 'loading' | 'ready' | 'error';
+// Personalizado: escolhe o início e depois o fim, no mesmo DatePickerModal.
+type Picking = null | { step: 'start' } | { step: 'end'; start: string };
 
 export default function History({ onShowRoutines }: { onShowRoutines: () => void }) {
   const navigation = useNavigation<AppNavigation>();
   const [type, setType] = useState<ActivityType | undefined>(undefined); // undefined = Todos
+  const [period, setPeriod] = useState<Period>(ALL);
+  const [picking, setPicking] = useState<Picking>(null);
   const [items, setItems] = useState<ActivityItem[]>([]);
   const [nextBefore, setNextBefore] = useState<string | null>(null);
   const [status, setStatus] = useState<Status>('loading');
   const [refreshing, setRefreshing] = useState(false);
   const [loadingMore, setLoadingMore] = useState(false);
   const request = useRef(0); // resposta de um filtro antigo chega depois → descarta
-  const loadedType = useRef<ActivityType | undefined | null>(null); // filtro da última carga ok; null = nunca carregou ou deu erro
+  const loadedKey = useRef<string | null>(null); // filtro da última carga ok; null = nunca carregou ou deu erro
   const offset = useRef(0); // posição da lista, para voltar do resumo no mesmo ponto
   const listRef = useRef<SectionList<ActivityItem, DayGroup<ActivityItem>>>(null);
 
-  const loadFirst = async (filter: ActivityType | undefined, refresh = false) => {
+  // Limites recalculados a cada chamada: "7 dias" depois da meia-noite já é outro intervalo.
+  const query = (filterType: ActivityType | undefined, filterPeriod: Period) =>
+    ({ type: filterType, ...periodRange(filterPeriod, new Date()), limit: PAGE });
+
+  const loadFirst = async (filterType: ActivityType | undefined, filterPeriod: Period, refresh = false) => {
     const id = ++request.current;
     offset.current = 0;
-    loadedType.current = null; // carga em andamento invalida o atalho do foco (troca rápida A→B→A)
+    loadedKey.current = null; // carga em andamento invalida o atalho do foco (troca rápida A→B→A)
     if (refresh) setRefreshing(true);
     else setStatus('loading');
     try {
-      const page = await activitiesApi.list({ type: filter, limit: PAGE });
+      const page = await activitiesApi.list(query(filterType, filterPeriod));
       if (id !== request.current) return;
       setItems(page.activities);
       setNextBefore(page.next_before);
       setStatus('ready');
-      loadedType.current = filter;
+      loadedKey.current = filterKey(filterType, filterPeriod);
     } catch {
       if (id !== request.current) return;
-      loadedType.current = null;
+      loadedKey.current = null;
       setStatus('error');
     } finally {
       if (id === request.current) setRefreshing(false);
@@ -62,7 +76,8 @@ export default function History({ onShowRoutines }: { onShowRoutines: () => void
     const id = request.current;
     setLoadingMore(true);
     try {
-      const page = await activitiesApi.list({ type, before: nextBefore, limit: PAGE });
+      // Mesmo from do período; o before vira o cursor (sempre antes do fim do período).
+      const page = await activitiesApi.list({ ...query(type, period), before: nextBefore });
       if (id !== request.current) return;
       setItems((prev) => [...prev, ...page.activities]);
       setNextBefore(page.next_before);
@@ -78,7 +93,7 @@ export default function History({ onShowRoutines }: { onShowRoutines: () => void
   const refreshTop = async () => {
     const id = request.current;
     try {
-      const page = await activitiesApi.list({ type, limit: PAGE });
+      const page = await activitiesApi.list(query(type, period));
       if (id === request.current) setItems((prev) => prependNew(prev, page.activities));
     } catch {
       // Falhou: fica o que já está na tela.
@@ -93,98 +108,131 @@ export default function History({ onShowRoutines }: { onShowRoutines: () => void
 
   // Mesmo filtro já carregado → mantém a lista e a posição; filtro novo (ou 1ª vez, ou erro) → carga do zero.
   useFocusEffect(useCallback(() => {
-    if (loadedType.current === type) {
+    if (loadedKey.current === filterKey(type, period)) {
       refreshTop();
       restoreScroll();
-    } else loadFirst(type);
-  }, [type]));
+    } else loadFirst(type, period);
+  }, [type, period]));
+
+  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
+    <TouchableOpacity
+      key={key}
+      style={[styles.chip, active && styles.chipActive]}
+      onPress={onPress}
+      accessibilityRole="button"
+      accessibilityState={{ selected: active }}
+      aria-selected={active} // react-native-web ignora accessibilityState
+    >
+      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
+    </TouchableOpacity>
+  );
 
-  const chips = (
-    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
-      {[undefined, ...ACTIVITY_TYPES].map((t) => {
-        const active = t === type;
-        return (
-          <TouchableOpacity
-            key={t ?? 'ALL'}
-            style={[styles.chip, active && styles.chipActive]}
-            onPress={() => setType(t)}
-            accessibilityRole="button"
-            accessibilityState={{ selected: active }}
-            aria-selected={active} // react-native-web ignora accessibilityState
-          >
-            <Text style={[styles.chipText, active && styles.chipTextActive]}>{t ? ACTIVITY_LABELS[t] : 'Todos'}</Text>
-          </TouchableOpacity>
-        );
-      })}
-    </ScrollView>
+  const filters = (
+    <View>
+      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
+        {[undefined, ...ACTIVITY_TYPES].map((t) => chip(t ?? 'ALL', t ? ACTIVITY_LABELS[t] : 'Todos', t === type, () => setType(t)))}
+      </ScrollView>
+      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
+        {PERIOD_PRESETS.map((p) => chip(p.label, p.label, periodKey(p.period) === periodKey(period), () => setPeriod(p.period)))}
+        {chip('custom', period.kind === 'custom' ? customLabel(period) : 'Personalizado', period.kind === 'custom', () => setPicking({ step: 'start' }))}
+      </ScrollView>
+    </View>
+  );
+
+  const today = toISODate(new Date());
+  const picker = (
+    <DatePickerModal
+      visible={picking !== null}
+      title={picking?.step === 'end' ? 'Até quando?' : 'Desde quando?'}
+      value={picking?.step === 'end' ? picking.start : period.kind === 'custom' ? period.start : today}
+      minDate={picking?.step === 'end' ? picking.start : undefined}
+      maxDate={today}
+      onConfirm={(date) => {
+        if (picking?.step === 'start') setPicking({ step: 'end', start: date });
+        else if (picking?.step === 'end') {
+          setPeriod({ kind: 'custom', start: picking.start, end: date });
+          setPicking(null);
+        }
+      }}
+      onClose={() => setPicking(null)} // cancelar em qualquer passo mantém o filtro anterior
+    />
   );
 
   if (status !== 'ready') {
     return (
       <View style={[styles.container, styles.padded]}>
-        {chips}
+        {filters}
         {status === 'loading' ? (
           <ActivityIndicator color={colors.brand} style={styles.loading} />
         ) : (
           <View style={styles.centered}>
             <Text style={styles.message}>Não foi possível carregar o histórico.</Text>
-            <Button title="Tentar de novo" outline onPress={() => loadFirst(type)} />
+            <Button title="Tentar de novo" outline onPress={() => loadFirst(type, period)} />
           </View>
         )}
+        {picker}
       </View>
     );
   }
 
   return (
-    <SectionList
-      ref={listRef}
-      style={styles.container}
-      contentContainerStyle={styles.list}
-      sections={groupByDay(items, new Date())}
-      keyExtractor={(a) => a.id}
-      stickySectionHeadersEnabled={false}
-      ListHeaderComponent={chips}
-      renderSectionHeader={({ section }) => <Text style={styles.dayTitle}>{section.title}</Text>}
-      renderItem={({ item }) => {
-        const title = item.title || activityLabel(item.activity_type);
-        const content = (
-          <Card style={styles.item}>
-            <View style={styles.itemIcon}>
-              <Dumbbell color={colors.brand} size={20} />
-            </View>
-            <View style={styles.itemInfo}>
-              <Text style={styles.itemTitle} numberOfLines={2}>{title}</Text>
-              <Text style={styles.itemMeta}>
-                {timeOf(item.start_time)} · {formatClock(item.duration_sec)} · {item.set_count} {item.set_count === 1 ? 'série' : 'séries'}
-              </Text>
-            </View>
-            {item.activity_type === 'STRENGTH' && <ChevronRight color={colors.textSecondary} size={20} />}
+    <>
+      <SectionList
+        ref={listRef}
+        style={styles.container}
+        contentContainerStyle={styles.list}
+        sections={groupByDay(items, new Date())}
+        keyExtractor={(a) => a.id}
+        stickySectionHeadersEnabled={false}
+        ListHeaderComponent={filters}
+        renderSectionHeader={({ section }) => <Text style={styles.dayTitle}>{section.title}</Text>}
+        renderItem={({ item }) => {
+          const title = item.title || activityLabel(item.activity_type);
+          const content = (
+            <Card style={styles.item}>
+              <View style={styles.itemIcon}>
+                <Dumbbell color={colors.brand} size={20} />
+              </View>
+              <View style={styles.itemInfo}>
+                <Text style={styles.itemTitle} numberOfLines={2}>{title}</Text>
+                <Text style={styles.itemMeta}>
+                  {timeOf(item.start_time)} · {formatClock(item.duration_sec)} · {item.set_count} {item.set_count === 1 ? 'série' : 'séries'}
+                </Text>
+              </View>
+              {item.activity_type === 'STRENGTH' && <ChevronRight color={colors.textSecondary} size={20} />}
+            </Card>
+          );
+          // Só musculação tem resumo (GET /workouts/sessions/:id).
+          return item.activity_type === 'STRENGTH' ? (
+            <TouchableOpacity
+              onPress={() => navigation.navigate('WorkoutSummary', { sessionId: item.id })}
+              accessibilityRole="button"
+              accessibilityLabel={`Ver treino ${title}`}
+            >
+              {content}
+            </TouchableOpacity>
+          ) : content;
+        }}
+        ListEmptyComponent={period.kind === 'all' ? (
+          <Card style={styles.empty}>
+            <Dumbbell color={colors.textSecondary} size={28} />
+            <Text style={styles.message}>Nenhum treino ainda</Text>
+            <Button title="Ver meus treinos" outline onPress={onShowRoutines} />
           </Card>
-        );
-        // Só musculação tem resumo (GET /workouts/sessions/:id).
-        return item.activity_type === 'STRENGTH' ? (
-          <TouchableOpacity
-            onPress={() => navigation.navigate('WorkoutSummary', { sessionId: item.id })}
-            accessibilityRole="button"
-            accessibilityLabel={`Ver treino ${title}`}
-          >
-            {content}
-          </TouchableOpacity>
-        ) : content;
-      }}
-      ListEmptyComponent={(
-        <Card style={styles.empty}>
-          <Dumbbell color={colors.textSecondary} size={28} />
-          <Text style={styles.message}>Nenhum treino ainda</Text>
-          <Button title="Ver meus treinos" outline onPress={onShowRoutines} />
-        </Card>
-      )}
-      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={styles.footer} /> : null}
-      onEndReached={loadMore}
-      onEndReachedThreshold={0.3}
-      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }}
-      scrollEventThrottle={16}
-      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFirst(type, true)} tintColor={colors.brand} />}
-    />
+        ) : (
+          <Card style={styles.empty}>
+            <Dumbbell color={colors.textSecondary} size={28} />
+            <Text style={styles.message}>Nenhum treino nesse período</Text>
+          </Card>
+        )}
+        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={styles.footer} /> : null}
+        onEndReached={loadMore}
+        onEndReachedThreshold={0.3}
+        onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }}
+        scrollEventThrottle={16}
+        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFirst(type, period, true)} tintColor={colors.brand} />}
+      />
+      {picker}
+    </>
   );
 }
diff --git a/FrontEndTorv/src/services/activities.ts b/FrontEndTorv/src/services/activities.ts
index 1bb3332..9a4afaa 100644
--- a/FrontEndTorv/src/services/activities.ts
+++ b/FrontEndTorv/src/services/activities.ts
@@ -20,7 +20,8 @@ export interface ActivityPage {
 
 export interface ActivityQuery {
   type?: ActivityType;
-  before?: string;
+  from?: string; // ISO, inclusivo
+  before?: string; // ISO, exclusivo (fim do período ou next_before)
   limit?: number;
 }
 
```

Run: `cd FrontEndTorv && npx tsc --noEmit && node --test "src/**/*.test.mjs"`
Expected: `tsc` sem erros; `ℹ pass 32`, `ℹ fail 0`.

Commit:
```bash
git commit -m "feat(history): period chips and custom range" -- FrontEndTorv/src/services/activities.ts FrontEndTorv/src/components/DatePickerModal/index.tsx FrontEndTorv/src/components/DatePickerModal/styles.ts FrontEndTorv/src/screens/Workouts/History.tsx
```

- [ ] **Passo 5.9: passada visual com `/frontend-design`**

Rode `/frontend-design` sobre os quatro pontos novos:
- controle "− valor +";
- card "Cargas diferentes da rotina";
- segunda linha de chips;
- `WelcomeModal`.

**O que pode mudar:** só estilo (`styles.ts` e a estrutura visual do JSX). A lógica, os textos da spec e os `accessibilityLabel` ficam como estão.

**O que precisa continuar valendo:**
- caber em 320 px e 412 px;
- alvos ≥ 44 px;
- tokens de `theme/tokens.ts`;
- os três selos de rotina continuam distintos.
- O card de cargas não pode competir com o "Concluir": use tinta (`brandTint`) ou contorno, não verde sólido.

Confira no Expo web (portal do Maestri) em 320 e 412:
- abrir um treino, mudar a carga com −/+ e digitando "7,5";
- concluir e ver o card;
- Histórico com as duas linhas de chips;
- login de conta nova com as boas-vindas.

Run: `cd FrontEndTorv && npx tsc --noEmit && node --test "src/**/*.test.mjs"` (verde)

Commit só dos arquivos de estilo e JSX que mudaram, com pathspec: `style(workouts): frontend-design pass on weight control, weights card, period chips and welcome`.

### Task 6: Teste da etapa Frontend (Torv Review and Tests)

- [ ] Relatório `docs/qa-loads-welcome-frontend-2026-10-02.md`.
  - **Automatizados:** `npx tsc --noEmit` e `node --test "src/**/*.test.mjs"`.
  - **Usabilidade no navegador (Expo web, portal do Maestri), em 412 e 320, com conta nova:**
    1. **Boas-vindas:**
       - aparece no 1º acesso, com o primeiro nome;
       - "Começar" fecha;
       - recarregar a página ou fazer logout/login não mostra de novo.
    2. **Senha:** no Login e no Cadastro, a senha oculta aparece como bolinhas (`font-family` computada do input mascarado é a pilha do sistema, não Sora); o olho mostra o texto em Sora.
    3. **Carga no treino:**
       - −/+ (de 2,5 vai para "Sem carga" e volta);
       - digitar "7,5", "7," (ignora), "1000" (vira 999,99) e apagar ("Sem carga");
       - "Terminei a série" com o campo aberto mantém o valor digitado;
       - sair e "Continuar treino" mantém as cargas.
    4. **Resumo:**
       - a carga aparece em cada série ("62,5 kg");
       - o card lista as diferenças;
       - "Atualizar rotina" → "Rotina atualizada", e o editor da rotina mostra as cargas novas;
       - em outro treino, "Manter" esconde o card e a rotina não muda;
       - treino sem mudança não mostra card.
    5. **Histórico:**
       - as duas linhas de chips;
       - 7 dias, 30 dias, 3 meses e Tudo;
       - Personalizado com início e fim → o chip mostra "dd/mm – dd/mm" e filtra;
       - cancelar no 1º e no 2º passo mantém o filtro;
       - período sem treino → "Nenhum treino nesse período";
       - tipo + período juntos;
       - rolar até paginar dentro do período;
       - abrir um treino e voltar mantém a posição.
    6. **Resumo antigo:** abrir pelo Histórico um treino gravado antes da mudança → sem texto de carga, sem erro.
    7. Console sem erros.
  - **API no celular:**
    - `curl -s -H "expo-platform: android" -H "accept: application/expo+json,application/json" http://<IP>:8081/` → `extra.expoClient.hostUri` = `<IP>:8081`;
    - no web, as requisições vão para `http://<host>:3000` e o login funciona;
    - o `FrontEndTorv/.env` continua vazio.
- [ ] Commit só do relatório.

### Task 7: Teste completo (Torv Review and Tests)

- [ ] Relatório `docs/qa-loads-welcome-full-2026-10-02.md`.
  - Estado final, contas novas, as etapas juntas.
  - Mais a regressão do módulo de treinos e do histórico:
    - criar e editar rotina;
    - treino completo;
    - selo "Concluído" e aviso;
    - Histórico (seta de voltar e posição);
    - Perfil "Atividade Física";
    - Home "Iniciar".
  - Backend `npm test`, front `tsc` + `node --test`.
- [ ] Commit só do relatório.

### Task 8: Security (Torv Security)

- [ ] Relatório `docs/security-loads-welcome-2026-10-02.md`. OWASP no diff inteiro da feature (desde `b910d49`), com foco em:
  - IDOR no `PATCH /workouts/routines/:id/weights` (o `user_id` vem só do token; rotina alheia → 404 sem efeito colateral) e no `POST /profile/welcome`;
  - limites do body (200 itens, carga, posição e série);
  - `from`/`before`;
  - CORS (`PATCH` liberado; mesma origem de antes);
  - o `hostUri` no front (não vaza nada além do IP de dev);
  - a nova dependência `expo-constants`.
- [ ] Commit só do relatório.

### Task 9: `revisar3.md` (Maestro)

- [ ] **Na raiz, sem commit, no formato do `revisar2.md`:**
  - status e tabela das etapas;
  - números dos testes;
  - "O que mudou para o usuário";
  - arquivos por camada (Database / Repositórios / Controller e lib / Routes / Frontend);
  - ciclo e relatórios;
  - "Para você decidir";
  - ambiente.
- [ ] **Registrar também:**
  - o diff local do `api.ts`, que foi absorvido;
  - que o `.env` não é mais necessário;
  - o caso túnel/outra rede (`EXPO_PUBLIC_API_URL`);
  - a causa real dos quadrados (o "•" da Sora);
  - as contas de teste criadas.
