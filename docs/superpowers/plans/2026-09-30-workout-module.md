# Módulo de Treinos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **No TORV, cada task é executada pelo recruta Maestri indicado em "Owner"** (CLAUDE.md §4: Cistern = Torv Database, Anvil = Torv Backend, Lumen = Torv Frontend, Loupe = Torv Review and Tests, Warden = Torv Security), nunca por subagent interno.

**Goal:** Treino padrão gerado no primeiro acesso (nível, objetivo e sexo, conforme a planilha), rotinas próprias com exercícios do catálogo ou próprios e carga por série, e execução do treino com cronômetro total + cronômetro de descanso que fica vermelho quando passa do alvo.

**Architecture:** Gerador puro em `BackEndTorv/src/lib/workoutGenerator.js` (espelho da planilha) chamado de forma lazy no `GET /workouts/routines`; persistência com transação interativa + `createMany` (ids gerados no Node). Catálogo de 71 exercícios semeado pela migration. No front, uma máquina de estados pura (`workoutSession.ts`) guarda o treino como rascunho no AsyncStorage e envia tudo no fim (`POST /workouts/sessions`, idempotente por `started_at`). Entrega 1 = rotinas; entrega 2 = execução.

**Tech Stack:** Node 24 + Fastify 5 + TypeBox + Prisma 6 (Postgres/Supabase); `node:test` (backend `.js`, front `.mjs` importando `.ts` via type stripping do Node 24); React Native 0.86 / Expo 57 / TypeScript; React Navigation 7 (bottom-tabs + native-stack).

**Spec:** `docs/superpowers/specs/2026-09-30-workout-module-design.md`

**Fonte das regras:** `BackEndTorv/treino_padrao_referencia.xlsx` (abas `Algoritmo`, `Niveis`, `Objetivos`, `Sessoes`, `Exercicios`, `Gerador`). As constantes do gerador e o seed da migration abaixo já foram extraídos da planilha por script; não redigitar.

## Global Constraints

- Branch: `feat/workout-module`. Commits nessa branch; **não fazer push** (o usuário avisa quando).
- Commit sempre com pathspec explícito (`git add -- <arquivos> && git commit -m "..." -- <arquivos>`): recrutas commitam em paralelo no mesmo índice. Nunca commitar `FrontEndTorv/src/services/api.ts` nem `FrontEndTorv/tsconfig.json`.
- Schema/migration: só o **Torv Database** toca `BackEndTorv/prisma/`.
- Postgres puro; nada proprietário do Supabase. Tabela nova = `ENABLE ROW LEVEL SECURITY` + policy `torv_api_full_access` na mesma migration.
- Valores de domínio exatos: níveis `'INICIANTE' | 'INTERMEDIÁRIO' | 'AVANÇADO'`; sexo `'Masculino' | 'Feminino'` (qualquer outro → código `N`); objetivos `'Perder Peso'`, `'Ganhar Massa Muscular'`, `'Melhorar Condicionamento'`, `'Aumentar Resistência'`, `'Criar uma Rotina'`, `'Saúde & Bem-estar'` (`user_profiles.goal` é string `", "`-separada); grupos musculares `Peito`, `Costas`, `Ombros`, `Bíceps`, `Tríceps`, `Quadríceps`, `Posterior de coxa`, `Glúteos`, `Panturrilha`, `Abdômen`, `Lombar`, `Antebraço`; `activities.activity_type = 'STRENGTH'`.
- Limites (iguais no backend e no front): nome 1–100 (trim); 1–20 exercícios por rotina; 1–10 séries por exercício; reps inteiras 1–100 com mín ≤ máx; descanso 0–600 s; carga NULL ou 0–999,99; sessão: `duration_sec` 1–21600, 1–200 séries, `position` 1–20, `set_number` 1–10, série 0–3600 s, descanso NULL ou 0–7200 s, `started_at` ≥ 2026-01-01 e ≤ agora + 5 min.
- Recurso de outro usuário (ou do catálogo usado como próprio) → **404**, nunca 403. `exercise_name` da sessão vem só do banco.
- Front chama só a nossa API. Única dependência nova: `@react-native-async-storage/async-storage` (entrega 2, via `npx expo install`).
- Backend roda no terminal Maestri **Furnace** (porta 3000); nunca subir segunda instância.
- Usabilidade: Expo **web** (`localhost:8081`) num portal Maestri do navegador (`maestri portal create http://localhost:8081 "<Nome>" --size 412x915`), não no emulador. Checagens de contrato HTTP via `maestri portal evaluate` com `fetch` e o token lido do storage da página (o token não sai do navegador).
- Relatórios em `docs/`, um arquivo por rodada, nunca sobrescrever: `qa-workout-routines-2026-09-30[-roundN].md`, `security-workout-routines-2026-09-30[-roundN].md` (entrega 1); `qa-workout-session-<AAAA-MM-DD>[-roundN].md`, `security-workout-session-<AAAA-MM-DD>[-roundN].md` (entrega 2).
- Fora do escopo: cardio, RIR, progressão de carga, checagem de volume, streak real na Home, notificação/vibração no fim do descanso, manter a tela acesa, reordenar rotinas, carga/reps realizadas na sessão.
- Expo pro celular do usuário só depois do ciclo completo (Test e Security verdes).

## Review Focus

1. **Duas cargas simultâneas logo depois do login** (Home e aba Treinos pedem `GET /workouts/routines` ao mesmo tempo para uma conta sem plano) → exatamente um plano default, sem rotinas duplicadas. Teste: Task 8, Step 2.
2. **Aceitar a sugestão duas vezes** (toque duplo em "Regerar", ou `accept` sem sugestão pendente) → rotinas default não duplicam nem somem; `dismiss` esconde o banner até a próxima mudança de perfil. Teste: Task 8, Step 2.
3. **Reenvio do mesmo treino** depois de a resposta se perder (mesmo `started_at`) → um único `activities`, streak sobe uma vez só. Teste: Task 14, Step 2.
4. **Página recarregada / app fechado no meio do descanso** → ao continuar, o descanso segue do timestamp original (não zera) e o vermelho reflete o tempo real. Teste: Task 14, Step 3.
5. **Rotina ou exercício próprio apagado durante o treino** → o treino ainda salva, como "Treino livre" / "Exercício removido", sem prender o rascunho. Teste: Task 14, Steps 2 e 3.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `BackEndTorv/prisma/schema.prisma` | Models novos/alterados (`exercises`, `workout_routines`, `routine_exercises`, `routine_exercise_sets`, `workout_sets`, `activities.routine_id`, `user_profiles.workout_plan_basis`) |
| `BackEndTorv/prisma/migrations/20260930200000_workout_module/migration.sql` **(novo)** | DDL + CHECKs + índice parcial + RLS + seed dos 71 exercícios |
| `BackEndTorv/src/lib/workoutGenerator.js` **(novo)** | Algoritmo puro da planilha: `generatePlan`, `buildBasis`, `diffPlanBasis`, constantes |
| `BackEndTorv/src/lib/workoutValidation.js` **(novo)** | Regras cruzadas que o TypeBox não expressa |
| `BackEndTorv/src/lib/workoutPlan.js` **(novo)** | `ensureDefaultPlan`, `planSuggestion`, `acceptPlan`, `dismissPlan`, `nextRoutineId` |
| `BackEndTorv/src/repository/workout.repository.js` **(novo)** | Acesso Prisma de rotinas, exercícios, plano e sessões |
| `BackEndTorv/src/controller/workout.controller.js` **(novo)** | Handlers `/workouts/*` |
| `BackEndTorv/src/routes/workout.schemas.js` **(novo)** | Schemas TypeBox |
| `BackEndTorv/src/routes/workout.routes.js` **(novo)** | Plugin `/workouts` com `authenticateToken` |
| `BackEndTorv/src/**/*.test.js` **(novos)** | Testes `node --test` (gerador, validação, plano, rotas com repository mockado) |
| `BackEndTorv/server.js` | Registra `/workouts` |
| `BackEndTorv/src/repository/profile.repository.js` / `controller/profile.controller.js` | Contadores reais `total_workouts` / `workouts_in_month` (entrega 2) |
| `FrontEndTorv/src/services/workouts.ts` **(novo)** | Tipos do contrato + `workoutsApi` |
| `FrontEndTorv/src/utils/clock.ts` **(novo)** | `formatClock` |
| `FrontEndTorv/src/utils/routineForm.ts` **(novo)** | Estado/validação do editor → corpo do POST/PUT |
| `FrontEndTorv/src/utils/workoutSession.ts` **(novo, entrega 2)** | Máquina de estados do treino + payload + resumo |
| `FrontEndTorv/src/utils/workoutDraft.ts` **(novo, entrega 2)** | Rascunho no AsyncStorage |
| `FrontEndTorv/src/utils/*.test.mjs` **(novos)** | Testes `node --test` dos módulos puros |
| `FrontEndTorv/src/components/ConfirmModal/` **(novo)** | Confirmação (Alert não funciona no web) |
| `FrontEndTorv/src/components/ExercisePicker/` **(novo)** | Catálogo + exercícios próprios (criar/editar/excluir) |
| `FrontEndTorv/src/screens/Workouts/` **(novo)** | Aba Treinos: lista, banner de sugestão, (entrega 2) rascunho e ▶ |
| `FrontEndTorv/src/screens/RoutineEditor/` **(novo)** | Criar/editar rotina |
| `FrontEndTorv/src/screens/WorkoutSession/` **(novo, entrega 2)** | Execução com os 2 cronômetros |
| `FrontEndTorv/src/screens/WorkoutSummary/` **(novo, entrega 2)** | Resumo + envio; também histórico |
| `FrontEndTorv/src/routes/types.ts` **(novo)** | Param lists das abas e da pilha |
| `FrontEndTorv/src/routes/PrivateRoutes/index.tsx` | Pilha (abas + telas de treino) e aba Treinos |
| `FrontEndTorv/src/screens/Home/index.tsx` | Card "Treino de hoje" real |
| `FrontEndTorv/src/screens/Profile/index.tsx` | "Atividade Física" real (entrega 2) |
| `FrontEndTorv/src/contexts/AuthContext.tsx` | Logout apaga o rascunho (entrega 2) |

---

# Entrega 1 — Rotinas

### Task 1: Migration, seed e schema

**Owner:** Torv Database (Cistern)

**Files:**
- Modify: `BackEndTorv/prisma/schema.prisma`
- Create: `BackEndTorv/prisma/migrations/20260930200000_workout_module/migration.sql`

**Interfaces:**
- Produces: models Prisma `exercises` (`slug`, `owner_user_id`, relação `owner`), `workout_routines` (`is_default`, `position`, `created_at`, relação `activities`), `routine_exercises` (`position`, `reps_min`, `reps_max`, `rest_sec`, relação `sets`), `routine_exercise_sets` (`set_number`, `weight_kg`), `workout_sets`, `activities.routine_id` (relação `routine`, `workout_sets`), `user_profiles.workout_plan_basis`; 71 linhas de catálogo em `exercises` com os slugs do `CATALOG` da Task 2; índice único parcial `activities_strength_user_start_key`.

- [ ] **Step 1: Editar `schema.prisma`**

No model `users`, depois de `workout_routines  workout_routines[]`, adicionar:

```prisma
  exercises         exercises[]
```

No model `user_profiles`, depois de `gender`:

```prisma
  // basis {fitness_level, goals, gender} da última geração/decisão do plano default; NULL = nunca gerado
  workout_plan_basis Json? @db.JsonB
```

No model `activities`, trocar o final do model por:

```prisma
  distance_m        Decimal?           @db.Decimal(10, 2)
  routine_id        String?            @db.Uuid

  user              users              @relation(fields: [user_id], references: [id], onDelete: Cascade)
  routine           workout_routines?  @relation(fields: [routine_id], references: [id], onDelete: SetNull)
  activity_gps_data activity_gps_data?
  workout_sets      workout_sets[]
  // + índice único parcial (user_id, start_time) WHERE activity_type = 'STRENGTH', só no SQL da migration
}
```

Substituir os models `workout_routines`, `exercises` e `routine_exercises` inteiros por (e adicionar os 2 novos):

```prisma
model workout_routines {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id           String              @db.Uuid
  name              String              @db.VarChar(100)
  is_default        Boolean             @default(false)
  position          Int
  created_at        DateTime?           @default(now()) @db.Timestamptz

  user              users               @relation(fields: [user_id], references: [id], onDelete: Cascade)
  routine_exercises routine_exercises[]
  activities        activities[]

  @@index([user_id])
}

// Catálogo global (slug, owner_user_id NULL) + exercícios próprios (owner_user_id, slug NULL).
// CHECKs de muscle_group e catálogo-ou-próprio ficam só no SQL da migration.
model exercises {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name              String              @db.VarChar(100)
  muscle_group      String              @db.VarChar(100)
  slug              String?             @unique @db.VarChar(80)
  owner_user_id     String?             @db.Uuid

  owner             users?              @relation(fields: [owner_user_id], references: [id], onDelete: Cascade)
  routine_exercises routine_exercises[]
  workout_sets      workout_sets[]

  @@index([owner_user_id])
}

model routine_exercises {
  id          String                  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  routine_id  String                  @db.Uuid
  exercise_id String                  @db.Uuid
  position    Int
  reps_min    Int
  reps_max    Int
  rest_sec    Int

  routine     workout_routines        @relation(fields: [routine_id], references: [id], onDelete: Cascade)
  exercise    exercises               @relation(fields: [exercise_id], references: [id], onDelete: Cascade)
  sets        routine_exercise_sets[]

  @@index([routine_id])
}

model routine_exercise_sets {
  id                  String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  routine_exercise_id String            @db.Uuid
  set_number          Int
  weight_kg           Decimal?          @db.Decimal(6, 2)

  routine_exercise    routine_exercises @relation(fields: [routine_exercise_id], references: [id], onDelete: Cascade)

  @@unique([routine_exercise_id, set_number])
}

// Séries de um treino finalizado (activities.activity_type = 'STRENGTH'). Só tempos; exercise_name é cópia.
model workout_sets {
  id              String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  activity_id     String     @db.Uuid
  exercise_id     String?    @db.Uuid
  exercise_name   String     @db.VarChar(100)
  position        Int
  set_number      Int
  duration_sec    Int
  rest_before_sec Int?

  activity        activities @relation(fields: [activity_id], references: [id], onDelete: Cascade)
  exercise        exercises? @relation(fields: [exercise_id], references: [id], onDelete: SetNull)

  @@index([activity_id])
}
```

Run: `cd BackEndTorv && npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid`.

- [ ] **Step 2: Criar a migration à mão**

Criar a pasta `BackEndTorv/prisma/migrations/20260930200000_workout_module/` com `migration.sql` exatamente assim (nomes de índice/FK iguais aos que o Prisma gera para o schema do Step 1; o resto — `DELETE` dos dados de teste confirmado pelo usuário, CHECKs, índice parcial, RLS e seed — o Prisma não modela):

```sql
-- Módulo de treinos (spec docs/superpowers/specs/2026-09-30-workout-module-design.md).
-- As linhas atuais das tabelas de treino são dados de teste (confirmado pelo usuário) e saem
-- antes das colunas NOT NULL novas.
DELETE FROM "routine_exercises";
DELETE FROM "workout_routines";
DELETE FROM "exercises";

-- exercises: catálogo global (slug, sem dono) + exercícios próprios (owner_user_id, sem slug).
ALTER TABLE "exercises"
  ADD COLUMN "slug" VARCHAR(80),
  ADD COLUMN "owner_user_id" UUID,
  ALTER COLUMN "muscle_group" SET NOT NULL,
  ADD CONSTRAINT "exercises_muscle_group_check" CHECK ("muscle_group" IN ('Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior de coxa', 'Glúteos', 'Panturrilha', 'Abdômen', 'Lombar', 'Antebraço')),
  ADD CONSTRAINT "exercises_catalog_or_owned_check" CHECK ("slug" IS NULL OR "owner_user_id" IS NULL);
CREATE UNIQUE INDEX "exercises_slug_key" ON "exercises"("slug");
CREATE INDEX "exercises_owner_user_id_idx" ON "exercises"("owner_user_id");
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- workout_routines
ALTER TABLE "workout_routines"
  DROP COLUMN "day_of_week",
  ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "position" INTEGER NOT NULL,
  ADD COLUMN "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "workout_routines_user_id_idx" ON "workout_routines"("user_id");

-- routine_exercises: séries viram linhas em routine_exercise_sets.
ALTER TABLE "routine_exercises"
  DROP COLUMN "sets",
  DROP COLUMN "reps",
  ADD COLUMN "position" INTEGER NOT NULL,
  ADD COLUMN "reps_min" INTEGER NOT NULL,
  ADD COLUMN "reps_max" INTEGER NOT NULL,
  ADD COLUMN "rest_sec" INTEGER NOT NULL,
  ADD CONSTRAINT "routine_exercises_reps_check" CHECK ("reps_min" BETWEEN 1 AND 100 AND "reps_max" BETWEEN 1 AND 100 AND "reps_min" <= "reps_max"),
  ADD CONSTRAINT "routine_exercises_rest_sec_check" CHECK ("rest_sec" BETWEEN 0 AND 600);
CREATE INDEX "routine_exercises_routine_id_idx" ON "routine_exercises"("routine_id");

CREATE TABLE "routine_exercise_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "routine_exercise_id" UUID NOT NULL,
    "set_number" INTEGER NOT NULL,
    "weight_kg" DECIMAL(6,2),

    CONSTRAINT "routine_exercise_sets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "routine_exercise_sets_set_number_check" CHECK ("set_number" BETWEEN 1 AND 10),
    CONSTRAINT "routine_exercise_sets_weight_kg_check" CHECK ("weight_kg" IS NULL OR "weight_kg" BETWEEN 0 AND 999.99)
);
CREATE UNIQUE INDEX "routine_exercise_sets_routine_exercise_id_set_number_key" ON "routine_exercise_sets"("routine_exercise_id", "set_number");
ALTER TABLE "routine_exercise_sets" ADD CONSTRAINT "routine_exercise_sets_routine_exercise_id_fkey" FOREIGN KEY ("routine_exercise_id") REFERENCES "routine_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NULL = plano default nunca gerado.
ALTER TABLE "user_profiles" ADD COLUMN "workout_plan_basis" JSONB;

ALTER TABLE "activities" ADD COLUMN "routine_id" UUID;
ALTER TABLE "activities" ADD CONSTRAINT "activities_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "workout_routines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Idempotência do POST /workouts/sessions (reenvio após falha de rede). Prisma 6 não modela índice parcial.
CREATE UNIQUE INDEX "activities_strength_user_start_key" ON "activities"("user_id", "start_time") WHERE "activity_type" = 'STRENGTH';

CREATE TABLE "workout_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "activity_id" UUID NOT NULL,
    "exercise_id" UUID,
    "exercise_name" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,
    "set_number" INTEGER NOT NULL,
    "duration_sec" INTEGER NOT NULL,
    "rest_before_sec" INTEGER,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workout_sets_duration_sec_check" CHECK ("duration_sec" BETWEEN 0 AND 3600),
    CONSTRAINT "workout_sets_rest_before_sec_check" CHECK ("rest_before_sec" IS NULL OR "rest_before_sec" BETWEEN 0 AND 7200)
);
CREATE INDEX "workout_sets_activity_id_idx" ON "workout_sets"("activity_id");
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: mesmo padrão de 20260925180000_lock_down_public_schema (tabela nova = ENABLE + policy do torv_api).
ALTER TABLE "routine_exercise_sets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "routine_exercise_sets" TO torv_api USING (true) WITH CHECK (true);
ALTER TABLE "workout_sets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "workout_sets" TO torv_api USING (true) WITH CHECK (true);

-- Catálogo (aba Exercicios de BackEndTorv/treino_padrao_referencia.xlsx). Tipo e nível mínimo
-- ficam só em src/lib/workoutGenerator.js (CATALOG, mesmo slug).
INSERT INTO "exercises" ("slug", "name", "muscle_group") VALUES
  ('supino-reto-com-barra', 'Supino reto com barra', 'Peito'),
  ('supino-inclinado-com-barra', 'Supino inclinado com barra', 'Peito'),
  ('supino-reto-com-halteres', 'Supino reto com halteres', 'Peito'),
  ('supino-inclinado-com-halteres', 'Supino inclinado com halteres', 'Peito'),
  ('chest-press-maquina', 'Chest press (máquina)', 'Peito'),
  ('flexao-de-bracos', 'Flexão de braços', 'Peito'),
  ('mergulho-nas-paralelas-foco-peito', 'Mergulho nas paralelas (foco peito)', 'Peito'),
  ('crossover-na-polia', 'Crossover na polia', 'Peito'),
  ('crucifixo-com-halteres', 'Crucifixo com halteres', 'Peito'),
  ('crucifixo-na-maquina-peck-deck', 'Crucifixo na máquina (peck deck)', 'Peito'),
  ('remada-curvada-com-barra', 'Remada curvada com barra', 'Costas'),
  ('barra-fixa-pull-up', 'Barra fixa (pull-up)', 'Costas'),
  ('puxada-frontal-na-polia', 'Puxada frontal na polia', 'Costas'),
  ('remada-baixa-na-polia-triangulo', 'Remada baixa na polia (triângulo)', 'Costas'),
  ('remada-unilateral-com-haltere-serrote', 'Remada unilateral com haltere (serrote)', 'Costas'),
  ('remada-na-maquina', 'Remada na máquina', 'Costas'),
  ('barra-fixa-assistida', 'Barra fixa assistida', 'Costas'),
  ('barra-fixa-com-carga', 'Barra fixa com carga', 'Costas'),
  ('pullover-na-polia-bracos-estendidos', 'Pullover na polia (braços estendidos)', 'Costas'),
  ('desenvolvimento-militar-com-barra', 'Desenvolvimento militar com barra', 'Ombros'),
  ('desenvolvimento-com-halteres', 'Desenvolvimento com halteres', 'Ombros'),
  ('desenvolvimento-na-maquina', 'Desenvolvimento na máquina', 'Ombros'),
  ('elevacao-lateral-com-halteres', 'Elevação lateral com halteres', 'Ombros'),
  ('crucifixo-inverso-na-maquina-deltoide-posterior', 'Crucifixo inverso na máquina (deltoide posterior)', 'Ombros'),
  ('elevacao-lateral-na-polia', 'Elevação lateral na polia', 'Ombros'),
  ('face-pull', 'Face pull', 'Ombros'),
  ('elevacao-frontal-com-halteres', 'Elevação frontal com halteres', 'Ombros'),
  ('rosca-direta-com-barra', 'Rosca direta com barra', 'Bíceps'),
  ('rosca-alternada-com-halteres', 'Rosca alternada com halteres', 'Bíceps'),
  ('rosca-martelo', 'Rosca martelo', 'Bíceps'),
  ('rosca-scott', 'Rosca Scott', 'Bíceps'),
  ('rosca-na-polia', 'Rosca na polia', 'Bíceps'),
  ('supino-fechado', 'Supino fechado', 'Tríceps'),
  ('triceps-banco-mergulho-no-banco', 'Tríceps banco (mergulho no banco)', 'Tríceps'),
  ('triceps-pulley-corda-ou-barra', 'Tríceps pulley (corda ou barra)', 'Tríceps'),
  ('triceps-testa', 'Tríceps testa', 'Tríceps'),
  ('triceps-frances-com-haltere', 'Tríceps francês com haltere', 'Tríceps'),
  ('agachamento-livre-com-barra', 'Agachamento livre com barra', 'Quadríceps'),
  ('agachamento-frontal', 'Agachamento frontal', 'Quadríceps'),
  ('hack-squat', 'Hack squat', 'Quadríceps'),
  ('agachamento-bulgaro', 'Agachamento búlgaro', 'Quadríceps'),
  ('leg-press-45', 'Leg press 45°', 'Quadríceps'),
  ('agachamento-goblet', 'Agachamento goblet', 'Quadríceps'),
  ('agachamento-no-smith', 'Agachamento no Smith', 'Quadríceps'),
  ('afundo-passada-com-halteres', 'Afundo / passada com halteres', 'Quadríceps'),
  ('cadeira-extensora', 'Cadeira extensora', 'Quadríceps'),
  ('stiff-com-barra', 'Stiff com barra', 'Posterior de coxa'),
  ('levantamento-terra-convencional', 'Levantamento terra convencional', 'Posterior de coxa'),
  ('levantamento-terra-com-barra-hexagonal', 'Levantamento terra com barra hexagonal', 'Posterior de coxa'),
  ('stiff-com-halteres', 'Stiff com halteres', 'Posterior de coxa'),
  ('mesa-flexora', 'Mesa flexora', 'Posterior de coxa'),
  ('cadeira-flexora', 'Cadeira flexora', 'Posterior de coxa'),
  ('elevacao-pelvica-hip-thrust-com-barra', 'Elevação pélvica (hip thrust) com barra', 'Glúteos'),
  ('ponte-de-gluteos-peso-do-corpo', 'Ponte de glúteos (peso do corpo)', 'Glúteos'),
  ('agachamento-sumo-com-halter', 'Agachamento sumô com halter', 'Glúteos'),
  ('gluteo-na-polia-coice', 'Glúteo na polia (coice)', 'Glúteos'),
  ('cadeira-abdutora', 'Cadeira abdutora', 'Glúteos'),
  ('extensao-de-quadril-na-maquina', 'Extensão de quadril na máquina', 'Glúteos'),
  ('panturrilha-em-pe-na-maquina', 'Panturrilha em pé na máquina', 'Panturrilha'),
  ('panturrilha-sentado', 'Panturrilha sentado', 'Panturrilha'),
  ('panturrilha-no-leg-press', 'Panturrilha no leg press', 'Panturrilha'),
  ('abdominal-na-polia-ajoelhado', 'Abdominal na polia (ajoelhado)', 'Abdômen'),
  ('elevacao-de-pernas-na-barra-fixa', 'Elevação de pernas na barra fixa', 'Abdômen'),
  ('roda-abdominal', 'Roda abdominal', 'Abdômen'),
  ('abdominal-crunch-solo', 'Abdominal crunch (solo)', 'Abdômen'),
  ('prancha', 'Prancha', 'Abdômen'),
  ('elevacao-de-pernas-deitado', 'Elevação de pernas deitado', 'Abdômen'),
  ('extensao-lombar-banco-45', 'Extensão lombar (banco 45°)', 'Lombar'),
  ('superman-extensao-no-solo', 'Superman (extensão no solo)', 'Lombar'),
  ('rosca-de-punho', 'Rosca de punho', 'Antebraço'),
  ('rosca-inversa', 'Rosca inversa', 'Antebraço');
```

- [ ] **Step 3: Aplicar e gerar o client**

Run: `cd BackEndTorv && npx prisma migrate deploy && npx prisma generate`
Expected: `Applying migration 20260930200000_workout_module` / `All migrations have been successfully applied` / `Generated Prisma Client`. Se o `generate` falhar por DLL travada no Windows (Furnace rodando), pedir ao Maestro pra parar o Furnace, gerar e religar. Se a criação do índice parcial falhar por duplicata `(user_id, start_time)` em `activities` STRENGTH já existente, parar e avisar o Maestro (não apagar dados por conta própria).

- [ ] **Step 4: Conferir**

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

Run: `node -e 'require("dotenv").config(); const p = new (require("@prisma/client").PrismaClient)(); p.exercises.count({ where: { owner_user_id: null } }).then((c) => { console.log(c); return p.$disconnect(); })'`
Expected: `71`

Run: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`
Expected: nada sobre as colunas/tabelas desta migration. Só pode aparecer `DROP INDEX` de índices que o schema não modela (`activities_strength_user_start_key` e os `ix_*` antigos). Não aplicar esse diff.

- [ ] **Step 5: Commit**

```bash
git add -- BackEndTorv/prisma/schema.prisma BackEndTorv/prisma/migrations/20260930200000_workout_module
git commit -m "feat(db): workout module schema, catalog seed and session tables" -- BackEndTorv/prisma/schema.prisma BackEndTorv/prisma/migrations/20260930200000_workout_module
```

---

### Task 2: Gerador `workoutGenerator`

**Owner:** Torv Backend (Anvil) — depois da Task 1 commitada (o último teste lê o seed da migration).

**Files:**
- Create: `BackEndTorv/src/lib/workoutGenerator.js`
- Test: `BackEndTorv/src/lib/workoutGenerator.test.js`

**Interfaces:**
- Produces:
  - `generatePlan({ gender, fitnessLevel, goals }) → { basis: Basis, routines: [{ name: string, position: number, exercises: [{ slug: string, position: number, reps_min: number, reps_max: number, rest_sec: number, set_count: number }] }] }`
  - `buildBasis({ gender, fitnessLevel, goals }) → Basis`, `Basis = { fitness_level: string, goals: string[] (ordenado), gender: 'M' | 'F' | 'N' }`
  - `diffPlanBasis(saved: Basis | null, current: Basis) → Array<'fitness_level' | 'goals' | 'gender'>`
  - `goals` aceita a string do banco (`"Perder Peso, Criar uma Rotina"`) ou array.

- [ ] **Step 1: Escrever os testes**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generatePlan, buildBasis, diffPlanBasis, CATALOG, SLOTS } = require('./workoutGenerator');

const slugs = (plan) => plan.routines.map((r) => r.exercises.map((e) => e.slug));
const minLevelOf = Object.fromEntries(CATALOG.map((e) => [e.slug, e.minLevel]));

// Aba Gerador da planilha (exemplo Masculino, Avançado, Ganhar Massa Muscular).
const GERADOR_M_AVANCADO = [
  ['supino-reto-com-barra', 'supino-inclinado-com-barra', 'desenvolvimento-militar-com-barra', 'crossover-na-polia', 'elevacao-lateral-com-halteres', 'supino-fechado', 'triceps-pulley-corda-ou-barra'],
  ['remada-curvada-com-barra', 'barra-fixa-pull-up', 'puxada-frontal-na-polia', 'pullover-na-polia-bracos-estendidos', 'crucifixo-inverso-na-maquina-deltoide-posterior', 'rosca-direta-com-barra', 'rosca-alternada-com-halteres', 'rosca-de-punho'],
  ['agachamento-livre-com-barra', 'agachamento-frontal', 'cadeira-extensora', 'stiff-com-barra', 'mesa-flexora', 'elevacao-pelvica-hip-thrust-com-barra', 'gluteo-na-polia-coice', 'panturrilha-em-pe-na-maquina', 'panturrilha-sentado'],
  ['supino-reto-com-halteres', 'remada-baixa-na-polia-triangulo', 'desenvolvimento-com-halteres', 'rosca-martelo', 'triceps-testa', 'abdominal-na-polia-ajoelhado', 'crucifixo-com-halteres'],
  ['hack-squat', 'levantamento-terra-convencional', 'ponte-de-gluteos-peso-do-corpo', 'cadeira-flexora', 'cadeira-abdutora', 'elevacao-de-pernas-na-barra-fixa', 'extensao-lombar-banco-45', 'panturrilha-no-leg-press'],
];

test('Masculino, AVANÇADO, Ganhar Massa = aba Gerador da planilha', () => {
  const plan = generatePlan({ gender: 'Masculino', fitnessLevel: 'AVANÇADO', goals: 'Ganhar Massa Muscular' });
  assert.deepEqual(plan.routines.map((r) => r.name), [
    'Dia 1 — Empurrar (Push)', 'Dia 2 — Puxar (Pull)', 'Dia 3 — Pernas', 'Dia 4 — Superior', 'Dia 5 — Inferior + Core',
  ]);
  assert.deepEqual(plan.routines.map((r) => r.position), [1, 2, 3, 4, 5]);
  assert.deepEqual(slugs(plan), GERADOR_M_AVANCADO);
  for (const r of plan.routines) {
    assert.deepEqual(r.exercises.map((e) => e.position), r.exercises.map((_, i) => i + 1));
    for (const e of r.exercises) {
      assert.equal(e.set_count, 4);
      assert.equal(e.reps_min, 6);
      assert.equal(e.reps_max, 12);
    }
  }
  assert.equal(plan.routines[0].exercises[0].rest_sec, 120); // supino reto: composto
  assert.equal(plan.routines[0].exercises[3].rest_sec, 60); // crossover: isolado
});

test('Feminino no mesmo nível muda só os slots de sexo', () => {
  const f = slugs(generatePlan({ gender: 'Feminino', fitnessLevel: 'AVANÇADO', goals: 'Ganhar Massa Muscular' }));
  const expected = GERADOR_M_AVANCADO.map((day) => [...day]);
  expected[3][6] = 'elevacao-lateral-na-polia';
  expected[4][7] = 'extensao-de-quadril-na-maquina';
  assert.deepEqual(f, expected);
});

test('INICIANTE: 3 rotinas, 3 séries, só exercícios de nível Iniciante', () => {
  const plan = generatePlan({ gender: 'Feminino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso' });
  assert.equal(plan.routines.length, 3);
  for (const r of plan.routines) {
    for (const e of r.exercises) {
      assert.equal(e.set_count, 3);
      assert.equal(e.reps_min, 8);
      assert.equal(e.reps_max, 15);
      assert.equal(minLevelOf[e.slug], 0, e.slug);
    }
  }
});

test('Criar uma Rotina limita AVANÇADO ao plano de Iniciante', () => {
  const capped = generatePlan({ gender: 'Masculino', fitnessLevel: 'AVANÇADO', goals: 'Criar uma Rotina' });
  const beginner = generatePlan({ gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: 'Criar uma Rotina' });
  assert.deepEqual(capped.routines, beginner.routines);
  assert.equal(capped.routines.length, 3);
  const first = capped.routines[0].exercises;
  assert.deepEqual([first[0].reps_min, first[0].reps_max, first[0].rest_sec], [10, 15, 75]); // leg press: composto
  assert.equal(first.find((e) => e.slug === 'abdominal-crunch-solo').rest_sec, 60);
  assert.equal(capped.basis.fitness_level, 'AVANÇADO'); // basis guarda o perfil, não o nível efetivo
});

test('fallbacks: gênero nulo → N, objetivos vazios → Saúde & Bem-estar, nível desconhecido → INICIANTE', () => {
  assert.deepEqual(buildBasis({ gender: null, fitnessLevel: 'PRO', goals: '' }), {
    fitness_level: 'INICIANTE', goals: ['Saúde & Bem-estar'], gender: 'N',
  });
  assert.deepEqual(buildBasis({ gender: 'Feminino', fitnessLevel: 'INTERMEDIÁRIO', goals: ['Voar', 'Perder Peso'] }).goals, ['Perder Peso']);
  const plan = generatePlan({ gender: undefined, fitnessLevel: undefined, goals: undefined });
  assert.equal(plan.routines.length, 3);
  assert.ok(plan.routines.flatMap((r) => r.exercises).some((e) => e.slug === 'rosca-direta-com-barra')); // slot N (bíceps)
});

test('ordem dos objetivos não muda o basis; principal = menor prioridade', () => {
  const a = generatePlan({ gender: 'Masculino', fitnessLevel: 'INTERMEDIÁRIO', goals: 'Perder Peso, Ganhar Massa Muscular' });
  const b = generatePlan({ gender: 'Masculino', fitnessLevel: 'INTERMEDIÁRIO', goals: 'Ganhar Massa Muscular, Perder Peso' });
  assert.deepEqual(a, b);
  assert.deepEqual(a.basis.goals, ['Ganhar Massa Muscular', 'Perder Peso']);
  assert.equal(a.routines[0].exercises[0].reps_min, 6); // Ganhar Massa (prioridade 1)
});

test('diffPlanBasis lista só os campos que mudaram', () => {
  const saved = buildBasis({ gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso' });
  assert.deepEqual(diffPlanBasis(saved, buildBasis({ gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: ['Perder Peso'] })), []);
  assert.deepEqual(diffPlanBasis(saved, buildBasis({ gender: 'Masculino', fitnessLevel: 'AVANÇADO', goals: 'Perder Peso' })), ['fitness_level']);
  assert.deepEqual(diffPlanBasis(saved, buildBasis({ gender: 'Feminino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso, Criar uma Rotina' })), ['goals', 'gender']);
});

test('catálogo: 71 slugs únicos e todo grupo+tipo de slot tem exercício', () => {
  assert.equal(CATALOG.length, 71);
  assert.equal(new Set(CATALOG.map((e) => e.slug)).size, 71);
  const keys = new Set(CATALOG.map((e) => `${e.group}|${e.type}`));
  for (const s of SLOTS) assert.ok(keys.has(`${s.group}|${s.type}`), `${s.group}|${s.type}`);
});

test('seed da migration tem exatamente os slugs do CATALOG', () => {
  const dir = path.join(__dirname, '../../prisma/migrations');
  const folder = fs.readdirSync(dir).find((d) => d.endsWith('_workout_module'));
  const sql = fs.readFileSync(path.join(dir, folder, 'migration.sql'), 'utf8');
  const seeded = [...sql.matchAll(/\('([a-z0-9-]+)', '/g)].map((m) => m[1]);
  assert.deepEqual(seeded, CATALOG.map((e) => e.slug));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/lib/workoutGenerator.test.js`
Expected: FAIL com `Cannot find module './workoutGenerator'`.

- [ ] **Step 3: Implementar**

```js
// Espelho de BackEndTorv/treino_padrao_referencia.xlsx (abas Niveis, Objetivos, Sessoes, Exercicios, Algoritmo).
// Mudou a planilha? Atualize as tabelas daqui e os testes.

const LEVEL_NAMES = ['INICIANTE', 'INTERMEDIÁRIO', 'AVANÇADO']; // índice = rank
const I = 0; // Iniciante
const M = 1; // Intermediário
const A = 2; // Avançado
const DEFAULT_LEVEL = 'INICIANTE';
const DEFAULT_GOAL = 'Saúde & Bem-estar';

// Aba Niveis: frequência semanal (dias) e séries por exercício, por rank.
const LEVELS = [
  { days: 3, sets: 3 },
  { days: 4, sets: 3 },
  { days: 5, sets: 4 },
];

// Aba Objetivos. rest: descanso em segundos por tipo (C = composto, I = isolado).
const GOALS = {
  'Ganhar Massa Muscular': { priority: 1, reps: [6, 12], rest: { C: 120, I: 60 }, maxDays: 7, maxLevel: A },
  'Perder Peso': { priority: 2, reps: [8, 15], rest: { C: 60, I: 45 }, maxDays: 7, maxLevel: A },
  'Aumentar Resistência': { priority: 3, reps: [15, 25], rest: { C: 45, I: 30 }, maxDays: 7, maxLevel: A },
  'Melhorar Condicionamento': { priority: 4, reps: [12, 20], rest: { C: 45, I: 30 }, maxDays: 7, maxLevel: A },
  'Criar uma Rotina': { priority: 5, reps: [10, 15], rest: { C: 75, I: 60 }, maxDays: 3, maxLevel: I },
  'Saúde & Bem-estar': { priority: 6, reps: [10, 15], rest: { C: 75, I: 60 }, maxDays: 3, maxLevel: M },
};

// Aba Exercicios: [slug, grupo, tipo, nível mínimo]. A ordem dentro de grupo+tipo é a preferência do algoritmo.
// Nome e grupo também estão no seed da migration (mesmo slug); o tipo e o nível mínimo só existem aqui.
const CATALOG = [
  ['supino-reto-com-barra', 'Peito', 'C', M],
  ['supino-inclinado-com-barra', 'Peito', 'C', M],
  ['supino-reto-com-halteres', 'Peito', 'C', I],
  ['supino-inclinado-com-halteres', 'Peito', 'C', I],
  ['chest-press-maquina', 'Peito', 'C', I],
  ['flexao-de-bracos', 'Peito', 'C', I],
  ['mergulho-nas-paralelas-foco-peito', 'Peito', 'C', M],
  ['crossover-na-polia', 'Peito', 'I', M],
  ['crucifixo-com-halteres', 'Peito', 'I', M],
  ['crucifixo-na-maquina-peck-deck', 'Peito', 'I', I],
  ['remada-curvada-com-barra', 'Costas', 'C', M],
  ['barra-fixa-pull-up', 'Costas', 'C', M],
  ['puxada-frontal-na-polia', 'Costas', 'C', I],
  ['remada-baixa-na-polia-triangulo', 'Costas', 'C', I],
  ['remada-unilateral-com-haltere-serrote', 'Costas', 'C', I],
  ['remada-na-maquina', 'Costas', 'C', I],
  ['barra-fixa-assistida', 'Costas', 'C', I],
  ['barra-fixa-com-carga', 'Costas', 'C', A],
  ['pullover-na-polia-bracos-estendidos', 'Costas', 'I', M],
  ['desenvolvimento-militar-com-barra', 'Ombros', 'C', M],
  ['desenvolvimento-com-halteres', 'Ombros', 'C', I],
  ['desenvolvimento-na-maquina', 'Ombros', 'C', I],
  ['elevacao-lateral-com-halteres', 'Ombros', 'I', I],
  ['crucifixo-inverso-na-maquina-deltoide-posterior', 'Ombros', 'I', I],
  ['elevacao-lateral-na-polia', 'Ombros', 'I', M],
  ['face-pull', 'Ombros', 'I', M],
  ['elevacao-frontal-com-halteres', 'Ombros', 'I', I],
  ['rosca-direta-com-barra', 'Bíceps', 'I', I],
  ['rosca-alternada-com-halteres', 'Bíceps', 'I', I],
  ['rosca-martelo', 'Bíceps', 'I', I],
  ['rosca-scott', 'Bíceps', 'I', M],
  ['rosca-na-polia', 'Bíceps', 'I', M],
  ['supino-fechado', 'Tríceps', 'C', M],
  ['triceps-banco-mergulho-no-banco', 'Tríceps', 'C', M],
  ['triceps-pulley-corda-ou-barra', 'Tríceps', 'I', I],
  ['triceps-testa', 'Tríceps', 'I', M],
  ['triceps-frances-com-haltere', 'Tríceps', 'I', M],
  ['agachamento-livre-com-barra', 'Quadríceps', 'C', M],
  ['agachamento-frontal', 'Quadríceps', 'C', A],
  ['hack-squat', 'Quadríceps', 'C', M],
  ['agachamento-bulgaro', 'Quadríceps', 'C', M],
  ['leg-press-45', 'Quadríceps', 'C', I],
  ['agachamento-goblet', 'Quadríceps', 'C', I],
  ['agachamento-no-smith', 'Quadríceps', 'C', I],
  ['afundo-passada-com-halteres', 'Quadríceps', 'C', I],
  ['cadeira-extensora', 'Quadríceps', 'I', I],
  ['stiff-com-barra', 'Posterior de coxa', 'C', M],
  ['levantamento-terra-convencional', 'Posterior de coxa', 'C', A],
  ['levantamento-terra-com-barra-hexagonal', 'Posterior de coxa', 'C', M],
  ['stiff-com-halteres', 'Posterior de coxa', 'C', I],
  ['mesa-flexora', 'Posterior de coxa', 'I', I],
  ['cadeira-flexora', 'Posterior de coxa', 'I', I],
  ['elevacao-pelvica-hip-thrust-com-barra', 'Glúteos', 'C', M],
  ['ponte-de-gluteos-peso-do-corpo', 'Glúteos', 'C', I],
  ['agachamento-sumo-com-halter', 'Glúteos', 'C', I],
  ['gluteo-na-polia-coice', 'Glúteos', 'I', I],
  ['cadeira-abdutora', 'Glúteos', 'I', I],
  ['extensao-de-quadril-na-maquina', 'Glúteos', 'I', I],
  ['panturrilha-em-pe-na-maquina', 'Panturrilha', 'I', I],
  ['panturrilha-sentado', 'Panturrilha', 'I', I],
  ['panturrilha-no-leg-press', 'Panturrilha', 'I', I],
  ['abdominal-na-polia-ajoelhado', 'Abdômen', 'I', M],
  ['elevacao-de-pernas-na-barra-fixa', 'Abdômen', 'I', M],
  ['roda-abdominal', 'Abdômen', 'I', A],
  ['abdominal-crunch-solo', 'Abdômen', 'I', I],
  ['prancha', 'Abdômen', 'I', I],
  ['elevacao-de-pernas-deitado', 'Abdômen', 'I', I],
  ['extensao-lombar-banco-45', 'Lombar', 'I', I],
  ['superman-extensao-no-solo', 'Lombar', 'I', I],
  ['rosca-de-punho', 'Antebraço', 'I', I],
  ['rosca-inversa', 'Antebraço', 'I', I],
].map(([slug, group, type, minLevel]) => ({ slug, group, type, minLevel }));

// Aba Sessoes: [dias/semana, dia, sessão, grupo, tipo, nível mínimo, sexo ('Todos' | 'M' | 'F' | 'N')].
const SLOTS = [
  [3, 1, 'Corpo todo A', 'Quadríceps', 'C', I, 'Todos'],
  [3, 1, 'Corpo todo A', 'Peito', 'C', I, 'Todos'],
  [3, 1, 'Corpo todo A', 'Costas', 'C', I, 'Todos'],
  [3, 1, 'Corpo todo A', 'Ombros', 'C', I, 'Todos'],
  [3, 1, 'Corpo todo A', 'Peito', 'I', M, 'Todos'],
  [3, 1, 'Corpo todo A', 'Ombros', 'I', M, 'Todos'],
  [3, 1, 'Corpo todo A', 'Peito', 'I', I, 'M'],
  [3, 1, 'Corpo todo A', 'Ombros', 'I', I, 'F'],
  [3, 1, 'Corpo todo A', 'Bíceps', 'I', I, 'N'],
  [3, 1, 'Corpo todo A', 'Abdômen', 'I', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Posterior de coxa', 'C', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Glúteos', 'C', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Costas', 'C', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Costas', 'C', M, 'Todos'],
  [3, 2, 'Corpo todo B', 'Peito', 'C', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Quadríceps', 'I', M, 'Todos'],
  [3, 2, 'Corpo todo B', 'Tríceps', 'I', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Panturrilha', 'I', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Quadríceps', 'C', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Ombros', 'C', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Posterior de coxa', 'I', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Glúteos', 'C', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Posterior de coxa', 'C', M, 'Todos'],
  [3, 3, 'Corpo todo C', 'Glúteos', 'I', M, 'Todos'],
  [3, 3, 'Corpo todo C', 'Panturrilha', 'I', I, 'M'],
  [3, 3, 'Corpo todo C', 'Glúteos', 'I', I, 'F'],
  [3, 3, 'Corpo todo C', 'Abdômen', 'I', I, 'N'],
  [3, 3, 'Corpo todo C', 'Bíceps', 'I', I, 'Todos'],
  [4, 1, 'Superior A', 'Peito', 'C', M, 'Todos'],
  [4, 1, 'Superior A', 'Costas', 'C', M, 'Todos'],
  [4, 1, 'Superior A', 'Ombros', 'C', M, 'Todos'],
  [4, 1, 'Superior A', 'Peito', 'I', M, 'Todos'],
  [4, 1, 'Superior A', 'Costas', 'C', M, 'Todos'],
  [4, 1, 'Superior A', 'Bíceps', 'I', M, 'Todos'],
  [4, 1, 'Superior A', 'Tríceps', 'I', M, 'Todos'],
  [4, 2, 'Inferior A', 'Quadríceps', 'C', M, 'Todos'],
  [4, 2, 'Inferior A', 'Posterior de coxa', 'C', M, 'Todos'],
  [4, 2, 'Inferior A', 'Glúteos', 'C', M, 'Todos'],
  [4, 2, 'Inferior A', 'Quadríceps', 'I', M, 'Todos'],
  [4, 2, 'Inferior A', 'Panturrilha', 'I', M, 'Todos'],
  [4, 2, 'Inferior A', 'Abdômen', 'I', M, 'Todos'],
  [4, 3, 'Superior B', 'Costas', 'C', M, 'Todos'],
  [4, 3, 'Superior B', 'Peito', 'C', M, 'Todos'],
  [4, 3, 'Superior B', 'Ombros', 'I', M, 'Todos'],
  [4, 3, 'Superior B', 'Ombros', 'I', M, 'Todos'],
  [4, 3, 'Superior B', 'Bíceps', 'I', M, 'Todos'],
  [4, 3, 'Superior B', 'Peito', 'I', M, 'M'],
  [4, 3, 'Superior B', 'Ombros', 'I', M, 'F'],
  [4, 3, 'Superior B', 'Tríceps', 'I', M, 'N'],
  [4, 4, 'Inferior B', 'Quadríceps', 'C', M, 'Todos'],
  [4, 4, 'Inferior B', 'Posterior de coxa', 'C', M, 'Todos'],
  [4, 4, 'Inferior B', 'Glúteos', 'C', M, 'Todos'],
  [4, 4, 'Inferior B', 'Posterior de coxa', 'I', M, 'Todos'],
  [4, 4, 'Inferior B', 'Glúteos', 'I', M, 'Todos'],
  [4, 4, 'Inferior B', 'Panturrilha', 'I', M, 'Todos'],
  [4, 4, 'Inferior B', 'Panturrilha', 'I', M, 'M'],
  [4, 4, 'Inferior B', 'Glúteos', 'I', M, 'F'],
  [4, 4, 'Inferior B', 'Abdômen', 'I', M, 'N'],
  [5, 1, 'Empurrar (Push)', 'Peito', 'C', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Peito', 'C', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Ombros', 'C', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Peito', 'I', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Ombros', 'I', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Tríceps', 'C', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Tríceps', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Costas', 'C', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Costas', 'C', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Costas', 'C', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Costas', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Ombros', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Bíceps', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Bíceps', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Antebraço', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Quadríceps', 'C', A, 'Todos'],
  [5, 3, 'Pernas', 'Quadríceps', 'C', A, 'Todos'],
  [5, 3, 'Pernas', 'Quadríceps', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Posterior de coxa', 'C', A, 'Todos'],
  [5, 3, 'Pernas', 'Posterior de coxa', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Glúteos', 'C', A, 'Todos'],
  [5, 3, 'Pernas', 'Glúteos', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Panturrilha', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Panturrilha', 'I', A, 'Todos'],
  [5, 4, 'Superior', 'Peito', 'C', A, 'Todos'],
  [5, 4, 'Superior', 'Costas', 'C', A, 'Todos'],
  [5, 4, 'Superior', 'Ombros', 'C', A, 'Todos'],
  [5, 4, 'Superior', 'Bíceps', 'I', A, 'Todos'],
  [5, 4, 'Superior', 'Tríceps', 'I', A, 'Todos'],
  [5, 4, 'Superior', 'Abdômen', 'I', A, 'Todos'],
  [5, 4, 'Superior', 'Peito', 'I', A, 'M'],
  [5, 4, 'Superior', 'Ombros', 'I', A, 'F'],
  [5, 4, 'Superior', 'Antebraço', 'I', A, 'N'],
  [5, 5, 'Inferior + Core', 'Quadríceps', 'C', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Posterior de coxa', 'C', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Glúteos', 'C', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Posterior de coxa', 'I', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Glúteos', 'I', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Abdômen', 'I', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Lombar', 'I', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Panturrilha', 'I', A, 'M'],
  [5, 5, 'Inferior + Core', 'Glúteos', 'I', A, 'F'],
  [5, 5, 'Inferior + Core', 'Abdômen', 'I', A, 'N'],
].map(([days, day, session, group, type, minLevel, sex]) => ({ days, day, session, group, type, minLevel, sex }));

function normalizeGoals(goals) {
  const list = Array.isArray(goals) ? goals : String(goals ?? '').split(',');
  const valid = [...new Set(list.map((g) => String(g).trim()).filter((g) => Object.hasOwn(GOALS, g)))];
  return valid.length ? valid.sort() : [DEFAULT_GOAL];
}

// Dados do perfil que definem o plano, já normalizados. goals ordenado: a ordem de seleção não gera sugestão falsa.
function buildBasis({ gender, fitnessLevel, goals }) {
  return {
    fitness_level: LEVEL_NAMES.includes(fitnessLevel) ? fitnessLevel : DEFAULT_LEVEL,
    goals: normalizeGoals(goals),
    gender: gender === 'Masculino' ? 'M' : gender === 'Feminino' ? 'F' : 'N',
  };
}

// Campos do basis que mudaram (fitness_level, goals, gender).
function diffPlanBasis(saved, current) {
  return Object.keys(current).filter((k) => JSON.stringify(saved?.[k]) !== JSON.stringify(current[k]));
}

// Aba Algoritmo, passos 1–9.
function generatePlan(input) {
  const basis = buildBasis(input);
  const main = basis.goals.map((g) => GOALS[g]).reduce((a, b) => (b.priority < a.priority ? b : a));
  const level = Math.min(LEVEL_NAMES.indexOf(basis.fitness_level), main.maxLevel);
  const days = Math.min(LEVELS[level].days, main.maxDays);

  const eligible = {};
  for (const ex of CATALOG) {
    if (ex.minLevel <= level) (eligible[`${ex.group}|${ex.type}`] ??= []).push(ex);
  }

  const used = {};
  const routines = new Map();
  for (const slot of SLOTS) {
    if (slot.days !== days || slot.minLevel > level) continue;
    if (slot.sex !== 'Todos' && slot.sex !== basis.gender) continue;
    const key = `${slot.group}|${slot.type}`;
    used[key] = (used[key] ?? 0) + 1;
    const ex = eligible[key]?.[used[key] - 1];
    if (!ex) continue; // acabaram as opções desse grupo+tipo no nível: descarta o slot

    if (!routines.has(slot.day)) {
      routines.set(slot.day, { name: `Dia ${slot.day} — ${slot.session}`, position: slot.day, exercises: [] });
    }
    const routine = routines.get(slot.day);
    routine.exercises.push({
      slug: ex.slug,
      position: routine.exercises.length + 1,
      reps_min: main.reps[0],
      reps_max: main.reps[1],
      rest_sec: main.rest[ex.type],
      set_count: LEVELS[level].sets,
    });
  }
  return { basis, routines: [...routines.values()] };
}

module.exports = { generatePlan, buildBasis, diffPlanBasis, CATALOG, SLOTS, GOALS, LEVEL_NAMES };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/lib/workoutGenerator.test.js`
Expected: `pass 9`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add -- BackEndTorv/src/lib/workoutGenerator.js BackEndTorv/src/lib/workoutGenerator.test.js
git commit -m "feat(workouts): default plan generator from reference spreadsheet" -- BackEndTorv/src/lib/workoutGenerator.js BackEndTorv/src/lib/workoutGenerator.test.js
```

---

### Task 3: Validação e regra do plano

**Owner:** Torv Backend (Anvil) — pode rodar junto da Task 2 (os testes de `workoutPlan` só precisam do gerador no disco; se a Task 2 ainda não estiver commitada, fazer a Task 2 antes).

**Files:**
- Create: `BackEndTorv/src/lib/workoutValidation.js`, `BackEndTorv/src/lib/workoutPlan.js`
- Test: `BackEndTorv/src/lib/workoutValidation.test.js`, `BackEndTorv/src/lib/workoutPlan.test.js`
- Create (stub mínimo para os mocks; a Task 4 completa): `BackEndTorv/src/repository/workout.repository.js`

**Interfaces:**
- Consumes: `generatePlan`, `buildBasis`, `diffPlanBasis` (Task 2).
- Produces:
  - `checkRoutineBody(body) → string | null`, `checkExerciseBody(body) → string | null`, `checkSessionBody(body, now = Date.now()) → string | null` (esta é usada na entrega 2).
  - `ensureDefaultPlan(userId) → Promise<PlanInputs | null>`, `planSuggestion(inputs) → { has_suggestion: boolean, changed: string[] }`, `acceptPlan(userId)`, `dismissPlan(userId)`, `nextRoutineId(routines: {id}[], lastRoutineId: string | null) → string | null`.
  - `PlanInputs = { gender, fitnessLevel, goals, savedBasis: Basis | null }` (vem de `workoutRepository.getPlanInputs`).
  - Métodos do repository que `workoutPlan` usa (implementados na Task 4): `getPlanInputs(userId)`, `savePlan(userId, basis, routines, mode: 'create' | 'replace') → Promise<boolean>`, `setPlanBasis(userId, basis)`.

- [ ] **Step 1: Stub do repository** (só pra `require` e `t.mock.method` funcionarem; a Task 4 substitui o arquivo inteiro)

```js
// Substituído pela implementação completa na Task 4.
class WorkoutRepository {
  async getPlanInputs() { throw new Error('not implemented'); }
  async savePlan() { throw new Error('not implemented'); }
  async setPlanBasis() { throw new Error('not implemented'); }
}

module.exports = new WorkoutRepository();
```

- [ ] **Step 2: Escrever os testes**

`BackEndTorv/src/lib/workoutValidation.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkRoutineBody, checkExerciseBody, checkSessionBody } = require('./workoutValidation');

const exercise = (over = {}) => ({ exercise_id: 'x', reps_min: 8, reps_max: 12, rest_sec: 60, sets: [{ weight_kg: null }], ...over });

test('checkRoutineBody: nome em branco e reps_min > reps_max', () => {
  assert.equal(checkRoutineBody({ name: 'Peito', exercises: [exercise()] }), null);
  assert.equal(checkRoutineBody({ name: '   ', exercises: [exercise()] }), 'name must not be blank');
  assert.equal(checkRoutineBody({ name: 'A', exercises: [exercise(), exercise({ reps_min: 13 })] }), 'exercises[1]: reps_min must be <= reps_max');
  assert.equal(checkRoutineBody({ name: 'A', exercises: [exercise({ reps_min: 12, reps_max: 12 })] }), null);
});

test('checkExerciseBody: nome em branco', () => {
  assert.equal(checkExerciseBody({ name: 'Remada', muscle_group: 'Costas' }), null);
  assert.equal(checkExerciseBody({ name: ' \t ', muscle_group: 'Costas' }), 'name must not be blank');
});

test('checkSessionBody: started_at entre 2026-01-01 e agora + 5 min', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  assert.equal(checkSessionBody({ started_at: '2026-09-30T11:00:00Z' }, now), null);
  assert.equal(checkSessionBody({ started_at: '2026-01-01T00:00:00Z' }, now), null);
  assert.equal(checkSessionBody({ started_at: '2025-12-31T23:59:59Z' }, now), 'started_at must be on or after 2026-01-01');
  assert.equal(checkSessionBody({ started_at: '2026-09-30T12:05:00Z' }, now), null);
  assert.equal(checkSessionBody({ started_at: '2026-09-30T12:05:01Z' }, now), 'started_at must not be in the future');
  assert.equal(checkSessionBody({ started_at: 'lixo' }, now), 'started_at must be on or after 2026-01-01');
});
```

`BackEndTorv/src/lib/workoutPlan.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const workoutRepository = require('../repository/workout.repository');
const { ensureDefaultPlan, planSuggestion, acceptPlan, dismissPlan, nextRoutineId } = require('./workoutPlan');

const profile = { gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso' };
const basis = { fitness_level: 'INICIANTE', goals: ['Perder Peso'], gender: 'M' };

test('ensureDefaultPlan: basis NULL → gera e salva em modo create', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...profile, savedBasis: null }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  const inputs = await ensureDefaultPlan('u1');
  assert.equal(save.mock.callCount(), 1);
  const [userId, savedBasis, routines, mode] = save.mock.calls[0].arguments;
  assert.equal(userId, 'u1');
  assert.deepEqual(savedBasis, basis);
  assert.equal(routines.length, 3);
  assert.equal(mode, 'create');
  assert.deepEqual(inputs.savedBasis, basis);
});

test('ensureDefaultPlan: plano já gerado → não salva nada', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...profile, savedBasis: basis }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  await ensureDefaultPlan('u1');
  assert.equal(save.mock.callCount(), 0);
});

test('ensureDefaultPlan: sem perfil → null, sem salvar', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => null);
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  assert.equal(await ensureDefaultPlan('u1'), null);
  assert.equal(save.mock.callCount(), 0);
});

test('planSuggestion: compara basis salvo com o perfil atual', () => {
  assert.deepEqual(planSuggestion(null), { has_suggestion: false, changed: [] });
  assert.deepEqual(planSuggestion({ ...profile, savedBasis: basis }), { has_suggestion: false, changed: [] });
  assert.deepEqual(planSuggestion({ ...profile, fitnessLevel: 'AVANÇADO', savedBasis: basis }), { has_suggestion: true, changed: ['fitness_level'] });
});

test('acceptPlan salva em modo replace; dismissPlan grava só o basis', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...profile, fitnessLevel: 'AVANÇADO', savedBasis: basis }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  const setBasis = t.mock.method(workoutRepository, 'setPlanBasis', async () => {});
  await acceptPlan('u1');
  assert.equal(save.mock.calls[0].arguments[3], 'replace');
  assert.equal(save.mock.calls[0].arguments[1].fitness_level, 'AVANÇADO');
  await dismissPlan('u1');
  assert.deepEqual(setBasis.mock.calls[0].arguments, ['u1', { ...basis, fitness_level: 'AVANÇADO' }]);
});

test('nextRoutineId: seguinte ao último treino, com volta ao início', () => {
  const routines = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(nextRoutineId(routines, null), 'a');
  assert.equal(nextRoutineId(routines, 'a'), 'b');
  assert.equal(nextRoutineId(routines, 'c'), 'a');
  assert.equal(nextRoutineId(routines, 'apagada'), 'a');
  assert.equal(nextRoutineId([], 'a'), null);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/lib/workoutValidation.test.js src/lib/workoutPlan.test.js`
Expected: FAIL com `Cannot find module './workoutValidation'` / `'./workoutPlan'`.

- [ ] **Step 4: Implementar**

`BackEndTorv/src/lib/workoutValidation.js`:

```js
// Regras que o schema TypeBox não expressa (faixas e tamanhos ficam em routes/workout.schemas.js).
// Cada função devolve a mensagem de erro (400) ou null.

const MIN_SESSION_START = Date.parse('2026-01-01T00:00:00Z');
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function checkRoutineBody(body) {
  if (!body.name.trim()) return 'name must not be blank';
  const i = body.exercises.findIndex((e) => e.reps_min > e.reps_max);
  if (i !== -1) return `exercises[${i}]: reps_min must be <= reps_max`;
  return null;
}

function checkExerciseBody(body) {
  return body.name.trim() ? null : 'name must not be blank';
}

function checkSessionBody(body, now = Date.now()) {
  const startedAt = Date.parse(body.started_at);
  if (!(startedAt >= MIN_SESSION_START)) return 'started_at must be on or after 2026-01-01';
  if (startedAt > now + FUTURE_TOLERANCE_MS) return 'started_at must not be in the future';
  return null;
}

module.exports = { checkRoutineBody, checkExerciseBody, checkSessionBody };
```

`BackEndTorv/src/lib/workoutPlan.js`:

```js
const workoutRepository = require('../repository/workout.repository');
const { generatePlan, buildBasis, diffPlanBasis } = require('./workoutGenerator');

// Gera o plano default só quando nunca foi gerado (workout_plan_basis NULL). Apagar as rotinas
// não recria. Corrida entre requests (Home e Treinos juntas): o UPDATE condicional do savePlan decide.
async function ensureDefaultPlan(userId) {
  const inputs = await workoutRepository.getPlanInputs(userId);
  if (!inputs || inputs.savedBasis) return inputs;
  const { basis, routines } = generatePlan(inputs);
  await workoutRepository.savePlan(userId, basis, routines, 'create');
  return { ...inputs, savedBasis: basis };
}

function planSuggestion(inputs) {
  if (!inputs?.savedBasis) return { has_suggestion: false, changed: [] };
  const changed = diffPlanBasis(inputs.savedBasis, buildBasis(inputs));
  return { has_suggestion: changed.length > 0, changed };
}

// Sem sugestão pendente (ou clique duplo) o savePlan 'replace' não faz nada.
async function acceptPlan(userId) {
  const inputs = await workoutRepository.getPlanInputs(userId);
  if (!inputs) return;
  const { basis, routines } = generatePlan(inputs);
  await workoutRepository.savePlan(userId, basis, routines, 'replace');
}

async function dismissPlan(userId) {
  const inputs = await workoutRepository.getPlanInputs(userId);
  if (inputs) await workoutRepository.setPlanBasis(userId, buildBasis(inputs));
}

// A rotina seguinte à do último treino, voltando ao início; sem histórico ou rotina apagada → a primeira.
function nextRoutineId(routines, lastRoutineId) {
  if (routines.length === 0) return null;
  const i = routines.findIndex((r) => r.id === lastRoutineId);
  return routines[(i + 1) % routines.length].id;
}

module.exports = { ensureDefaultPlan, planSuggestion, acceptPlan, dismissPlan, nextRoutineId };
```

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test src/lib/workoutValidation.test.js src/lib/workoutPlan.test.js`
Expected: `pass 9`, `fail 0`.

- [ ] **Step 6: Commit** (o stub do repository não entra; a Task 4 commita o arquivo real)

```bash
git add -- BackEndTorv/src/lib/workoutValidation.js BackEndTorv/src/lib/workoutValidation.test.js BackEndTorv/src/lib/workoutPlan.js BackEndTorv/src/lib/workoutPlan.test.js
git commit -m "feat(workouts): routine validation and default plan rules" -- BackEndTorv/src/lib/workoutValidation.js BackEndTorv/src/lib/workoutValidation.test.js BackEndTorv/src/lib/workoutPlan.js BackEndTorv/src/lib/workoutPlan.test.js
```

---

### Task 4: Repository, controller e rotas `/workouts` (rotinas, exercícios, plano)

**Owner:** Torv Backend (Anvil) — depois da Task 1 aplicada (client gerado) e das Tasks 2–3.

**Files:**
- Create: `BackEndTorv/src/repository/workout.repository.js` (substitui o stub da Task 3)
- Create: `BackEndTorv/src/controller/workout.controller.js`
- Create: `BackEndTorv/src/routes/workout.schemas.js`, `BackEndTorv/src/routes/workout.routes.js`
- Test: `BackEndTorv/src/routes/workout.routes.test.js`
- Modify: `BackEndTorv/server.js`

**Interfaces:**
- Consumes: Task 1 (models), Task 3 (`workoutPlan`, `workoutValidation`).
- Produces (contrato consumido pelo front, igual à spec):
  - `GET /workouts/routines` → `{ routines: [{ id, name, is_default, exercise_count, set_count }], next_routine_id: string | null, plan_suggestion: { has_suggestion, changed } }`
  - `GET /workouts/routines/:id` → `{ id, name, is_default, exercises: [{ id, exercise_id, name, muscle_group, position, reps_min, reps_max, rest_sec, sets: [{ set_number, weight_kg: number | null }] }] }`
  - `POST /workouts/routines` (201) / `PUT /workouts/routines/:id` (200) com `{ name, exercises: [{ exercise_id, reps_min, reps_max, rest_sec, sets: [{ weight_kg }] }] }` → detalhe; `DELETE /workouts/routines/:id` → 204
  - `POST /workouts/plan/accept` → mesmo corpo do `GET /routines`; `POST /workouts/plan/dismiss` → `{ message }`
  - `GET /workouts/exercises` → `{ exercises: [{ id, name, muscle_group, is_custom }] }`; `POST` (201) / `PUT /:id` (200) `{ name, muscle_group }` → exercício; `DELETE /:id` → 204
  - Repository (a Task 10 adiciona os de sessão): `getPlanInputs`, `savePlan`, `setPlanBasis`, `listRoutines`, `lastRoutineId`, `getRoutine`, `countVisibleExercises`, `createRoutine`, `updateRoutine`, `deleteRoutine`, `listExercises`, `createExercise`, `updateExercise`, `deleteExercise`.

- [ ] **Step 1: Escrever os testes de rota** (repository mockado; o middleware de auth é trocado por um stub via `require.cache`, porque o real valida JWT contra o JWKS do Supabase)

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

// O middleware real valida JWT contra o JWKS do Supabase (e quebra sem SUPABASE_URL). Aqui todo request é do USER.
const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const workoutRepository = require('../repository/workout.repository');

const ID = '22222222-2222-4222-8222-222222222222';
const EX = '33333333-3333-4333-8333-333333333333';
const basis = { fitness_level: 'INICIANTE', goals: ['Perder Peso'], gender: 'M' };
const inputs = { gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso', savedBasis: basis };
const routineRow = {
  id: ID, name: 'Peito', is_default: false,
  routine_exercises: [{
    id: 'reid', exercise_id: EX, position: 1, reps_min: 8, reps_max: 12, rest_sec: 60,
    exercise: { name: 'Supino', muscle_group: 'Peito' },
    sets: [{ set_number: 1, weight_kg: '40.50' }, { set_number: 2, weight_kg: null }],
  }],
};
const validRoutine = { name: '  Peito  ', exercises: [{ exercise_id: EX, reps_min: 8, reps_max: 12, rest_sec: 60, sets: [{ weight_kg: 40.5 }, { weight_kg: null }] }] };

async function build(t) {
  const app = Fastify();
  app.register(require('./workout.routes'), { prefix: '/workouts' });
  t.after(() => app.close());
  await app.ready();
  return app;
}

const call = (app, method, url, payload) => app.inject({ method, url, payload });

test('GET /routines: gera plano na 1ª vez e monta lista, próximo e sugestão', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...inputs, savedBasis: null }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  t.mock.method(workoutRepository, 'listRoutines', async () => [
    { id: 'a', name: 'Dia 1', is_default: true, routine_exercises: [{ _count: { sets: 3 } }, { _count: { sets: 3 } }] },
    { id: 'b', name: 'Dia 2', is_default: true, routine_exercises: [{ _count: { sets: 4 } }] },
  ]);
  t.mock.method(workoutRepository, 'lastRoutineId', async () => 'a');
  const app = await build(t);
  const res = await call(app, 'GET', '/workouts/routines');
  assert.equal(res.statusCode, 200);
  assert.equal(save.mock.callCount(), 1);
  assert.deepEqual(res.json(), {
    routines: [
      { id: 'a', name: 'Dia 1', is_default: true, exercise_count: 2, set_count: 6 },
      { id: 'b', name: 'Dia 2', is_default: true, exercise_count: 1, set_count: 4 },
    ],
    next_routine_id: 'b',
    plan_suggestion: { has_suggestion: false, changed: [] },
  });
});

test('GET /routines: perfil mudou → plan_suggestion com changed', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...inputs, fitnessLevel: 'AVANÇADO' }));
  t.mock.method(workoutRepository, 'listRoutines', async () => []);
  t.mock.method(workoutRepository, 'lastRoutineId', async () => null);
  const app = await build(t);
  const res = await call(app, 'GET', '/workouts/routines');
  assert.deepEqual(res.json().plan_suggestion, { has_suggestion: true, changed: ['fitness_level'] });
  assert.equal(res.json().next_routine_id, null);
});

test('GET /routines/:id: detalhe com carga numérica; alheia → 404; id inválido → 400', async (t) => {
  const get = t.mock.method(workoutRepository, 'getRoutine', async () => routineRow);
  const app = await build(t);
  const res = await call(app, 'GET', `/workouts/routines/${ID}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().exercises[0].sets, [{ set_number: 1, weight_kg: 40.5 }, { set_number: 2, weight_kg: null }]);
  assert.deepEqual(get.mock.calls[0].arguments, [USER, ID]);

  get.mock.mockImplementation(async () => null);
  assert.equal((await call(app, 'GET', `/workouts/routines/${ID}`)).statusCode, 404);
  assert.equal((await call(app, 'GET', '/workouts/routines/nope')).statusCode, 400);
});

test('POST /routines 201: nome aparado, exercícios visíveis', async (t) => {
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const create = t.mock.method(workoutRepository, 'createRoutine', async () => ID);
  t.mock.method(workoutRepository, 'getRoutine', async () => routineRow);
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/routines', validRoutine);
  assert.equal(res.statusCode, 201);
  const [userId, data] = create.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.equal(data.name, 'Peito');
  assert.equal(res.json().id, ID);
});

test('POST /routines 400: limites, regras cruzadas e exercício alheio', async (t) => {
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const create = t.mock.method(workoutRepository, 'createRoutine', async () => ID);
  const app = await build(t);
  const ex = validRoutine.exercises[0];
  const bad = [
    { name: '' },
    { name: '   ' },
    { name: 'x'.repeat(101) },
    { exercises: [] },
    { exercises: Array(21).fill(ex) },
    { exercises: [{ ...ex, exercise_id: 'nope' }] },
    { exercises: [{ ...ex, reps_min: 0 }] },
    { exercises: [{ ...ex, reps_max: 101 }] },
    { exercises: [{ ...ex, reps_min: 13, reps_max: 12 }] },
    { exercises: [{ ...ex, rest_sec: -1 }] },
    { exercises: [{ ...ex, rest_sec: 601 }] },
    { exercises: [{ ...ex, sets: [] }] },
    { exercises: [{ ...ex, sets: Array(11).fill({ weight_kg: null }) }] },
    { exercises: [{ ...ex, sets: [{ weight_kg: -1 }] }] },
    { exercises: [{ ...ex, sets: [{ weight_kg: 1000 }] }] },
  ];
  for (const override of bad) {
    const res = await call(app, 'POST', '/workouts/routines', { ...validRoutine, ...override });
    assert.equal(res.statusCode, 400, JSON.stringify(override).slice(0, 80));
  }
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 0);
  const res = await call(app, 'POST', '/workouts/routines', validRoutine);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { error: 'exercise not found' });
  assert.equal(create.mock.callCount(), 0);
});

test('PUT /routines/:id: alheia → 404; própria → 200', async (t) => {
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const update = t.mock.method(workoutRepository, 'updateRoutine', async () => false);
  t.mock.method(workoutRepository, 'getRoutine', async () => routineRow);
  const app = await build(t);
  assert.equal((await call(app, 'PUT', `/workouts/routines/${ID}`, validRoutine)).statusCode, 404);
  update.mock.mockImplementation(async () => true);
  const res = await call(app, 'PUT', `/workouts/routines/${ID}`, validRoutine);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(update.mock.calls[1].arguments.slice(0, 2), [USER, ID]);
});

test('DELETE /routines/:id: alheia → 404; própria → 204', async (t) => {
  const del = t.mock.method(workoutRepository, 'deleteRoutine', async () => false);
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/workouts/routines/${ID}`)).statusCode, 404);
  del.mock.mockImplementation(async () => true);
  assert.equal((await call(app, 'DELETE', `/workouts/routines/${ID}`)).statusCode, 204);
});

test('POST /plan/accept troca em modo replace; /plan/dismiss grava basis', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => ({ ...inputs, fitnessLevel: 'AVANÇADO' }));
  const save = t.mock.method(workoutRepository, 'savePlan', async () => true);
  const setBasis = t.mock.method(workoutRepository, 'setPlanBasis', async () => {});
  t.mock.method(workoutRepository, 'listRoutines', async () => []);
  t.mock.method(workoutRepository, 'lastRoutineId', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'POST', '/workouts/plan/accept')).statusCode, 200);
  assert.equal(save.mock.calls[0].arguments[3], 'replace');
  assert.equal((await call(app, 'POST', '/workouts/plan/dismiss')).statusCode, 200);
  assert.equal(setBasis.mock.calls[0].arguments[1].fitness_level, 'AVANÇADO');
});

test('exercícios: lista marca is_custom; criar valida grupo e nome; alheio → 404', async (t) => {
  t.mock.method(workoutRepository, 'listExercises', async () => [
    { id: 'c', name: 'Supino', muscle_group: 'Peito', owner_user_id: null },
    { id: 'm', name: 'Meu', muscle_group: 'Peito', owner_user_id: USER },
  ]);
  const create = t.mock.method(workoutRepository, 'createExercise', async () => ({ id: EX }));
  const update = t.mock.method(workoutRepository, 'updateExercise', async () => false);
  const del = t.mock.method(workoutRepository, 'deleteExercise', async () => false);
  const app = await build(t);

  assert.deepEqual((await call(app, 'GET', '/workouts/exercises')).json().exercises.map((e) => e.is_custom), [false, true]);
  assert.equal((await call(app, 'POST', '/workouts/exercises', { name: 'X', muscle_group: 'Pescoço' })).statusCode, 400);
  assert.equal((await call(app, 'POST', '/workouts/exercises', { name: '  ', muscle_group: 'Peito' })).statusCode, 400);
  const res = await call(app, 'POST', '/workouts/exercises', { name: ' Supino torto ', muscle_group: 'Peito' });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { id: EX, name: 'Supino torto', muscle_group: 'Peito', is_custom: true });
  assert.deepEqual(create.mock.calls[0].arguments, [USER, { name: 'Supino torto', muscle_group: 'Peito' }]);

  assert.equal((await call(app, 'PUT', `/workouts/exercises/${EX}`, { name: 'Y', muscle_group: 'Costas' })).statusCode, 404);
  assert.equal((await call(app, 'DELETE', `/workouts/exercises/${EX}`)).statusCode, 404);
  update.mock.mockImplementation(async () => true);
  del.mock.mockImplementation(async () => true);
  assert.equal((await call(app, 'PUT', `/workouts/exercises/${EX}`, { name: 'Y', muscle_group: 'Costas' })).statusCode, 200);
  assert.equal((await call(app, 'DELETE', `/workouts/exercises/${EX}`)).statusCode, 204);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/routes/workout.routes.test.js`
Expected: FAIL com `Cannot find module './workout.routes'`.

- [ ] **Step 3: Repository**

```js
const { randomUUID } = require('node:crypto');
const prisma = require('../lib/prisma');

// Transação interativa + createMany com ids gerados aqui: nested create faria 1 INSERT por linha
// (~40 idas e voltas até o banco num plano de 5 dias).
const TX = { timeout: 15000 };

const visibleExercise = (userId) => ({ OR: [{ owner_user_id: null }, { owner_user_id: userId }] });

// exercises: [{ exercise_id, reps_min, reps_max, rest_sec, sets: [{ weight_kg }] }] → linhas das 2 tabelas.
function exerciseRows(routineId, exercises) {
  const exRows = [];
  const setRows = [];
  exercises.forEach((ex, i) => {
    const id = randomUUID();
    exRows.push({ id, routine_id: routineId, exercise_id: ex.exercise_id, position: i + 1, reps_min: ex.reps_min, reps_max: ex.reps_max, rest_sec: ex.rest_sec });
    ex.sets.forEach((s, j) => setRows.push({ routine_exercise_id: id, set_number: j + 1, weight_kg: s.weight_kg }));
  });
  return { exRows, setRows };
}

async function insertExercises(tx, rows) {
  await tx.routine_exercises.createMany({ data: rows.flatMap((r) => r.exRows) });
  await tx.routine_exercise_sets.createMany({ data: rows.flatMap((r) => r.setRows) });
}

const routineDetailSelect = {
  id: true,
  name: true,
  is_default: true,
  routine_exercises: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      exercise_id: true,
      position: true,
      reps_min: true,
      reps_max: true,
      rest_sec: true,
      exercise: { select: { name: true, muscle_group: true } },
      sets: { orderBy: { set_number: 'asc' }, select: { set_number: true, weight_kg: true } },
    },
  },
};

class WorkoutRepository {
  async getPlanInputs(userId) {
    const p = await prisma.user_profiles.findUnique({
      where: { user_id: userId },
      select: { gender: true, fitness_level: true, goal: true, workout_plan_basis: true },
    });
    return p && { gender: p.gender, fitnessLevel: p.fitness_level, goals: p.goal, savedBasis: p.workout_plan_basis };
  }

  // mode 'create': só grava se o plano nunca foi gerado. 'replace': só se o basis mudou, e troca as
  // rotinas default. O UPDATE condicional trava a linha do perfil: a 2ª request concorrente reavalia o
  // WHERE, afeta 0 linhas e sai sem inserir (retorna false).
  async savePlan(userId, basis, routines, mode) {
    const json = JSON.stringify(basis);
    return prisma.$transaction(async (tx) => {
      const updated = mode === 'create'
        ? await tx.$executeRaw`UPDATE user_profiles SET workout_plan_basis = ${json}::jsonb WHERE user_id = ${userId}::uuid AND workout_plan_basis IS NULL`
        : await tx.$executeRaw`UPDATE user_profiles SET workout_plan_basis = ${json}::jsonb WHERE user_id = ${userId}::uuid AND workout_plan_basis IS DISTINCT FROM ${json}::jsonb`;
      if (updated === 0) return false;
      if (mode === 'replace') await tx.workout_routines.deleteMany({ where: { user_id: userId, is_default: true } });

      const slugs = [...new Set(routines.flatMap((r) => r.exercises.map((e) => e.slug)))];
      const catalog = await tx.exercises.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
      const idBySlug = new Map(catalog.map((c) => [c.slug, c.id]));

      const routineRows = routines.map((r) => ({ id: randomUUID(), user_id: userId, name: r.name, is_default: true, position: r.position }));
      await tx.workout_routines.createMany({ data: routineRows });
      await insertExercises(tx, routines.map((r, i) => exerciseRows(routineRows[i].id, r.exercises.map((e) => ({
        exercise_id: idBySlug.get(e.slug),
        reps_min: e.reps_min,
        reps_max: e.reps_max,
        rest_sec: e.rest_sec,
        sets: Array.from({ length: e.set_count }, () => ({ weight_kg: null })),
      })))));
      return true;
    }, TX);
  }

  async setPlanBasis(userId, basis) {
    await prisma.user_profiles.update({ where: { user_id: userId }, data: { workout_plan_basis: basis } });
  }

  async listRoutines(userId) {
    return prisma.workout_routines.findMany({
      where: { user_id: userId },
      orderBy: [{ is_default: 'desc' }, { position: 'asc' }, { created_at: 'asc' }],
      select: { id: true, name: true, is_default: true, routine_exercises: { select: { _count: { select: { sets: true } } } } },
    });
  }

  async lastRoutineId(userId) {
    const last = await prisma.activities.findFirst({
      where: { user_id: userId, activity_type: 'STRENGTH', routine_id: { not: null } },
      orderBy: { start_time: 'desc' },
      select: { routine_id: true },
    });
    return last?.routine_id ?? null;
  }

  async getRoutine(userId, id) {
    return prisma.workout_routines.findFirst({ where: { id, user_id: userId }, select: routineDetailSelect });
  }

  async countVisibleExercises(userId, ids) {
    return prisma.exercises.count({ where: { id: { in: ids }, ...visibleExercise(userId) } });
  }

  async createRoutine(userId, { name, exercises }) {
    const id = randomUUID();
    await prisma.$transaction(async (tx) => {
      const { _max } = await tx.workout_routines.aggregate({ where: { user_id: userId }, _max: { position: true } });
      await tx.workout_routines.create({ data: { id, user_id: userId, name, position: (_max.position ?? 0) + 1 } });
      await insertExercises(tx, [exerciseRows(id, exercises)]);
    }, TX);
    return id;
  }

  // Substitui todos os exercícios/séries. false = rotina não é do usuário.
  async updateRoutine(userId, id, { name, exercises }) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.workout_routines.updateMany({ where: { id, user_id: userId }, data: { name } });
      if (count === 0) return false;
      await tx.routine_exercises.deleteMany({ where: { routine_id: id } });
      await insertExercises(tx, [exerciseRows(id, exercises)]);
      return true;
    }, TX);
  }

  async deleteRoutine(userId, id) {
    const { count } = await prisma.workout_routines.deleteMany({ where: { id, user_id: userId } });
    return count > 0;
  }

  async listExercises(userId) {
    return prisma.exercises.findMany({
      where: visibleExercise(userId),
      orderBy: [{ muscle_group: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, muscle_group: true, owner_user_id: true },
    });
  }

  async createExercise(userId, { name, muscle_group }) {
    return prisma.exercises.create({ data: { name, muscle_group, owner_user_id: userId }, select: { id: true } });
  }

  // Só exercício próprio: catálogo tem owner_user_id NULL e nunca casa.
  async updateExercise(userId, id, { name, muscle_group }) {
    const { count } = await prisma.exercises.updateMany({ where: { id, owner_user_id: userId }, data: { name, muscle_group } });
    return count > 0;
  }

  async deleteExercise(userId, id) {
    const { count } = await prisma.exercises.deleteMany({ where: { id, owner_user_id: userId } });
    return count > 0;
  }
}

module.exports = new WorkoutRepository();
```

- [ ] **Step 4: Schemas**

```js
const { Type } = require('@sinclair/typebox');

const MUSCLE_GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps',
  'Posterior de coxa', 'Glúteos', 'Panturrilha', 'Abdômen', 'Lombar', 'Antebraço',
];

const Uuid = Type.String({ format: 'uuid' });
const ErrorBody = Type.Object({ error: Type.String() });
const errors = (...codes) => Object.fromEntries(codes.map((c) => [c, ErrorBody]));
const IdParams = Type.Object({ id: Uuid });
const MuscleGroup = Type.Union(MUSCLE_GROUPS.map((g) => Type.Literal(g)));

const RoutineBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  exercises: Type.Array(Type.Object({
    exercise_id: Uuid,
    reps_min: Type.Integer({ minimum: 1, maximum: 100 }),
    reps_max: Type.Integer({ minimum: 1, maximum: 100 }),
    rest_sec: Type.Integer({ minimum: 0, maximum: 600 }),
    sets: Type.Array(
      Type.Object({ weight_kg: Type.Union([Type.Number({ minimum: 0, maximum: 999.99 }), Type.Null()]) }),
      { minItems: 1, maxItems: 10 },
    ),
  }), { minItems: 1, maxItems: 20 }),
});

const PlanSuggestion = Type.Object({
  has_suggestion: Type.Boolean(),
  changed: Type.Array(Type.String({ description: 'fitness_level | goals | gender' })),
});

const RoutineList = Type.Object({
  routines: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    is_default: Type.Boolean(),
    exercise_count: Type.Integer(),
    set_count: Type.Integer(),
  })),
  next_routine_id: Type.Union([Type.String(), Type.Null()]),
  plan_suggestion: PlanSuggestion,
});

const RoutineDetail = Type.Object({
  id: Type.String(),
  name: Type.String(),
  is_default: Type.Boolean(),
  exercises: Type.Array(Type.Object({
    id: Type.String(),
    exercise_id: Type.String(),
    name: Type.String(),
    muscle_group: Type.String(),
    position: Type.Integer(),
    reps_min: Type.Integer(),
    reps_max: Type.Integer(),
    rest_sec: Type.Integer(),
    sets: Type.Array(Type.Object({ set_number: Type.Integer(), weight_kg: Type.Union([Type.Number(), Type.Null()]) })),
  })),
});

const ExerciseBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  muscle_group: MuscleGroup,
});

const Exercise = Type.Object({
  id: Type.String(),
  name: Type.String(),
  muscle_group: Type.String(),
  is_custom: Type.Boolean(),
});

module.exports = {
  MUSCLE_GROUPS, errors, IdParams, RoutineBody, RoutineList, RoutineDetail, ExerciseBody, Exercise,
};
```

- [ ] **Step 5: Controller**

```js
const workoutRepository = require('../repository/workout.repository');
const { ensureDefaultPlan, planSuggestion, acceptPlan, dismissPlan, nextRoutineId } = require('../lib/workoutPlan');
const { checkRoutineBody, checkExerciseBody } = require('../lib/workoutValidation');

// Recurso de outro usuário (ou do catálogo tratado como próprio) → 404, nunca 403: não revela que existe.
const NOT_FOUND = { error: 'Not found' };

function routineSummary(r) {
  return {
    id: r.id,
    name: r.name,
    is_default: r.is_default,
    exercise_count: r.routine_exercises.length,
    set_count: r.routine_exercises.reduce((n, e) => n + e._count.sets, 0),
  };
}

function routineDetail(r) {
  return {
    id: r.id,
    name: r.name,
    is_default: r.is_default,
    exercises: r.routine_exercises.map((e) => ({
      id: e.id,
      exercise_id: e.exercise_id,
      name: e.exercise.name,
      muscle_group: e.exercise.muscle_group,
      position: e.position,
      reps_min: e.reps_min,
      reps_max: e.reps_max,
      rest_sec: e.rest_sec,
      sets: e.sets.map((s) => ({ set_number: s.set_number, weight_kg: s.weight_kg == null ? null : Number(s.weight_kg) })),
    })),
  };
}

async function routinesPayload(userId, inputs) {
  const [routines, last] = await Promise.all([workoutRepository.listRoutines(userId), workoutRepository.lastRoutineId(userId)]);
  return {
    routines: routines.map(routineSummary),
    next_routine_id: nextRoutineId(routines, last),
    plan_suggestion: planSuggestion(inputs),
  };
}

// Corpo já passou pelo schema; aqui entram as regras cruzadas e a visibilidade dos exercícios.
async function prepareRoutine(userId, body) {
  const error = checkRoutineBody(body);
  if (error) return { error };
  const ids = [...new Set(body.exercises.map((e) => e.exercise_id))];
  if (await workoutRepository.countVisibleExercises(userId, ids) !== ids.length) return { error: 'exercise not found' };
  return { data: { name: body.name.trim(), exercises: body.exercises } };
}

function prepareExercise(body) {
  const error = checkExerciseBody(body);
  return error ? { error } : { data: { name: body.name.trim(), muscle_group: body.muscle_group } };
}

class WorkoutController {
  async listRoutines(request, reply) {
    const { userId } = request.user;
    const inputs = await ensureDefaultPlan(userId);
    return reply.send(await routinesPayload(userId, inputs));
  }

  async getRoutine(request, reply) {
    const routine = await workoutRepository.getRoutine(request.user.userId, request.params.id);
    return routine ? reply.send(routineDetail(routine)) : reply.status(404).send(NOT_FOUND);
  }

  async createRoutine(request, reply) {
    const { userId } = request.user;
    const { error, data } = await prepareRoutine(userId, request.body);
    if (error) return reply.status(400).send({ error });
    const id = await workoutRepository.createRoutine(userId, data);
    return reply.status(201).send(routineDetail(await workoutRepository.getRoutine(userId, id)));
  }

  async updateRoutine(request, reply) {
    const { userId } = request.user;
    const { id } = request.params;
    const { error, data } = await prepareRoutine(userId, request.body);
    if (error) return reply.status(400).send({ error });
    if (!await workoutRepository.updateRoutine(userId, id, data)) return reply.status(404).send(NOT_FOUND);
    return reply.send(routineDetail(await workoutRepository.getRoutine(userId, id)));
  }

  async deleteRoutine(request, reply) {
    const deleted = await workoutRepository.deleteRoutine(request.user.userId, request.params.id);
    return deleted ? reply.status(204).send() : reply.status(404).send(NOT_FOUND);
  }

  async acceptPlan(request, reply) {
    const { userId } = request.user;
    await acceptPlan(userId);
    return reply.send(await routinesPayload(userId, await workoutRepository.getPlanInputs(userId)));
  }

  async dismissPlan(request, reply) {
    await dismissPlan(request.user.userId);
    return reply.send({ message: 'Plan suggestion dismissed' });
  }

  async listExercises(request, reply) {
    const rows = await workoutRepository.listExercises(request.user.userId);
    return reply.send({
      exercises: rows.map((e) => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, is_custom: e.owner_user_id !== null })),
    });
  }

  async createExercise(request, reply) {
    const { error, data } = prepareExercise(request.body);
    if (error) return reply.status(400).send({ error });
    const { id } = await workoutRepository.createExercise(request.user.userId, data);
    return reply.status(201).send({ id, ...data, is_custom: true });
  }

  async updateExercise(request, reply) {
    const { error, data } = prepareExercise(request.body);
    if (error) return reply.status(400).send({ error });
    const { id } = request.params;
    const updated = await workoutRepository.updateExercise(request.user.userId, id, data);
    return updated ? reply.send({ id, ...data, is_custom: true }) : reply.status(404).send(NOT_FOUND);
  }

  async deleteExercise(request, reply) {
    const deleted = await workoutRepository.deleteExercise(request.user.userId, request.params.id);
    return deleted ? reply.status(204).send() : reply.status(404).send(NOT_FOUND);
  }
}

module.exports = new WorkoutController();
```

- [ ] **Step 6: Rotas**

```js
const { Type } = require('@sinclair/typebox');
const workoutController = require('../controller/workout.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const {
  errors, IdParams, RoutineBody, RoutineList, RoutineDetail, ExerciseBody, Exercise,
} = require('./workout.schemas');

const tags = ['Workouts'];
const security = [{ bearerAuth: [] }];

async function workoutRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/routines', {
    schema: {
      description: 'Lista as rotinas do usuário. Gera o plano default na primeira chamada (workout_plan_basis NULL)',
      tags, security,
      response: { 200: RoutineList, ...errors(401, 403) },
    },
  }, workoutController.listRoutines);

  fastify.get('/routines/:id', {
    schema: { tags, security, params: IdParams, response: { 200: RoutineDetail, ...errors(400, 401, 403, 404) } },
  }, workoutController.getRoutine);

  fastify.post('/routines', {
    schema: { tags, security, body: RoutineBody, response: { 201: RoutineDetail, ...errors(400, 401, 403) } },
  }, workoutController.createRoutine);

  fastify.put('/routines/:id', {
    schema: {
      description: 'Substitui nome, exercícios e séries da rotina',
      tags, security, params: IdParams, body: RoutineBody,
      response: { 200: RoutineDetail, ...errors(400, 401, 403, 404) },
    },
  }, workoutController.updateRoutine);

  fastify.delete('/routines/:id', {
    schema: { tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, workoutController.deleteRoutine);

  fastify.post('/plan/accept', {
    schema: {
      description: 'Troca as rotinas default pelas geradas com o perfil atual. Sem sugestão pendente: não muda nada',
      tags, security,
      response: { 200: RoutineList, ...errors(401, 403) },
    },
  }, workoutController.acceptPlan);

  fastify.post('/plan/dismiss', {
    schema: { tags, security, response: { 200: Type.Object({ message: Type.String() }), ...errors(401, 403) } },
  }, workoutController.dismissPlan);

  fastify.get('/exercises', {
    schema: { tags, security, response: { 200: Type.Object({ exercises: Type.Array(Exercise) }), ...errors(401, 403) } },
  }, workoutController.listExercises);

  fastify.post('/exercises', {
    schema: { tags, security, body: ExerciseBody, response: { 201: Exercise, ...errors(400, 401, 403) } },
  }, workoutController.createExercise);

  fastify.put('/exercises/:id', {
    schema: { tags, security, params: IdParams, body: ExerciseBody, response: { 200: Exercise, ...errors(400, 401, 403, 404) } },
  }, workoutController.updateExercise);

  fastify.delete('/exercises/:id', {
    schema: { tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, workoutController.deleteExercise);
}

module.exports = workoutRoutes;
```

- [ ] **Step 7: Registrar no `server.js`**

Depois de `fastify.register(require('./src/routes/diet.routes'), { prefix: '/diet' });`:

```js
fastify.register(require('./src/routes/workout.routes'), { prefix: '/workouts' });
```

- [ ] **Step 8: Rodar tudo**

Run: `node --test src/routes/workout.routes.test.js`
Expected: `pass 9`, `fail 0`.

Run: `npm test`
Expected: todos os testes do backend passam (os antigos + 27 novos).

- [ ] **Step 9: Fumaça no Furnace** (nodemon reinicia sozinho; se não, pedir ao Maestro `rs` no Furnace)

Com uma conta de teste logada no Expo web, via portal: `GET /workouts/routines` → 200, rotinas `Dia N — …` criadas; segunda chamada → mesmas rotinas (não duplica); `GET /workouts/exercises` → 71 itens com `is_custom: false`.

- [ ] **Step 10: Commit**

```bash
git add -- BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/routes/workout.routes.test.js BackEndTorv/server.js
git commit -m "feat(workouts): routines, exercises and default plan endpoints" -- BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/routes/workout.routes.test.js BackEndTorv/server.js
```

---

### Task 5: Front — contrato, utilitários puros, ConfirmModal e navegação

**Owner:** Torv Frontend (Lumen) — pode começar em paralelo às Tasks 1–4 (contrato fixado na spec).

**Files:**
- Create: `FrontEndTorv/src/services/workouts.ts`
- Create: `FrontEndTorv/src/utils/clock.ts`, `FrontEndTorv/src/utils/routineForm.ts`
- Test: `FrontEndTorv/src/utils/clock.test.mjs`, `FrontEndTorv/src/utils/routineForm.test.mjs`
- Create: `FrontEndTorv/src/components/ConfirmModal/index.tsx`, `styles.ts`
- Create: `FrontEndTorv/src/routes/types.ts`

**Interfaces:**
- Produces:
  - `workoutsApi` (rotinas, exercícios, plano) e os tipos `RoutineList`, `RoutineSummary`, `RoutineDetail`, `RoutineExercise`, `RoutineInput`, `Exercise`, `ExerciseInput`, `PlanSuggestion`, `MUSCLE_GROUPS`.
  - `formatClock(totalSec: number): string` (`65 → "1:05"`, `3725 → "1:02:05"`).
  - `FormExercise`, `LIMITS`, `formFromDetail(detail)`, `newFormExercise(exercise)`, `clampRest(sec)`, `moveItem(list, index, delta)`, `parseWeight(text): number | null` (NaN = inválido), `buildRoutineInput(name, items) → { error } | { body: RoutineInput }`.
  - `ConfirmModal` props `{ visible, title, message, confirmLabel, danger?, loading?, onConfirm, onCancel }`.
  - `TabParamList`, `AppStackParamList` (entrega 1: `Tabs`, `RoutineEditor: { routineId?: string }`), `AppNavigation`.
  - Os módulos testados com Node (`clock.ts`, `routineForm.ts`, e na entrega 2 `workoutSession.ts`) só podem ter `import type` — imports de runtime sem extensão quebram o `node --test`.

- [ ] **Step 1: Escrever os testes**

`FrontEndTorv/src/utils/clock.test.mjs`:

```js
// Roda com: node --test src/utils/clock.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatClock } from './clock.ts';

test('formatClock', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(600), '10:00');
  assert.equal(formatClock(3600), '1:00:00');
  assert.equal(formatClock(3725), '1:02:05');
});
```

`FrontEndTorv/src/utils/routineForm.test.mjs`:

```js
// Roda com: node --test src/utils/routineForm.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { formFromDetail, newFormExercise, clampRest, moveItem, parseWeight, buildRoutineInput } from './routineForm.ts';

const supino = { id: 'e1', name: 'Supino', muscle_group: 'Peito', is_custom: false };

test('newFormExercise: 3 séries vazias, 8–12, 60s; chaves únicas', () => {
  const a = newFormExercise(supino);
  const b = newFormExercise(supino);
  assert.deepEqual([a.reps_min, a.reps_max, a.rest_sec, a.weights], ['8', '12', 60, ['', '', '']]);
  assert.notEqual(a.key, b.key);
});

test('formFromDetail converte números em texto e null em vazio', () => {
  const [ex] = formFromDetail({
    id: 'r', name: 'R', is_default: false,
    exercises: [{ id: 're', exercise_id: 'e1', name: 'Supino', muscle_group: 'Peito', position: 1, reps_min: 6, reps_max: 10, rest_sec: 90, sets: [{ set_number: 1, weight_kg: 42.5 }, { set_number: 2, weight_kg: null }] }],
  });
  assert.deepEqual([ex.reps_min, ex.reps_max, ex.rest_sec, ex.weights], ['6', '10', 90, ['42.5', '']]);
});

test('parseWeight aceita vírgula, vazio vira null e lixo vira NaN', () => {
  assert.equal(parseWeight(''), null);
  assert.equal(parseWeight('  '), null);
  assert.equal(parseWeight('40,5'), 40.5);
  assert.equal(parseWeight('100'), 100);
  assert.ok(Number.isNaN(parseWeight('-1')));
  assert.ok(Number.isNaN(parseWeight('1.234')));
  assert.ok(Number.isNaN(parseWeight('abc')));
});

test('clampRest e moveItem', () => {
  assert.equal(clampRest(-15), 0);
  assert.equal(clampRest(615), 600);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
});

test('buildRoutineInput monta o corpo com nome aparado e cargas numéricas', () => {
  const ex = { ...newFormExercise(supino), weights: ['40,5', '', '42'] };
  assert.deepEqual(buildRoutineInput('  Peito  ', [ex]), {
    body: { name: 'Peito', exercises: [{ exercise_id: 'e1', reps_min: 8, reps_max: 12, rest_sec: 60, sets: [{ weight_kg: 40.5 }, { weight_kg: null }, { weight_kg: 42 }] }] },
  });
});

test('buildRoutineInput: erros de nome, lista e campos', () => {
  const ex = newFormExercise(supino);
  assert.deepEqual(buildRoutineInput('  ', [ex]), { error: 'Dê um nome para a rotina.' });
  assert.deepEqual(buildRoutineInput('x'.repeat(101), [ex]), { error: 'O nome pode ter no máximo 100 caracteres.' });
  assert.deepEqual(buildRoutineInput('A', []), { error: 'Adicione pelo menos um exercício.' });
  assert.deepEqual(buildRoutineInput('A', Array(21).fill(ex)), { error: 'Máximo de 20 exercícios por rotina.' });
  for (const bad of [{ reps_min: '0' }, { reps_max: '101' }, { reps_min: '13' }, { reps_min: '' }, { reps_min: '8.5' }]) {
    assert.match(buildRoutineInput('A', [{ ...ex, ...bad }]).error, /repetições/);
  }
  for (const w of ['1000', 'abc', '-5']) {
    assert.match(buildRoutineInput('A', [{ ...ex, weights: [w] }]).error, /carga/);
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd FrontEndTorv && node --test src/utils/clock.test.mjs src/utils/routineForm.test.mjs`
Expected: FAIL com `Cannot find module` para `clock.ts` / `routineForm.ts`. (O aviso `Reparsing as ES module` é esperado e inofensivo.)

- [ ] **Step 3: Contrato da API** — `FrontEndTorv/src/services/workouts.ts`:

```ts
import api from './api';

// Contrato de /workouts/* (spec docs/superpowers/specs/2026-09-30-workout-module-design.md).

export const MUSCLE_GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps',
  'Posterior de coxa', 'Glúteos', 'Panturrilha', 'Abdômen', 'Lombar', 'Antebraço',
] as const;

export interface RoutineSummary {
  id: string;
  name: string;
  is_default: boolean;
  exercise_count: number;
  set_count: number;
}

export interface PlanSuggestion {
  has_suggestion: boolean;
  changed: string[]; // fitness_level | goals | gender
}

export interface RoutineList {
  routines: RoutineSummary[];
  next_routine_id: string | null;
  plan_suggestion: PlanSuggestion;
}

export interface RoutineExercise {
  id: string;
  exercise_id: string;
  name: string;
  muscle_group: string;
  position: number;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  sets: { set_number: number; weight_kg: number | null }[];
}

export interface RoutineDetail {
  id: string;
  name: string;
  is_default: boolean;
  exercises: RoutineExercise[];
}

export interface RoutineInput {
  name: string;
  exercises: {
    exercise_id: string;
    reps_min: number;
    reps_max: number;
    rest_sec: number;
    sets: { weight_kg: number | null }[];
  }[];
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  is_custom: boolean;
}

export interface ExerciseInput {
  name: string;
  muscle_group: string;
}

export const workoutsApi = {
  listRoutines: () => api.get<RoutineList>('/workouts/routines').then((r) => r.data),
  getRoutine: (id: string) => api.get<RoutineDetail>(`/workouts/routines/${id}`).then((r) => r.data),
  createRoutine: (body: RoutineInput) => api.post<RoutineDetail>('/workouts/routines', body).then((r) => r.data),
  updateRoutine: (id: string, body: RoutineInput) => api.put<RoutineDetail>(`/workouts/routines/${id}`, body).then((r) => r.data),
  deleteRoutine: (id: string) => api.delete(`/workouts/routines/${id}`),
  acceptPlan: () => api.post<RoutineList>('/workouts/plan/accept', {}).then((r) => r.data),
  dismissPlan: () => api.post('/workouts/plan/dismiss', {}),
  listExercises: () => api.get<{ exercises: Exercise[] }>('/workouts/exercises').then((r) => r.data.exercises),
  createExercise: (body: ExerciseInput) => api.post<Exercise>('/workouts/exercises', body).then((r) => r.data),
  updateExercise: (id: string, body: ExerciseInput) => api.put<Exercise>(`/workouts/exercises/${id}`, body).then((r) => r.data),
  deleteExercise: (id: string) => api.delete(`/workouts/exercises/${id}`),
};
```

- [ ] **Step 4: Utilitários**

`FrontEndTorv/src/utils/clock.ts`:

```ts
// Segundos → "m:ss" (ou "h:mm:ss" a partir de 1h).
export function formatClock(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = String(totalSec % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
```

`FrontEndTorv/src/utils/routineForm.ts`:

```ts
import type { Exercise, RoutineDetail, RoutineInput } from '../services/workouts';

// Estado do editor de rotina (texto cru dos inputs) e conversão pro corpo do POST/PUT /workouts/routines.
// Mesmos limites do backend.

export interface FormExercise {
  key: string; // chave local: o mesmo exercício pode entrar 2x na rotina
  exercise_id: string;
  name: string;
  muscle_group: string;
  reps_min: string;
  reps_max: string;
  rest_sec: number;
  weights: string[]; // uma por série; '' = sem carga
}

export const LIMITS = { name: 100, exercises: 20, sets: 10, reps: 100, rest: 600, restStep: 15, weight: 999.99 };

let seq = 0;
const nextKey = () => `k${++seq}`;

export const formFromDetail = (d: RoutineDetail): FormExercise[] => d.exercises.map((e) => ({
  key: nextKey(),
  exercise_id: e.exercise_id,
  name: e.name,
  muscle_group: e.muscle_group,
  reps_min: String(e.reps_min),
  reps_max: String(e.reps_max),
  rest_sec: e.rest_sec,
  weights: e.sets.map((s) => (s.weight_kg === null ? '' : String(s.weight_kg))),
}));

// Padrão ao adicionar: 3 séries sem carga, 8–12 reps, 60s de descanso.
export const newFormExercise = (e: Exercise): FormExercise => ({
  key: nextKey(),
  exercise_id: e.id,
  name: e.name,
  muscle_group: e.muscle_group,
  reps_min: '8',
  reps_max: '12',
  rest_sec: 60,
  weights: ['', '', ''],
});

export const clampRest = (sec: number) => Math.min(LIMITS.rest, Math.max(0, sec));

export function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}

// '' → null (sem carga); "40,5" → 40.5; qualquer outra coisa → NaN.
export function parseWeight(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
}

const parseReps = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN);

export function buildRoutineInput(name: string, items: FormExercise[]): { error: string } | { body: RoutineInput } {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Dê um nome para a rotina.' };
  if (trimmed.length > LIMITS.name) return { error: 'O nome pode ter no máximo 100 caracteres.' };
  if (items.length === 0) return { error: 'Adicione pelo menos um exercício.' };
  if (items.length > LIMITS.exercises) return { error: 'Máximo de 20 exercícios por rotina.' };

  const exercises: RoutineInput['exercises'] = [];
  for (const it of items) {
    const min = parseReps(it.reps_min);
    const max = parseReps(it.reps_max);
    if (!(min >= 1 && max <= LIMITS.reps && min <= max)) return { error: `${it.name}: repetições de 1 a 100, com mínimo ≤ máximo.` };
    const weights = it.weights.map(parseWeight);
    if (weights.some((w) => w !== null && !(w >= 0 && w <= LIMITS.weight))) return { error: `${it.name}: carga entre 0 e 999,99 kg.` };
    exercises.push({ exercise_id: it.exercise_id, reps_min: min, reps_max: max, rest_sec: it.rest_sec, sets: weights.map((weight_kg) => ({ weight_kg })) });
  }
  return { body: { name: trimmed, exercises } };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test src/utils/clock.test.mjs src/utils/routineForm.test.mjs`
Expected: `pass 7`, `fail 0`.

- [ ] **Step 6: ConfirmModal**

`FrontEndTorv/src/components/ConfirmModal/index.tsx`:

```tsx
import React from 'react';
import { Modal, View, Text } from 'react-native';
import { Button } from '../Button';
import { styles } from './styles';

// Confirmação própria: Alert.alert não funciona no react-native-web.
interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<Props> = ({ visible, title, message, confirmLabel, danger, loading, onConfirm, onCancel }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <View style={styles.content} accessibilityRole="alert">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Button title={confirmLabel} danger={danger} loading={loading} onPress={onConfirm} />
        <Button title="Cancelar" outline onPress={onCancel} disabled={loading} />
      </View>
    </View>
  </Modal>
);
```

`FrontEndTorv/src/components/ConfirmModal/styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.6)' },
  content: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, gap: 12 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20 },
  message: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
```

- [ ] **Step 7: Tipos de navegação** — `FrontEndTorv/src/routes/types.ts`:

```ts
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Workouts: undefined;
  MyDiet: undefined;
  Profile: undefined;
};

// Telas empilhadas sobre as abas (cobrem a tab bar).
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  RoutineEditor: { routineId?: string };
};

export type AppNavigation = NativeStackNavigationProp<AppStackParamList>;
```

- [ ] **Step 8: Typecheck**

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add -- FrontEndTorv/src/services/workouts.ts FrontEndTorv/src/utils/clock.ts FrontEndTorv/src/utils/clock.test.mjs FrontEndTorv/src/utils/routineForm.ts FrontEndTorv/src/utils/routineForm.test.mjs FrontEndTorv/src/components/ConfirmModal FrontEndTorv/src/routes/types.ts
git commit -m "feat(workouts): front api contract, routine form utils and confirm modal" -- FrontEndTorv/src/services/workouts.ts FrontEndTorv/src/utils/clock.ts FrontEndTorv/src/utils/clock.test.mjs FrontEndTorv/src/utils/routineForm.ts FrontEndTorv/src/utils/routineForm.test.mjs FrontEndTorv/src/components/ConfirmModal FrontEndTorv/src/routes/types.ts
```

---

### Task 6: Front — ExercisePicker e RoutineEditor

**Owner:** Torv Frontend (Lumen) — depois da Task 5.

**Files:**
- Create: `FrontEndTorv/src/components/ExercisePicker/index.tsx`, `styles.ts`
- Create: `FrontEndTorv/src/screens/RoutineEditor/index.tsx`, `styles.ts`

**Interfaces:**
- Consumes: `workoutsApi`, `MUSCLE_GROUPS`, `Exercise` (Task 5); `routineForm`, `formatClock`, `ConfirmModal`, `AppNavigation`, `AppStackParamList` (Task 5).
- Produces: `ExercisePicker` props `{ visible, onClose, onPick(exercise: Exercise) }`; tela `RoutineEditor` (params `{ routineId?: string }`; sem id = nova rotina). A rota é registrada na Task 7.

- [ ] **Step 1: ExercisePicker**

`FrontEndTorv/src/components/ExercisePicker/index.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { X, Plus, Edit2, Trash2 } from 'lucide-react-native';
import { Input } from '../Input';
import { Button } from '../Button';
import { MUSCLE_GROUPS, workoutsApi, type Exercise } from '../../services/workouts';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}

interface Form {
  id?: string; // presente = edição
  name: string;
  muscle_group: string;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const ExercisePicker: React.FC<Props> = ({ visible, onClose, onPick }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Exercise | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setExercises(await workoutsApi.listExercises());
    } catch {
      setError('Não foi possível carregar os exercícios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setForm(null);
      setToDelete(null);
      load();
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return exercises.filter((e) => (!group || e.muscle_group === group) && (!q || normalize(e.name).includes(q)));
  }, [exercises, query, group]);

  const saveForm = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name || name.length > 100) {
      setError('Nome de 1 a 100 caracteres.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = { name, muscle_group: form.muscle_group };
      if (form.id) await workoutsApi.updateExercise(form.id, body);
      else await workoutsApi.createExercise(body);
      setForm(null);
      await load();
    } catch {
      setError('Não foi possível salvar o exercício.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await workoutsApi.deleteExercise(toDelete.id);
      setToDelete(null);
      await load();
    } catch {
      setError('Não foi possível excluir o exercício.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Exercise }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={() => onPick(item)}
        accessibilityRole="button"
        accessibilityLabel={`Adicionar ${item.name}`}
      >
        <Text style={styles.rowName}>{item.name}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowGroup}>{item.muscle_group}</Text>
          {item.is_custom && <Text style={styles.customTag}>Meu</Text>}
        </View>
      </TouchableOpacity>
      {item.is_custom && (
        <>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setForm({ id: item.id, name: item.name, muscle_group: item.muscle_group })}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.name}`}
          >
            <Edit2 color={colors.textSecondary} size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setToDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Excluir ${item.name}`}
          >
            <Trash2 color={colors.error} size={18} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{form ? (form.id ? 'Editar exercício' : 'Novo exercício') : 'Adicionar exercício'}</Text>
          <TouchableOpacity onPress={form ? () => setForm(null) : onClose} accessibilityRole="button" accessibilityLabel="Fechar">
            <X color={colors.textSecondary} size={24} />
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {form ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Nome" value={form.name} maxLength={100} onChangeText={(name) => setForm({ ...form, name })} />
            <Text style={styles.label}>Grupo muscular</Text>
            <View style={styles.chips}>
              {MUSCLE_GROUPS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, form.muscle_group === g && styles.chipActive]}
                  onPress={() => setForm({ ...form, muscle_group: g })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: form.muscle_group === g }}
                >
                  <Text style={[styles.chipText, form.muscle_group === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Salvar exercício" loading={saving} onPress={saveForm} />
          </ScrollView>
        ) : (
          <>
            <Input placeholder="Buscar exercício" value={query} onChangeText={setQuery} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
              {[null, ...MUSCLE_GROUPS].map((g) => (
                <TouchableOpacity
                  key={g ?? 'all'}
                  style={[styles.chip, group === g && styles.chipActive]}
                  onPress={() => setGroup(g)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: group === g }}
                >
                  <Text style={[styles.chipText, group === g && styles.chipTextActive]}>{g ?? 'Todos'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setForm({ name: query.trim(), muscle_group: group ?? MUSCLE_GROUPS[0] })}
              accessibilityRole="button"
            >
              <Plus color={colors.brand} size={18} />
              <Text style={styles.createText}>Criar exercício</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator color={colors.brand} style={styles.loading} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(e) => e.id}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.empty}>Nenhum exercício encontrado.</Text>}
              />
            )}

            {toDelete && (
              <View style={styles.deleteBar}>
                <Text style={styles.deleteText}>Excluir "{toDelete.name}"? Ele sai de todas as rotinas.</Text>
                <View style={styles.deleteActions}>
                  <Button title="Cancelar" outline style={styles.deleteButton} onPress={() => setToDelete(null)} />
                  <Button title="Excluir" danger loading={saving} style={styles.deleteButton} onPress={confirmDelete} />
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
};
```

`FrontEndTorv/src/components/ExercisePicker/styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22 },
  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 13, marginBottom: 8 },
  label: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13, marginBottom: 8 },
  chipsScroll: { flexGrow: 0, marginBottom: 12 },
  chipsRow: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  chipText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },
  chipTextActive: { color: colors.brand },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  createText: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 15 },
  loading: { marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  rowMain: { flex: 1, paddingVertical: 14 },
  rowName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  rowGroup: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13 },
  customTag: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 11, borderWidth: 1, borderColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: 8 },
  iconButton: { padding: 12 },
  empty: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, textAlign: 'center', marginTop: 24 },
  deleteBar: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 12, marginTop: 8 },
  deleteText: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14 },
  deleteActions: { flexDirection: 'row', gap: 8 },
  deleteButton: { flex: 1 },
});
```

- [ ] **Step 2: RoutineEditor**

`FrontEndTorv/src/screens/RoutineEditor/index.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, Minus } from 'lucide-react-native';

import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ExercisePicker } from '../../components/ExercisePicker';
import { workoutsApi } from '../../services/workouts';
import { formatClock } from '../../utils/clock';
import {
  LIMITS, buildRoutineInput, clampRest, formFromDetail, moveItem, newFormExercise, type FormExercise,
} from '../../utils/routineForm';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

export default function RoutineEditor() {
  const navigation = useNavigation<AppNavigation>();
  const { routineId } = useRoute<RouteProp<AppStackParamList, 'RoutineEditor'>>().params ?? {};
  const [name, setName] = useState('');
  const [items, setItems] = useState<FormExercise[]>([]);
  const [loading, setLoading] = useState(!!routineId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!routineId) return;
    workoutsApi.getRoutine(routineId)
      .then((d) => {
        setName(d.name);
        setItems(formFromDetail(d));
      })
      .catch(() => setError('Não foi possível carregar a rotina.'))
      .finally(() => setLoading(false));
  }, [routineId]);

  const update = (key: string, patch: Partial<FormExercise>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const save = async () => {
    const result = buildRoutineInput(name, items);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (routineId) await workoutsApi.updateRoutine(routineId, result.body);
      else await workoutsApi.createRoutine(result.body);
      navigation.goBack();
    } catch {
      setError('Não foi possível salvar a rotina.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!routineId) return;
    setSaving(true);
    try {
      await workoutsApi.deleteRoutine(routineId);
      setConfirmDelete(false);
      navigation.goBack();
    } catch {
      setConfirmDelete(false);
      setError('Não foi possível excluir a rotina.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.brand} style={styles.loading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
            <ArrowLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{routineId ? 'Editar rotina' : 'Nova rotina'}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Input label="Nome da rotina" value={name} maxLength={LIMITS.name} onChangeText={setName} placeholder="Ex.: Peito e tríceps" />

          {items.map((it, index) => (
            <Card key={it.key}>
              <View style={styles.exerciseHeader}>
                <View style={styles.flex}>
                  <Text style={styles.exerciseName}>{it.name}</Text>
                  <Text style={styles.exerciseGroup}>{it.muscle_group}</Text>
                </View>
                <TouchableOpacity style={styles.iconButton} onPress={() => setItems((l) => moveItem(l, index, -1))} accessibilityRole="button" accessibilityLabel={`Subir ${it.name}`}>
                  <ArrowUp color={colors.textSecondary} size={18} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setItems((l) => moveItem(l, index, 1))} accessibilityRole="button" accessibilityLabel={`Descer ${it.name}`}>
                  <ArrowDown color={colors.textSecondary} size={18} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setItems((l) => l.filter((x) => x.key !== it.key))} accessibilityRole="button" accessibilityLabel={`Remover ${it.name}`}>
                  <Trash2 color={colors.error} size={18} />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldsRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Reps mín.</Text>
                  <TextInput style={styles.smallInput} keyboardType="number-pad" maxLength={3} value={it.reps_min} onChangeText={(v) => update(it.key, { reps_min: v })} accessibilityLabel={`Repetições mínimas de ${it.name}`} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Reps máx.</Text>
                  <TextInput style={styles.smallInput} keyboardType="number-pad" maxLength={3} value={it.reps_max} onChangeText={(v) => update(it.key, { reps_max: v })} accessibilityLabel={`Repetições máximas de ${it.name}`} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Descanso</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity onPress={() => update(it.key, { rest_sec: clampRest(it.rest_sec - LIMITS.restStep) })} accessibilityRole="button" accessibilityLabel={`Diminuir descanso de ${it.name}`}>
                      <Minus color={colors.brand} size={18} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{formatClock(it.rest_sec)}</Text>
                    <TouchableOpacity onPress={() => update(it.key, { rest_sec: clampRest(it.rest_sec + LIMITS.restStep) })} accessibilityRole="button" accessibilityLabel={`Aumentar descanso de ${it.name}`}>
                      <Plus color={colors.brand} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {it.weights.map((w, setIndex) => (
                <View key={setIndex} style={styles.setRow}>
                  <Text style={styles.setLabel}>Série {setIndex + 1}</Text>
                  <TextInput
                    style={styles.weightInput}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    placeholder="—"
                    placeholderTextColor={colors.textSecondary}
                    value={w}
                    onChangeText={(v) => update(it.key, { weights: it.weights.map((x, i) => (i === setIndex ? v : x)) })}
                    accessibilityLabel={`Carga da série ${setIndex + 1} de ${it.name}`}
                  />
                  <Text style={styles.kg}>kg</Text>
                </View>
              ))}
              <View style={styles.setActions}>
                <TouchableOpacity
                  disabled={it.weights.length >= LIMITS.sets}
                  onPress={() => update(it.key, { weights: [...it.weights, it.weights[it.weights.length - 1] ?? ''] })}
                  accessibilityRole="button"
                >
                  <Text style={[styles.setAction, it.weights.length >= LIMITS.sets && styles.disabled]}>+ Série</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={it.weights.length <= 1}
                  onPress={() => update(it.key, { weights: it.weights.slice(0, -1) })}
                  accessibilityRole="button"
                >
                  <Text style={[styles.setAction, it.weights.length <= 1 && styles.disabled]}>− Série</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}

          {items.length < LIMITS.exercises && (
            <TouchableOpacity style={styles.addButton} onPress={() => setPickerOpen(true)} accessibilityRole="button">
              <Plus color={colors.brand} size={20} />
              <Text style={styles.addText}>Adicionar exercício</Text>
            </TouchableOpacity>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button title="Salvar rotina" loading={saving} onPress={save} />
          {routineId && <Button title="Excluir rotina" outline danger style={styles.deleteButton} onPress={() => setConfirmDelete(true)} />}
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(e) => {
          setItems((l) => [...l, newFormExercise(e)]);
          setPickerOpen(false);
        }}
      />
      <ConfirmModal
        visible={confirmDelete}
        title="Excluir rotina?"
        message="Ela sai da sua lista. O histórico de treinos continua."
        confirmLabel="Excluir"
        danger
        loading={saving}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
  );
}
```

`FrontEndTorv/src/screens/RoutineEditor/styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loading: { marginTop: 64 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22 },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  exerciseName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16 },
  exerciseGroup: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13 },
  iconButton: { padding: 8 },

  fieldsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  field: { flex: 1 },
  fieldLabel: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 12, marginBottom: 4 },
  smallInput: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  stepperValue: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },

  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  setLabel: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
  weightInput: {
    width: 88,
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    textAlign: 'right',
  },
  kg: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13 },
  setActions: { flexDirection: 'row', gap: 20, marginTop: 8 },
  setAction: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14 },
  disabled: { color: colors.textSecondary },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    marginBottom: 16,
  },
  addText: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 15 },
  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, marginBottom: 12 },
  deleteButton: { marginTop: 12 },
});
```

- [ ] **Step 3: Typecheck**

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Refinamento visual com `/frontend-design`**

Invocar o skill `frontend-design` sobre `ExercisePicker/styles.ts` e `RoutineEditor/styles.ts`: tema escuro de `src/theme/tokens.ts` (cores, `radius`, fontes Sora), coerente com Home/MyDiet, legível em 320 px de largura, alvos de toque ≥ 44 px. **Não mudar** lógica, textos, `accessibilityLabel`, limites nem handlers do `index.tsx` — só estilos e, se preciso, wrappers visuais. Rodar `npx tsc --noEmit` de novo.

- [ ] **Step 5: Commit**

```bash
git add -- FrontEndTorv/src/components/ExercisePicker FrontEndTorv/src/screens/RoutineEditor
git commit -m "feat(workouts): exercise picker and routine editor" -- FrontEndTorv/src/components/ExercisePicker FrontEndTorv/src/screens/RoutineEditor
```

---

### Task 7: Front — aba Treinos, navegação e card da Home

**Owner:** Torv Frontend (Lumen) — depois da Task 6.

**Files:**
- Create: `FrontEndTorv/src/screens/Workouts/index.tsx`, `styles.ts`
- Modify: `FrontEndTorv/src/routes/PrivateRoutes/index.tsx`
- Modify: `FrontEndTorv/src/screens/Home/index.tsx`

**Interfaces:**
- Consumes: Tasks 5–6.
- Produces: aba `Workouts` ("Treinos") entre Home e My Diet; pilha `Tabs` → `RoutineEditor` acima das abas; Home chama `GET /workouts/routines` ao focar (é o que dispara a geração do plano logo depois do login).

- [ ] **Step 1: Tela Treinos**

`FrontEndTorv/src/screens/Workouts/index.tsx`:

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Plus, Sparkles, Dumbbell, ChevronRight } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { workoutsApi, type RoutineList } from '../../services/workouts';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const REASONS: Record<string, string> = {
  fitness_level: 'Seu nível físico mudou',
  goals: 'Seu objetivo mudou',
  gender: 'Seus dados mudaram',
};

export default function Workouts() {
  const navigation = useNavigation<AppNavigation>();
  const [data, setData] = useState<RoutineList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await workoutsApi.listRoutines());
    } catch {
      setError('Não foi possível carregar seus treinos.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

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

  const suggestion = data?.plan_suggestion;
  const reasons = [...new Set((suggestion?.changed ?? []).map((k) => REASONS[k]).filter(Boolean))];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Treinos</Text>

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
            <TouchableOpacity
              key={r.id}
              onPress={() => navigation.navigate('RoutineEditor', { routineId: r.id })}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${r.name}`}
            >
              <Card style={[styles.routineCard, r.id === data.next_routine_id && styles.routineCardNext]}>
                <View style={styles.routineInfo}>
                  <View style={styles.tags}>
                    {r.id === data.next_routine_id && <Text style={styles.nextTag}>Próximo</Text>}
                    {r.is_default && <Text style={styles.defaultTag}>Padrão</Text>}
                  </View>
                  <Text style={styles.routineName}>{r.name}</Text>
                  <Text style={styles.routineMeta}>{r.exercise_count} exercícios · {r.set_count} séries</Text>
                </View>
                <ChevronRight color={colors.textSecondary} size={20} />
              </Card>
            </TouchableOpacity>
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

      <ConfirmModal
        visible={confirmRegenerate}
        title="Regerar treino padrão?"
        message="Suas rotinas padrão serão substituídas, inclusive edições. As rotinas que você criou não mudam."
        confirmLabel="Regerar"
        loading={busy}
        onConfirm={regenerate}
        onCancel={() => setConfirmRegenerate(false)}
      />
    </SafeAreaView>
  );
}
```

`FrontEndTorv/src/screens/Workouts/styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 120 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 32, marginBottom: 20 },
  loading: { marginTop: 32 },
  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, marginBottom: 16 },

  suggestionCard: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  suggestionReason: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 4 },
  bannerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  bannerButton: { flex: 1 },

  routineCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routineCardNext: { borderColor: colors.brand },
  routineInfo: { flex: 1 },
  tags: { flexDirection: 'row', gap: 6 },
  nextTag: { color: colors.background, backgroundColor: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 11, borderRadius: radius.pill, paddingHorizontal: 8, overflow: 'hidden' },
  defaultTag: { color: colors.textSecondary, borderColor: colors.border, borderWidth: 1, fontFamily: fontFamily.semiBold, fontSize: 11, borderRadius: radius.pill, paddingHorizontal: 8 },
  routineName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, marginTop: 6 },
  routineMeta: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2 },

  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
  },
  newText: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 16 },
});
```

- [ ] **Step 2: Navegação** — substituir `FrontEndTorv/src/routes/PrivateRoutes/index.tsx` inteiro (mesma tab bar de hoje; muda: aba Treinos, ícone com `minWidth: 64` / `paddingHorizontal: 12` pra caber 4 abas em 320 px, e a pilha por cima):

```tsx
import React from 'react';
import { View, Text, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, ClipboardList, User, Dumbbell } from 'lucide-react-native';

import { colors } from '../../theme/tokens';
import HomeScreen from '../../screens/Home';
import WorkoutsScreen from '../../screens/Workouts';
import MyDietScreen from '../../screens/MyDiet';
import ProfileScreen from '../../screens/Profile';
import RoutineEditorScreen from '../../screens/RoutineEditor';
import type { AppStackParamList, TabParamList } from '../types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

const TabIcon = ({ focused, icon: Icon, label, photoUrl }: any) => {
  return (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: focused ? 'rgba(140, 198, 63, 0.15)' : 'transparent',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      minWidth: 64,
    }}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: focused ? 2 : 0,
            borderColor: '#8CC63F'
          }}
        />
      ) : (
        <Icon color={focused ? colors.brand : colors.textSecondary} size={24} />
      )}
      <Text style={{
        color: focused ? colors.brand : colors.textSecondary,
        fontSize: 10,
        marginTop: 4,
        fontWeight: focused ? 'bold' : '500'
      }}>
        {label}
      </Text>
    </View>
  );
};

const Tabs = ({ user }: { user: any }) => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarIconStyle: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      tabBarStyle: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        elevation: 0,
        backgroundColor: 'rgba(28, 28, 30, 0.95)',
        borderRadius: 40,
        height: 64,
        borderTopWidth: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        paddingBottom: 0,
        paddingTop: 0,
      },
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={Home} label="Home" />,
      }}
    />
    <Tab.Screen
      name="Workouts"
      component={WorkoutsScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={Dumbbell} label="Treinos" />,
      }}
    />
    <Tab.Screen
      name="MyDiet"
      component={MyDietScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={ClipboardList} label="My Diet" />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={User} label="Profile" photoUrl={user?.photo_url} />,
      }}
    />
  </Tab.Navigator>
);

// Telas empilhadas acima das abas cobrem a tab bar.
export const PrivateRoutes = ({ user }: { user: any }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs">{() => <Tabs user={user} />}</Stack.Screen>
    <Stack.Screen name="RoutineEditor" component={RoutineEditorScreen} />
  </Stack.Navigator>
);
```

- [ ] **Step 3: Card "Treino de hoje" na Home** — em `FrontEndTorv/src/screens/Home/index.tsx`:

Import, depois de `import api from '../../services/api';`:

```tsx
import { workoutsApi } from '../../services/workouts';
```

Trocar:

```tsx
  const [remaining, setRemaining] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadDietSummary();
    }, [])
  );
```

por:

```tsx
  const [remaining, setRemaining] = useState(0);
  // undefined = carregando/erro; null = sem rotinas
  const [nextRoutine, setNextRoutine] = useState<{ id: string; name: string } | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      loadDietSummary();
      loadWorkout();
    }, [])
  );

  // 1ª chamada depois do login gera o treino padrão no backend.
  const loadWorkout = async () => {
    try {
      const list = await workoutsApi.listRoutines();
      setNextRoutine(list.routines.find((r) => r.id === list.next_routine_id) ?? null);
    } catch (error) {
      console.log('Failed to load workouts', error);
      setNextRoutine(undefined);
    }
  };
```

Trocar o card mock:

```tsx
          <Card style={styles.workoutCard}>
            <Text style={styles.workoutTitle}>Treino de hoje</Text>
            <Text style={styles.workoutValue}>Peito & Tríceps</Text>
            <TouchableOpacity style={styles.workoutAction}>
              <Play color={colors.brand} size={14} fill={colors.brand} />
              <Text style={styles.workoutActionText}>Iniciar</Text>
            </TouchableOpacity>
          </Card>
```

por:

```tsx
          <Card style={styles.workoutCard}>
            <Text style={styles.workoutTitle}>Treino de hoje</Text>
            <Text style={styles.workoutValue} numberOfLines={2}>
              {nextRoutine ? nextRoutine.name : nextRoutine === null ? 'Monte seu treino' : 'Treinos'}
            </Text>
            <TouchableOpacity style={styles.workoutAction} onPress={() => navigation.navigate('Workouts' as never)} accessibilityRole="button">
              <Play color={colors.brand} size={14} fill={colors.brand} />
              <Text style={styles.workoutActionText}>Ver treinos</Text>
            </TouchableOpacity>
          </Card>
```

- [ ] **Step 4: Typecheck**

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Refinamento visual com `/frontend-design`** em `Workouts/styles.ts` (mesmas regras da Task 6, Step 4). Conferir a tab bar com 4 abas em 320 px. `npx tsc --noEmit` de novo.

- [ ] **Step 6: Fumaça no Expo web** (Furnace e Expo web já rodando): login → Home mostra `Dia 1 — …` no card; aba Treinos lista as rotinas com **Próximo** na primeira e **Padrão** em todas; "Nova rotina" → adicionar exercício do catálogo → salvar → aparece na lista; criar exercício próprio no picker → aparece com tag **Meu**.

- [ ] **Step 7: Commit**

```bash
git add -- FrontEndTorv/src/screens/Workouts FrontEndTorv/src/routes/PrivateRoutes/index.tsx FrontEndTorv/src/screens/Home/index.tsx
git commit -m "feat(workouts): workouts tab, stack navigation and today's workout card" -- FrontEndTorv/src/screens/Workouts FrontEndTorv/src/routes/PrivateRoutes/index.tsx FrontEndTorv/src/screens/Home/index.tsx
```

---

### Task 8: Test — entrega 1 (review + API + usabilidade no navegador)

**Owner:** Torv Review and Tests (Loupe) — diff da entrega 1: `git diff main...feat/workout-module`.

**Relatório:** `docs/qa-workout-routines-2026-09-30.md` (rodadas seguintes: `-round2`, `-round3`…; nunca sobrescrever).

- [ ] **Step 1: Automatizado**

Run: `cd BackEndTorv && npm test` → todos passam. `cd FrontEndTorv && node --test src/utils/*.test.mjs && npx tsc --noEmit` → todos passam, sem erros.

- [ ] **Step 2: Contrato HTTP** (backend no Furnace; `fetch` via `maestri portal evaluate` com o token da página)

- Conta **nova** (cadastrar uma): disparar **dois** `GET /workouts/routines` em paralelo (`Promise.all`) → as duas respostas têm as mesmas rotinas e o total é exatamente o do plano (ex.: 3 para Iniciante), não o dobro. *(Review Focus 1)*
- Mesma conta: `GET` de novo → mesmas rotinas; apagar todas (`DELETE`) → `GET` → lista vazia (não regera).
- Conta Masculino/Avançado/Ganhar Massa → 5 rotinas com os exercícios da aba `Gerador` da planilha.
- `PUT /profile { fitness_level }` com outro nível → `GET /routines` traz `plan_suggestion: { has_suggestion: true, changed: ['fitness_level'] }`. Dois `POST /plan/accept` em paralelo → só um conjunto de rotinas default novo; rotinas próprias intactas. `POST /plan/accept` de novo sem mudança → nada muda. Mudar de novo + `POST /plan/dismiss` → `has_suggestion: false` até a próxima mudança. *(Review Focus 2)*
- IDOR com duas contas A e B: B faz `GET/PUT/DELETE /routines/<id de A>` → 404; B faz `PUT/DELETE /exercises/<exercício próprio de A>` → 404; B faz `PUT/DELETE /exercises/<id do catálogo>` → 404; B cria rotina com `exercise_id` próprio de A → 400 `exercise not found`; `GET /exercises` de B não lista os próprios de A.
- Limites: cada item da seção Validação da spec (nome em branco, 21 exercícios, 11 séries, reps 0/101/mín > máx, descanso 601, carga 1000, grupo inválido, id não-UUID) → 400.
- Excluir exercício próprio usado numa rotina → some da rotina (`GET /routines/:id`).

- [ ] **Step 3: Usabilidade no navegador** (portal Maestri em `localhost:8081`, 412x915; repetir os itens visuais em 320 de largura)

1. Login com conta nova → Home mostra o nome da 1ª rotina no card "Treino de hoje" → "Ver treinos" abre a aba Treinos.
2. Aba Treinos: selo **Próximo** na primeira, **Padrão** em todas; 4 abas cabem em 320 px.
3. Nova rotina: nome em branco → erro inline; adicionar 2 exercícios (um do catálogo com busca + chip de grupo, um próprio criado no picker); mudar reps, descanso (±15 s, mostra `m:ss`), cargas com vírgula; subir/descer; remover série; salvar → aparece na lista.
4. Editar a rotina → valores carregados iguais; excluir → confirmação → some.
5. Perfil → mudar nível → aba Treinos mostra o banner com "Seu nível físico mudou" → Regerar → confirmação → rotinas padrão novas, a própria continua. Repetir e escolher **Manter** → banner some e não volta ao refocar.
6. Console do navegador sem erros vermelhos durante os fluxos.

- [ ] **Step 4: Relatório** — pass/fail por item, e quais checagens foram só no navegador. Falha → volta pra Edit só na camada responsável; nova rodada com novo arquivo.

---

### Task 9: Security — entrega 1

**Owner:** Torv Security (Warden) — só depois da Task 8 100% verde.

**Relatório:** `docs/security-workout-routines-2026-09-30.md` (rodadas: `-round2`…).

- [ ] **Step 1: OWASP Top 10 no diff da entrega 1**, com atenção a:
  - IDOR/BOLA: toda query de `/workouts/*` filtra por `request.user.userId`; nada usa id de usuário vindo do cliente; exercício alheio não entra em rotina.
  - Mass assignment: `createRoutine`/`updateRoutine`/`createExercise` só gravam campos montados pelo controller (`is_default`, `owner_user_id`, `position` nunca vêm do corpo).
  - Integridade: `plan/accept` recalcula no servidor e ignora o corpo.
  - DoS lógico: limites de tamanho de rotina/nome aplicados antes do banco; `savePlan` com timeout de transação.
  - RLS e policy nas tabelas novas; nenhuma grant a `anon`/`authenticated`.
  - Erros 4xx/5xx sem stack nem detalhe do Prisma.
- [ ] **Step 2:** Falha → rework só na camada apontada; nova rodada da Task 8 (novo relatório) só sobre o que mudou.

**Entrega 1 pronta** quando Tasks 8 e 9 estiverem verdes na mesma rodada.

---

# Entrega 2 — Execução

### Task 10: Backend — sessões e contadores do Perfil

**Owner:** Torv Backend (Anvil) — depois da entrega 1 verde. Não precisa de migration (a da Task 1 já criou `workout_sets`, `activities.routine_id` e o índice parcial).

**Files:**
- Modify: `BackEndTorv/src/repository/workout.repository.js`, `BackEndTorv/src/controller/workout.controller.js`, `BackEndTorv/src/routes/workout.schemas.js`, `BackEndTorv/src/routes/workout.routes.js`
- Test: `BackEndTorv/src/routes/workout.sessions.test.js`
- Modify: `BackEndTorv/src/repository/profile.repository.js`, `BackEndTorv/src/controller/profile.controller.js`

**Interfaces:**
- Consumes: `checkSessionBody` (Task 3).
- Produces:
  - `POST /workouts/sessions` `{ routine_id?, started_at, duration_sec, sets: [{ exercise_id, position, set_number, duration_sec, rest_before_sec }] }` → 201 `{ activity_id }`; mesmo `started_at` já gravado → 200 `{ activity_id }` existente.
  - `GET /workouts/sessions?limit=` (1–50, padrão 10) → `{ sessions: [{ id, title, start_time, duration_sec, set_count }] }`.
  - `GET /workouts/sessions/:id` → `{ id, title, start_time, duration_sec, sets: [{ exercise_name, position, set_number, duration_sec, rest_before_sec }] }`.
  - `GET /profile`: `total_workouts` e `workouts_in_month` reais.

- [ ] **Step 1: Escrever os testes**

`BackEndTorv/src/routes/workout.sessions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const workoutRepository = require('../repository/workout.repository');

const ID = '22222222-2222-4222-8222-222222222222';
const EX = '33333333-3333-4333-8333-333333333333';
const ACT = '44444444-4444-4444-8444-444444444444';
const startedAt = new Date(Date.now() - 3600 * 1000).toISOString();
const validSession = {
  routine_id: ID,
  started_at: startedAt,
  duration_sec: 3000,
  sets: [
    { exercise_id: EX, position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null },
    { exercise_id: EX, position: 1, set_number: 2, duration_sec: 38, rest_before_sec: 125 },
  ],
};

async function build(t) {
  const app = Fastify();
  app.register(require('./workout.routes'), { prefix: '/workouts' });
  t.after(() => app.close());
  await app.ready();
  return app;
}

const call = (app, method, url, payload) => app.inject({ method, url, payload });

test('POST /sessions 201: grava com started_at como Date', async (t) => {
  t.mock.method(workoutRepository, 'findSessionByStart', async () => null);
  const create = t.mock.method(workoutRepository, 'createSession', async () => ACT);
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/sessions', validSession);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.json(), { activity_id: ACT });
  const [userId, data] = create.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.ok(data.started_at instanceof Date);
  assert.equal(data.started_at.toISOString(), startedAt);
  assert.equal(data.sets.length, 2);
});

test('POST /sessions repetido → 200 com o mesmo id, sem inserir', async (t) => {
  t.mock.method(workoutRepository, 'findSessionByStart', async () => ACT);
  const create = t.mock.method(workoutRepository, 'createSession', async () => 'outro');
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/sessions', validSession);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { activity_id: ACT });
  assert.equal(create.mock.callCount(), 0);
});

test('POST /sessions: corrida no índice único (P2002) → 200 com o id que ganhou', async (t) => {
  const find = t.mock.method(workoutRepository, 'findSessionByStart', async () => null);
  t.mock.method(workoutRepository, 'createSession', async () => {
    find.mock.mockImplementation(async () => ACT);
    throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
  });
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/sessions', validSession);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { activity_id: ACT });
});

test('POST /sessions 400: limites e datas', async (t) => {
  t.mock.method(workoutRepository, 'findSessionByStart', async () => null);
  const create = t.mock.method(workoutRepository, 'createSession', async () => ACT);
  const app = await build(t);
  const set = validSession.sets[0];
  const bad = [
    { started_at: '2025-12-31T23:59:59Z' },
    { started_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
    { started_at: 'ontem' },
    { duration_sec: 0 },
    { duration_sec: 21601 },
    { sets: [] },
    { sets: Array(201).fill(set) },
    { sets: [{ ...set, position: 21 }] },
    { sets: [{ ...set, set_number: 11 }] },
    { sets: [{ ...set, duration_sec: 3601 }] },
    { sets: [{ ...set, rest_before_sec: 7201 }] },
    { sets: [{ ...set, exercise_id: 'nope' }] },
    { routine_id: 'nope' },
  ];
  for (const override of bad) {
    const res = await call(app, 'POST', '/workouts/sessions', { ...validSession, ...override });
    assert.equal(res.statusCode, 400, JSON.stringify(override).slice(0, 80));
  }
  assert.equal(create.mock.callCount(), 0);
});

test('GET /sessions: limite padrão 10, máx 50; datas em ISO', async (t) => {
  const list = t.mock.method(workoutRepository, 'listSessions', async () => [
    { id: ACT, title: 'Dia 1 — Corpo todo A', start_time: new Date(startedAt), duration_sec: 3000, _count: { workout_sets: 2 } },
  ]);
  const app = await build(t);
  const res = await call(app, 'GET', '/workouts/sessions');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { sessions: [{ id: ACT, title: 'Dia 1 — Corpo todo A', start_time: startedAt, duration_sec: 3000, set_count: 2 }] });
  assert.deepEqual(list.mock.calls[0].arguments, [USER, 10]);
  await call(app, 'GET', '/workouts/sessions?limit=5');
  assert.equal(list.mock.calls[1].arguments[1], 5);
  assert.equal((await call(app, 'GET', '/workouts/sessions?limit=51')).statusCode, 400);
});

test('GET /sessions/:id: própria → séries; alheia → 404', async (t) => {
  const get = t.mock.method(workoutRepository, 'getSession', async () => ({
    id: ACT, title: 'Treino livre', start_time: new Date(startedAt), duration_sec: 3000,
    workout_sets: [{ exercise_name: 'Exercício removido', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null }],
  }));
  const app = await build(t);
  const res = await call(app, 'GET', `/workouts/sessions/${ACT}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().sets[0].exercise_name, 'Exercício removido');
  assert.deepEqual(get.mock.calls[0].arguments, [USER, ACT]);
  get.mock.mockImplementation(async () => null);
  assert.equal((await call(app, 'GET', `/workouts/sessions/${ACT}`)).statusCode, 404);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/routes/workout.sessions.test.js`
Expected: FAIL (404 nas rotas `/workouts/sessions`, ainda não registradas).

- [ ] **Step 3: Repository** — em `workout.repository.js`, adicionar dentro da classe, depois de `deleteExercise`:

```js
  async findSessionByStart(userId, startedAt) {
    const row = await prisma.activities.findFirst({
      where: { user_id: userId, activity_type: 'STRENGTH', start_time: startedAt },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  // Rotina/exercício que não é do usuário (ou foi apagado no meio do treino) não é vinculado nem
  // tem o nome exposto: vira "Treino livre" / "Exercício removido".
  async createSession(userId, { routine_id, started_at, duration_sec, sets }) {
    const ids = [...new Set(sets.map((s) => s.exercise_id))];
    const [routine, exercises] = await Promise.all([
      routine_id ? prisma.workout_routines.findFirst({ where: { id: routine_id, user_id: userId }, select: { id: true, name: true } }) : null,
      prisma.exercises.findMany({ where: { id: { in: ids }, ...visibleExercise(userId) }, select: { id: true, name: true } }),
    ]);
    const nameById = new Map(exercises.map((e) => [e.id, e.name]));

    return prisma.$transaction(async (tx) => {
      const activity = await tx.activities.create({
        data: {
          user_id: userId,
          activity_type: 'STRENGTH',
          title: routine?.name ?? 'Treino livre',
          start_time: started_at,
          duration_sec,
          routine_id: routine?.id ?? null,
        },
        select: { id: true },
      });
      await tx.workout_sets.createMany({
        data: sets.map((s) => ({
          activity_id: activity.id,
          exercise_id: nameById.has(s.exercise_id) ? s.exercise_id : null,
          exercise_name: nameById.get(s.exercise_id) ?? 'Exercício removido',
          position: s.position,
          set_number: s.set_number,
          duration_sec: s.duration_sec,
          rest_before_sec: s.rest_before_sec,
        })),
      });
      return activity.id;
    }, TX);
  }

  async listSessions(userId, limit) {
    return prisma.activities.findMany({
      where: { user_id: userId, activity_type: 'STRENGTH' },
      orderBy: { start_time: 'desc' },
      take: limit,
      select: { id: true, title: true, start_time: true, duration_sec: true, _count: { select: { workout_sets: true } } },
    });
  }

  async getSession(userId, id) {
    return prisma.activities.findFirst({
      where: { id, user_id: userId, activity_type: 'STRENGTH' },
      select: {
        id: true,
        title: true,
        start_time: true,
        duration_sec: true,
        workout_sets: {
          orderBy: [{ position: 'asc' }, { set_number: 'asc' }],
          select: { exercise_name: true, position: true, set_number: true, duration_sec: true, rest_before_sec: true },
        },
      },
    });
  }
```

- [ ] **Step 4: Schemas** — em `workout.schemas.js`, antes de `module.exports`:

```js
const SessionBody = Type.Object({
  routine_id: Type.Optional(Type.Union([Uuid, Type.Null()])),
  started_at: Type.String({ format: 'date-time' }),
  duration_sec: Type.Integer({ minimum: 1, maximum: 21600 }),
  sets: Type.Array(Type.Object({
    exercise_id: Uuid,
    position: Type.Integer({ minimum: 1, maximum: 20 }),
    set_number: Type.Integer({ minimum: 1, maximum: 10 }),
    duration_sec: Type.Integer({ minimum: 0, maximum: 3600 }),
    rest_before_sec: Type.Union([Type.Integer({ minimum: 0, maximum: 7200 }), Type.Null()]),
  }), { minItems: 1, maxItems: 200 }),
});

const SessionSummary = Type.Object({
  id: Type.String(),
  title: Type.String(),
  start_time: Type.String(),
  duration_sec: Type.Integer(),
  set_count: Type.Integer(),
});

const SessionDetail = Type.Object({
  id: Type.String(),
  title: Type.String(),
  start_time: Type.String(),
  duration_sec: Type.Integer(),
  sets: Type.Array(Type.Object({
    exercise_name: Type.String(),
    position: Type.Integer(),
    set_number: Type.Integer(),
    duration_sec: Type.Integer(),
    rest_before_sec: Type.Union([Type.Integer(), Type.Null()]),
  })),
});
```

e trocar o `module.exports` por:

```js
module.exports = {
  MUSCLE_GROUPS, errors, IdParams, RoutineBody, RoutineList, RoutineDetail,
  ExerciseBody, Exercise, SessionBody, SessionSummary, SessionDetail,
};
```

- [ ] **Step 5: Controller** — em `workout.controller.js`, trocar o import da validação por:

```js
const { checkRoutineBody, checkExerciseBody, checkSessionBody } = require('../lib/workoutValidation');
```

e adicionar dentro da classe, depois de `deleteExercise`:

```js
  // Idempotente por started_at: reenvio depois de falha de rede devolve 200 com o mesmo id,
  // sem inserir de novo (streak/ranking contam uma vez só).
  async createSession(request, reply) {
    const { userId } = request.user;
    const error = checkSessionBody(request.body);
    if (error) return reply.status(400).send({ error });
    const startedAt = new Date(request.body.started_at);

    const existing = await workoutRepository.findSessionByStart(userId, startedAt);
    if (existing) return reply.send({ activity_id: existing });
    try {
      const id = await workoutRepository.createSession(userId, { ...request.body, started_at: startedAt });
      return reply.status(201).send({ activity_id: id });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
      // Corrida: outra request com o mesmo started_at gravou entre o check e o insert.
      return reply.send({ activity_id: await workoutRepository.findSessionByStart(userId, startedAt) });
    }
  }

  async listSessions(request, reply) {
    const rows = await workoutRepository.listSessions(request.user.userId, request.query.limit ?? 10);
    return reply.send({
      sessions: rows.map((s) => ({
        id: s.id,
        title: s.title,
        start_time: s.start_time.toISOString(),
        duration_sec: s.duration_sec,
        set_count: s._count.workout_sets,
      })),
    });
  }

  async getSession(request, reply) {
    const s = await workoutRepository.getSession(request.user.userId, request.params.id);
    if (!s) return reply.status(404).send(NOT_FOUND);
    return reply.send({ id: s.id, title: s.title, start_time: s.start_time.toISOString(), duration_sec: s.duration_sec, sets: s.workout_sets });
  }
```

- [ ] **Step 6: Rotas** — em `workout.routes.js`, trocar o import dos schemas por:

```js
const {
  errors, IdParams, RoutineBody, RoutineList, RoutineDetail,
  ExerciseBody, Exercise, SessionBody, SessionSummary, SessionDetail,
} = require('./workout.schemas');
```

e adicionar no fim do plugin, depois da rota `DELETE /exercises/:id`:

```js
  fastify.post('/sessions', {
    schema: {
      description: 'Grava um treino finalizado. Mesmo started_at de novo → 200 com o id existente',
      tags, security, body: SessionBody,
      response: { 200: Type.Object({ activity_id: Type.String() }), 201: Type.Object({ activity_id: Type.String() }), ...errors(400, 401, 403) },
    },
  }, workoutController.createSession);

  fastify.get('/sessions', {
    schema: {
      tags, security,
      querystring: Type.Object({ limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })) }),
      response: { 200: Type.Object({ sessions: Type.Array(SessionSummary) }), ...errors(400, 401, 403) },
    },
  }, workoutController.listSessions);

  fastify.get('/sessions/:id', {
    schema: { tags, security, params: IdParams, response: { 200: SessionDetail, ...errors(400, 401, 403, 404) } },
  }, workoutController.getSession);
```

- [ ] **Step 7: Contadores do Perfil** — em `profile.repository.js`, trocar `getUserProfile` por:

```js
  // Queries em paralelo (1 RTT) em vez do include, que o Prisma roda em sequência. Mesmo shape do include.
  async getUserProfile(userId) {
    const now = new Date();
    // Mês corrente em UTC: mesmo critério de data do trigger de streak (start_time::date).
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const strength = { user_id: userId, activity_type: 'STRENGTH' };
    const [user, user_profiles, user_streaks, measurement, totalWorkouts, monthWorkouts] = await Promise.all([
      prisma.users.findUnique({ where: { id: userId } }),
      prisma.user_profiles.findUnique({ where: { user_id: userId } }),
      prisma.user_streaks.findUnique({ where: { user_id: userId } }),
      prisma.user_measurements.findFirst({ where: { user_id: userId }, orderBy: { recorded_at: 'desc' } }),
      prisma.activities.count({ where: strength }),
      prisma.activities.count({ where: { ...strength, start_time: { gte: monthStart } } }),
    ]);
    if (!user) return null;
    return {
      ...user,
      user_profiles,
      user_streaks,
      user_measurements: measurement ? [measurement] : [],
      workout_counts: { total: totalWorkouts, month: monthWorkouts },
    };
  }
```

Em `profile.controller.js` (`getProfile`), trocar `workouts_in_month: 0,` por `workouts_in_month: user.workout_counts.month,` e `total_workouts: 0,` por `total_workouts: user.workout_counts.total,`.

- [ ] **Step 8: Rodar tudo**

Run: `node --test src/routes/workout.sessions.test.js`
Expected: `pass 6`, `fail 0`.

Run: `npm test`
Expected: todos passam.

- [ ] **Step 9: Commit**

```bash
git add -- BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/routes/workout.sessions.test.js BackEndTorv/src/repository/profile.repository.js BackEndTorv/src/controller/profile.controller.js
git commit -m "feat(workouts): idempotent session logging, history and profile counters" -- BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/routes/workout.sessions.test.js BackEndTorv/src/repository/profile.repository.js BackEndTorv/src/controller/profile.controller.js
```

---

### Task 11: Front — máquina de estados, rascunho e logout

**Owner:** Torv Frontend (Lumen) — pode rodar junto da Task 10.

**Files:**
- Modify: `FrontEndTorv/package.json`, `FrontEndTorv/package-lock.json` (dependência nova)
- Modify: `FrontEndTorv/src/services/workouts.ts`
- Create: `FrontEndTorv/src/utils/workoutSession.ts`, `FrontEndTorv/src/utils/workoutDraft.ts`
- Test: `FrontEndTorv/src/utils/workoutSession.test.mjs`
- Modify: `FrontEndTorv/src/contexts/AuthContext.tsx`

**Interfaces:**
- Produces:
  - `workoutsApi.saveSession(body: SessionPayload)`, `listSessions(limit = 10)`, `getSession(id)`; tipos `SessionPayload`, `SessionSummary`, `SessionDetail`.
  - `SessionState`, `SessionExercise`, `DoneSet`, `Phase = 'ready' | 'set' | 'resting' | 'done'`; transições puras `(state, nowMs) → state`: `createSession(routine: RoutineDetail, now)`, `startSet`, `finishSet`, `skipSet`, `skipExercise`, `finish`; leituras `totalElapsedSec`, `phaseElapsedSec`, `isRestOverdue`; `toSessionPayload(state)` (já com os tetos 21600/3600/7200); `SummaryView`, `summaryFromState(state)`, `summaryFromDetail(detail)`.
  - `loadDraft(userId) → Promise<SessionState | null>`, `saveDraft(userId, state)`, `clearDraft(userId)`; chave `torv.workoutDraft.<userId>`.

- [ ] **Step 1: Dependência**

Run: `cd FrontEndTorv && npx expo install @react-native-async-storage/async-storage`
Expected: `@react-native-async-storage/async-storage` `2.2.0` (versão do SDK 57) em `package.json`.

- [ ] **Step 2: Escrever os testes** — `FrontEndTorv/src/utils/workoutSession.test.mjs`:

```js
// Roda com: node --test src/utils/workoutSession.test.mjs (Node 24 remove os tipos do .ts sozinho).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession, startSet, finishSet, skipSet, skipExercise, finish,
  totalElapsedSec, phaseElapsedSec, isRestOverdue, toSessionPayload,
  summaryFromState, summaryFromDetail,
} from './workoutSession.ts';

const T0 = Date.parse('2026-09-30T10:00:00Z');
const at = (sec) => T0 + sec * 1000;

const routine = {
  id: 'r1',
  name: 'Dia 1 — Corpo todo A',
  is_default: true,
  exercises: [
    { id: 're1', exercise_id: 'e1', name: 'Supino', muscle_group: 'Peito', position: 1, reps_min: 8, reps_max: 12, rest_sec: 120, sets: [{ set_number: 1, weight_kg: 40 }, { set_number: 2, weight_kg: null }] },
    { id: 're2', exercise_id: 'e2', name: 'Remada', muscle_group: 'Costas', position: 2, reps_min: 8, reps_max: 12, rest_sec: 60, sets: [{ set_number: 1, weight_kg: null }] },
  ],
};

test('createSession copia a rotina e começa em ready', () => {
  const s = createSession(routine, T0);
  assert.equal(s.phase, 'ready');
  assert.deepEqual(s.exercises[0].weights, [40, null]);
  assert.equal(s.started_at, T0);
  assert.deepEqual([s.exercise_index, s.set_index], [0, 0]);
});

test('fluxo completo: série → descanso → série, com tempos e alvo do descanso', () => {
  let s = createSession(routine, T0);
  s = startSet(s, at(5));
  assert.equal(s.phase, 'set');
  assert.equal(s.pending_rest_sec, null); // 1ª série: sem descanso antes

  s = finishSet(s, at(45));
  assert.equal(s.phase, 'resting');
  assert.equal(s.rest_target_sec, 120);
  assert.deepEqual([s.exercise_index, s.set_index], [0, 1]);
  assert.deepEqual(s.sets[0], { exercise_id: 'e1', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null, rest_target_sec: null });

  assert.equal(isRestOverdue(s, at(165)), false); // 120s exatos: ainda não estourou
  assert.equal(isRestOverdue(s, at(166)), true);
  assert.equal(phaseElapsedSec(s, at(166)), 121);

  s = startSet(s, at(225)); // descansou 180s (alvo 120)
  assert.equal(s.pending_rest_sec, 180);
  assert.equal(isRestOverdue(s, at(300)), false); // em série: nunca vermelho
  s = finishSet(s, at(260));
  assert.deepEqual(s.sets[1], { exercise_id: 'e1', position: 1, set_number: 2, duration_sec: 35, rest_before_sec: 180, rest_target_sec: 120 });

  // Último exercício de um: descanso conta contra o rest_sec do Supino (acabou de terminar).
  assert.equal(s.rest_target_sec, 120);
  assert.deepEqual([s.exercise_index, s.set_index], [1, 0]);
  s = startSet(s, at(320));
  s = finishSet(s, at(350));
  assert.equal(s.phase, 'done');
  assert.equal(s.finished_at, at(350));
  assert.equal(totalElapsedSec(s, at(9999)), 350); // congela no fim
});

test('ações fora de hora não mudam o estado', () => {
  const ready = createSession(routine, T0);
  assert.equal(finishSet(ready, at(1)), ready);
  const inSet = startSet(ready, at(1));
  assert.equal(startSet(inSet, at(2)), inSet);
  assert.equal(skipSet(inSet, at(2)), inSet);
  assert.equal(skipExercise(inSet, at(2)), inSet);
});

test('skipSet e skipExercise não gravam série e mantêm o descanso correndo', () => {
  let s = finishSet(startSet(createSession(routine, T0), at(0)), at(30));
  const restStart = s.phase_started_at;
  s = skipSet(s, at(40));
  assert.deepEqual([s.exercise_index, s.set_index], [1, 0]);
  assert.equal(s.phase, 'resting');
  assert.equal(s.phase_started_at, restStart);
  assert.equal(s.sets.length, 1);
  s = skipExercise(s, at(50));
  assert.equal(s.phase, 'done');
  assert.equal(s.finished_at, at(50));
});

test('finish no meio da série grava a série; em ready só fecha', () => {
  const inSet = startSet(createSession(routine, T0), at(10));
  const s = finish(inSet, at(40));
  assert.equal(s.phase, 'done');
  assert.equal(s.sets.length, 1);
  assert.equal(s.sets[0].duration_sec, 30);
  const empty = finish(createSession(routine, T0), at(5));
  assert.equal(empty.phase, 'done');
  assert.equal(empty.sets.length, 0);
});

test('toSessionPayload limita aos tetos do backend e tira rest_target_sec', () => {
  let s = startSet(createSession(routine, T0), at(0));
  s = finishSet(s, at(4000)); // série de 4000s
  s = startSet(s, at(4000 + 8000)); // descanso de 8000s
  s = finish(s, at(30000));
  const p = toSessionPayload(s);
  assert.equal(p.routine_id, 'r1');
  assert.equal(p.started_at, '2026-09-30T10:00:00.000Z');
  assert.equal(p.duration_sec, 21600);
  assert.equal(p.sets[0].duration_sec, 3600);
  assert.equal(p.sets[1].rest_before_sec, 7200);
  assert.equal('rest_target_sec' in p.sets[0], false);
});

test('resumo: agrupa por exercício, média de descanso e vermelho só no ao vivo', () => {
  let s = createSession(routine, T0);
  s = finishSet(startSet(s, at(0)), at(40));
  s = finishSet(startSet(s, at(220)), at(260)); // descanso 180 > 120
  s = finishSet(startSet(s, at(300)), at(330)); // descanso 40 < 120
  const live = summaryFromState(s);
  assert.equal(live.title, 'Dia 1 — Corpo todo A');
  assert.equal(live.total_sec, 330);
  assert.equal(live.set_count, 3);
  assert.equal(live.avg_rest_sec, 110);
  assert.deepEqual(live.groups.map((g) => g.name), ['Supino', 'Remada']);
  assert.deepEqual(live.groups[0].sets.map((x) => x.overdue), [false, true]);
  assert.equal(live.groups[1].sets[0].overdue, false);

  const history = summaryFromDetail({
    id: 'a1', title: 'Treino livre', start_time: '2026-09-30T10:00:00.000Z', duration_sec: 330,
    sets: [
      { exercise_name: 'Exercício removido', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null },
      { exercise_name: 'Exercício removido', position: 1, set_number: 2, duration_sec: 40, rest_before_sec: 500 },
    ],
  });
  assert.equal(history.groups.length, 1);
  assert.equal(history.groups[0].sets[1].overdue, false);
  assert.equal(history.avg_rest_sec, 500);
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test src/utils/workoutSession.test.mjs`
Expected: FAIL com `Cannot find module` para `workoutSession.ts`.

- [ ] **Step 4: Contrato da sessão** — em `services/workouts.ts`, antes de `export const workoutsApi`:

```ts
export interface SessionPayload {
  routine_id: string | null;
  started_at: string; // ISO
  duration_sec: number;
  sets: {
    exercise_id: string;
    position: number;
    set_number: number;
    duration_sec: number;
    rest_before_sec: number | null;
  }[];
}

export interface SessionSummary {
  id: string;
  title: string;
  start_time: string;
  duration_sec: number;
  set_count: number;
}

export interface SessionDetail {
  id: string;
  title: string;
  start_time: string;
  duration_sec: number;
  sets: {
    exercise_name: string;
    position: number;
    set_number: number;
    duration_sec: number;
    rest_before_sec: number | null;
  }[];
}
```

e no fim do objeto `workoutsApi`, depois de `deleteExercise`:

```ts
  saveSession: (body: SessionPayload) => api.post<{ activity_id: string }>('/workouts/sessions', body).then((r) => r.data),
  listSessions: (limit = 10) => api.get<{ sessions: SessionSummary[] }>(`/workouts/sessions?limit=${limit}`).then((r) => r.data.sessions),
  getSession: (id: string) => api.get<SessionDetail>(`/workouts/sessions/${id}`).then((r) => r.data),
```

- [ ] **Step 5: Máquina de estados** — `FrontEndTorv/src/utils/workoutSession.ts`:

```ts
import type { RoutineDetail, SessionDetail, SessionPayload } from '../services/workouts';

// Máquina de estados do treino em andamento. Pura (sem React nem I/O): o estado inteiro é o
// rascunho salvo no aparelho. Tempos saem de timestamps em ms, então continuam certos com a
// tela apagada ou o app em background.

export type Phase = 'ready' | 'set' | 'resting' | 'done';

export interface SessionExercise {
  exercise_id: string;
  name: string;
  muscle_group: string;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  weights: (number | null)[]; // carga de cada série; length = nº de séries
}

export interface DoneSet {
  exercise_id: string;
  position: number; // ordem do exercício no treino (1..)
  set_number: number; // 1..
  duration_sec: number;
  rest_before_sec: number | null; // null na 1ª série do treino
  rest_target_sec: number | null; // alvo desse descanso; só pro resumo (não vai pro servidor)
}

export interface SessionState {
  routine_id: string;
  routine_name: string;
  exercises: SessionExercise[];
  started_at: number;
  finished_at: number | null;
  phase: Phase;
  phase_started_at: number;
  exercise_index: number; // exercício da série em andamento ou da próxima
  set_index: number;
  rest_target_sec: number | null; // rest_sec do exercício cuja série acabou de terminar
  pending_rest_sec: number | null; // descanso medido antes da série em andamento
  sets: DoneSet[];
}

// Tetos do POST /workouts/sessions: rascunho retomado horas depois não pode prender o envio.
export const MAX_TOTAL_SEC = 21600;
export const MAX_SET_SEC = 3600;
export const MAX_REST_SEC = 7200;

const secondsBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / 1000));
const canSkip = (s: SessionState) => s.phase === 'ready' || s.phase === 'resting';

export function createSession(routine: RoutineDetail, now: number): SessionState {
  return {
    routine_id: routine.id,
    routine_name: routine.name,
    exercises: routine.exercises.map((e) => ({
      exercise_id: e.exercise_id,
      name: e.name,
      muscle_group: e.muscle_group,
      reps_min: e.reps_min,
      reps_max: e.reps_max,
      rest_sec: e.rest_sec,
      weights: e.sets.map((s) => s.weight_kg),
    })),
    started_at: now,
    finished_at: null,
    phase: 'ready',
    phase_started_at: now,
    exercise_index: 0,
    set_index: 0,
    rest_target_sec: null,
    pending_rest_sec: null,
    sets: [],
  };
}

// Próxima série depois de (e, s); null = não sobrou nenhuma.
function after(s: SessionState, e: number, set: number) {
  if (set + 1 < s.exercises[e].weights.length) return { exercise_index: e, set_index: set + 1 };
  if (e + 1 < s.exercises.length) return { exercise_index: e + 1, set_index: 0 };
  return null;
}

const done = (s: SessionState, now: number): SessionState =>
  ({ ...s, phase: 'done', finished_at: now, phase_started_at: now, pending_rest_sec: null });

// "Iniciar série" / "Acabou o descanso": fecha o descanso em curso.
export function startSet(s: SessionState, now: number): SessionState {
  if (!canSkip(s)) return s;
  return {
    ...s,
    phase: 'set',
    phase_started_at: now,
    pending_rest_sec: s.phase === 'resting' ? secondsBetween(s.phase_started_at, now) : null,
  };
}

// "Terminei a série": grava a série e abre o descanso contra o rest_sec deste exercício.
export function finishSet(s: SessionState, now: number): SessionState {
  if (s.phase !== 'set') return s;
  const ex = s.exercises[s.exercise_index];
  const sets = [...s.sets, {
    exercise_id: ex.exercise_id,
    position: s.exercise_index + 1,
    set_number: s.set_index + 1,
    duration_sec: secondsBetween(s.phase_started_at, now),
    rest_before_sec: s.pending_rest_sec,
    rest_target_sec: s.pending_rest_sec === null ? null : s.rest_target_sec,
  }];
  const next = after(s, s.exercise_index, s.set_index);
  if (!next) return done({ ...s, sets }, now);
  return { ...s, ...next, sets, phase: 'resting', phase_started_at: now, rest_target_sec: ex.rest_sec, pending_rest_sec: null };
}

// Pula a próxima série sem gravar; o descanso continua contando.
export function skipSet(s: SessionState, now: number): SessionState {
  if (!canSkip(s)) return s;
  const next = after(s, s.exercise_index, s.set_index);
  return next ? { ...s, ...next } : done(s, now);
}

// Pula as séries restantes do exercício atual.
export function skipExercise(s: SessionState, now: number): SessionState {
  if (!canSkip(s)) return s;
  const e = s.exercise_index + 1;
  return e < s.exercises.length ? { ...s, exercise_index: e, set_index: 0 } : done(s, now);
}

// "Finalizar treino": série em andamento conta como feita.
export function finish(s: SessionState, now: number): SessionState {
  if (s.phase === 'done') return s;
  const closed = s.phase === 'set' ? finishSet(s, now) : s;
  return closed.phase === 'done' ? closed : done(closed, now);
}

export const totalElapsedSec = (s: SessionState, now: number) => secondsBetween(s.started_at, s.finished_at ?? now);
export const phaseElapsedSec = (s: SessionState, now: number) => secondsBetween(s.phase_started_at, now);
export const isRestOverdue = (s: SessionState, now: number) =>
  s.phase === 'resting' && s.rest_target_sec !== null && phaseElapsedSec(s, now) > s.rest_target_sec;

export function toSessionPayload(s: SessionState): SessionPayload {
  return {
    routine_id: s.routine_id,
    started_at: new Date(s.started_at).toISOString(),
    duration_sec: Math.min(Math.max(totalElapsedSec(s, s.finished_at ?? s.started_at), 1), MAX_TOTAL_SEC),
    sets: s.sets.map((set) => ({
      exercise_id: set.exercise_id,
      position: set.position,
      set_number: set.set_number,
      duration_sec: Math.min(set.duration_sec, MAX_SET_SEC),
      rest_before_sec: set.rest_before_sec === null ? null : Math.min(set.rest_before_sec, MAX_REST_SEC),
    })),
  };
}

// Modelo único do resumo: treino recém-finalizado (rascunho) ou do histórico (servidor).
export interface SummaryView {
  title: string;
  total_sec: number;
  set_count: number;
  avg_rest_sec: number | null;
  groups: {
    name: string;
    sets: { set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean }[];
  }[];
}

function buildSummary(
  title: string,
  total_sec: number,
  sets: { position: number; name: string; set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean }[],
): SummaryView {
  const rests = sets.map((s) => s.rest_before_sec).filter((r): r is number => r !== null);
  const groups: SummaryView['groups'] = [];
  let lastPosition = -1;
  for (const { position, name, ...set } of sets) {
    if (position !== lastPosition) groups.push({ name, sets: [] });
    groups[groups.length - 1].sets.push(set);
    lastPosition = position;
  }
  return {
    title,
    total_sec,
    set_count: sets.length,
    avg_rest_sec: rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : null,
    groups,
  };
}

export const summaryFromState = (s: SessionState) =>
  buildSummary(s.routine_name, toSessionPayload(s).duration_sec, s.sets.map((set) => ({
    position: set.position,
    name: s.exercises[set.position - 1].name,
    set_number: set.set_number,
    duration_sec: set.duration_sec,
    rest_before_sec: set.rest_before_sec,
    overdue: set.rest_before_sec !== null && set.rest_target_sec !== null && set.rest_before_sec > set.rest_target_sec,
  })));

// Histórico não guarda o alvo do descanso: nada fica em vermelho.
export const summaryFromDetail = (d: SessionDetail) =>
  buildSummary(d.title, d.duration_sec, d.sets.map((set) => ({
    position: set.position,
    name: set.exercise_name,
    set_number: set.set_number,
    duration_sec: set.duration_sec,
    rest_before_sec: set.rest_before_sec,
    overdue: false,
  })));
```

- [ ] **Step 6: Rodar e ver passar**

Run: `node --test src/utils/workoutSession.test.mjs`
Expected: `pass 7`, `fail 0`.

- [ ] **Step 7: Rascunho** — `FrontEndTorv/src/utils/workoutDraft.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionState } from './workoutSession';

// Treino em andamento salvo no aparelho, por usuário. Sai após o servidor confirmar o
// POST /workouts/sessions, ao descartar e no logout (AuthContext).
const key = (userId: string) => `torv.workoutDraft.${userId}`;

export async function loadDraft(userId: string): Promise<SessionState | null> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    await AsyncStorage.removeItem(key(userId));
    return null;
  }
}

export const saveDraft = (userId: string, state: SessionState) => AsyncStorage.setItem(key(userId), JSON.stringify(state));

export const clearDraft = (userId: string) => AsyncStorage.removeItem(key(userId));
```

- [ ] **Step 8: Logout apaga o rascunho** — em `contexts/AuthContext.tsx`:

Import, depois de `import { getSession, setSession, clearSession, Session } from '../services/session';`:

```tsx
import { clearDraft } from '../utils/workoutDraft';
```

No `logout`, trocar:

```tsx
    await clearSession();
    setSigned(false);
    setUser(null);
  };
```

por:

```tsx
    // Treino em andamento não fica no aparelho depois do logout (aparelho compartilhado).
    if (user?.id) await clearDraft(user.id).catch(() => {});
    await clearSession();
    setSigned(false);
    setUser(null);
  };
```

(Expiração de token passa pelo `setOnSessionExpired`, que **não** apaga o rascunho: o mesmo usuário volta e continua.)

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 10: Commit**

```bash
git add -- FrontEndTorv/package.json FrontEndTorv/package-lock.json FrontEndTorv/src/services/workouts.ts FrontEndTorv/src/utils/workoutSession.ts FrontEndTorv/src/utils/workoutSession.test.mjs FrontEndTorv/src/utils/workoutDraft.ts FrontEndTorv/src/contexts/AuthContext.tsx
git commit -m "feat(workouts): session state machine, local draft and logout cleanup" -- FrontEndTorv/package.json FrontEndTorv/package-lock.json FrontEndTorv/src/services/workouts.ts FrontEndTorv/src/utils/workoutSession.ts FrontEndTorv/src/utils/workoutSession.test.mjs FrontEndTorv/src/utils/workoutDraft.ts FrontEndTorv/src/contexts/AuthContext.tsx
```

---

### Task 12: Front — WorkoutSession e WorkoutSummary

**Owner:** Torv Frontend (Lumen) — depois da Task 11.

**Files:**
- Create: `FrontEndTorv/src/screens/WorkoutSession/index.tsx`, `styles.ts`
- Create: `FrontEndTorv/src/screens/WorkoutSummary/index.tsx`, `styles.ts`
- Modify: `FrontEndTorv/src/routes/types.ts`, `FrontEndTorv/src/routes/PrivateRoutes/index.tsx`

**Interfaces:**
- Consumes: Task 11.
- Produces: `WorkoutSession` (params `{ routineId?: string; resume?: boolean }`; com `routineId` começa do zero e sobrescreve o rascunho; com `resume` carrega o rascunho); `WorkoutSummary` (params `{ sessionId?: string }`; sem id = treino recém-finalizado, envia o `POST`; com id = histórico).

- [ ] **Step 1: Tipos de navegação** — substituir `FrontEndTorv/src/routes/types.ts` inteiro:

```ts
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Workouts: undefined;
  MyDiet: undefined;
  Profile: undefined;
};

// Telas empilhadas sobre as abas (cobrem a tab bar).
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  RoutineEditor: { routineId?: string };
  WorkoutSession: { routineId?: string; resume?: boolean };
  WorkoutSummary: { sessionId?: string }; // sem sessionId: treino recém-finalizado (rascunho)
};

export type AppNavigation = NativeStackNavigationProp<AppStackParamList>;
```

- [ ] **Step 2: Registrar as telas** — em `routes/PrivateRoutes/index.tsx`, depois de `import RoutineEditorScreen from '../../screens/RoutineEditor';`:

```tsx
import WorkoutSessionScreen from '../../screens/WorkoutSession';
import WorkoutSummaryScreen from '../../screens/WorkoutSummary';
```

e depois de `<Stack.Screen name="RoutineEditor" component={RoutineEditorScreen} />`:

```tsx
    <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} options={{ gestureEnabled: false }} />
```

- [ ] **Step 3: WorkoutSession**

`FrontEndTorv/src/screens/WorkoutSession/index.tsx`:

```tsx
import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { X, SkipForward, ChevronsRight } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AuthContext } from '../../contexts/AuthContext';
import { workoutsApi } from '../../services/workouts';
import {
  createSession, startSet, finishSet, skipSet, skipExercise, finish,
  totalElapsedSec, phaseElapsedSec, isRestOverdue, type SessionState,
} from '../../utils/workoutSession';
import { formatClock } from '../../utils/clock';
import { loadDraft, saveDraft, clearDraft } from '../../utils/workoutDraft';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Transition = (s: SessionState, now: number) => SessionState;

export default function WorkoutSession() {
  const navigation = useNavigation<AppNavigation>();
  const { routineId, resume } = useRoute<RouteProp<AppStackParamList, 'WorkoutSession'>>().params ?? {};
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const [state, setState] = useState<SessionState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [confirmFinish, setConfirmFinish] = useState(false);

  // Carrega o rascunho (Continuar) ou começa a rotina do zero, sobrescrevendo qualquer rascunho.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const initial = resume
          ? await loadDraft(userId)
          : createSession(await workoutsApi.getRoutine(routineId as string), Date.now());
        if (!initial || initial.exercises.length === 0) {
          setError(initial ? 'Esta rotina não tem exercícios.' : 'Nenhum treino em andamento.');
          return;
        }
        if (initial.phase === 'done') {
          navigation.replace('WorkoutSummary', {});
          return;
        }
        if (!resume) await saveDraft(userId, initial);
        setState(initial);
      } catch {
        setError('Não foi possível abrir o treino.');
      }
    })();
  }, [userId, routineId, resume]);

  // Só redesenha; os tempos vêm dos timestamps do estado.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const apply = async (transition: Transition) => {
    if (!state || !userId) return;
    const next = transition(state, Date.now());
    if (next === state) return;
    setState(next);
    setNow(Date.now());
    // O resumo lê o rascunho: grava antes de navegar.
    await saveDraft(userId, next).catch(() => {});
    if (next.phase === 'done') navigation.replace('WorkoutSummary', {});
  };

  const discard = async () => {
    if (userId) await clearDraft(userId);
    setConfirmFinish(false);
    navigation.goBack();
  };

  if (!state) {
    return (
      <SafeAreaView style={styles.container}>
        {error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
            <Button title="Voltar" outline onPress={() => navigation.goBack()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        )}
      </SafeAreaView>
    );
  }

  const exercise = state.exercises[state.exercise_index];
  const weight = exercise.weights[state.set_index];
  const overdue = isRestOverdue(state, now);
  const elapsed = phaseElapsedSec(state, now);
  const nothingDone = state.sets.length === 0 && state.phase !== 'set';
  const upcoming = state.exercises.slice(state.exercise_index + 1);

  const mainLabel = state.phase === 'set'
    ? 'Terminei a série'
    : state.phase === 'resting'
      ? `Acabou o descanso — iniciar série ${state.set_index + 1}`
      : 'Iniciar série';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Sair do treino (continua salvo)">
          <X color={colors.textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={styles.routineName} numberOfLines={1}>{state.routine_name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.timers}>
          <View style={styles.timerBox}>
            <Text style={styles.timerLabel}>Total</Text>
            <Text style={styles.timerValue} accessibilityLabel={`Tempo total ${formatClock(totalElapsedSec(state, now))}`}>
              {formatClock(totalElapsedSec(state, now))}
            </Text>
          </View>
          <View style={[styles.timerBox, overdue && styles.timerBoxOverdue]}>
            <Text style={[styles.timerLabel, overdue && styles.overdueText]}>{state.phase === 'set' ? 'Série' : 'Descanso'}</Text>
            <Text style={[styles.timerValue, overdue && styles.overdueText]}>
              {state.phase === 'ready' ? '—' : formatClock(elapsed)}
            </Text>
            {state.phase === 'resting' && state.rest_target_sec !== null && (
              <Text style={[styles.timerTarget, overdue && styles.overdueText]}>alvo {formatClock(state.rest_target_sec)}</Text>
            )}
          </View>
        </View>

        <View style={styles.exerciseCard}>
          <Text style={styles.exerciseGroup}>{exercise.muscle_group}</Text>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.setInfo}>Série {state.set_index + 1} de {exercise.weights.length}</Text>
          <View style={styles.targets}>
            <Text style={styles.target}>{exercise.reps_min}–{exercise.reps_max} reps</Text>
            <Text style={styles.target}>{weight === null ? 'Sem carga' : `${weight} kg`}</Text>
          </View>
        </View>

        <Button title={mainLabel} onPress={() => apply(state.phase === 'set' ? finishSet : startSet)} style={styles.mainButton} />

        {state.phase !== 'set' && (
          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondary} onPress={() => apply(skipSet)} accessibilityRole="button">
              <SkipForward color={colors.textSecondary} size={18} />
              <Text style={styles.secondaryText}>Pular série</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => apply(skipExercise)} accessibilityRole="button">
              <ChevronsRight color={colors.textSecondary} size={18} />
              <Text style={styles.secondaryText}>Próximo exercício</Text>
            </TouchableOpacity>
          </View>
        )}

        {upcoming.length > 0 && (
          <View style={styles.upcoming}>
            <Text style={styles.upcomingTitle}>A seguir</Text>
            {upcoming.map((e, i) => (
              <Text key={`${e.exercise_id}-${i}`} style={styles.upcomingItem}>{e.name} · {e.weights.length} séries</Text>
            ))}
          </View>
        )}

        <Button title="Finalizar treino" outline danger onPress={() => setConfirmFinish(true)} />
      </ScrollView>

      <ConfirmModal
        visible={confirmFinish}
        title={nothingDone ? 'Descartar treino?' : 'Finalizar treino?'}
        message={nothingDone ? 'Nenhuma série foi feita. O treino será descartado.' : 'As séries feitas serão salvas no seu histórico.'}
        confirmLabel={nothingDone ? 'Descartar' : 'Finalizar'}
        danger={nothingDone}
        onConfirm={() => {
          if (nothingDone) {
            discard();
          } else {
            setConfirmFinish(false);
            apply(finish);
          }
        }}
        onCancel={() => setConfirmFinish(false)}
      />
    </SafeAreaView>
  );
}
```

`FrontEndTorv/src/screens/WorkoutSession/styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 64 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 15, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  routineName: { flex: 1, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  timers: { flexDirection: 'row', gap: 12 },
  timerBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center' },
  timerBoxOverdue: { borderColor: colors.error, backgroundColor: 'rgba(255, 69, 58, 0.12)' },
  timerLabel: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },
  timerValue: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 36, fontVariant: ['tabular-nums'], marginTop: 4 },
  timerTarget: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2 },
  overdueText: { color: colors.error },

  exerciseCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: colors.brand },
  exerciseGroup: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 13 },
  exerciseName: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24, marginTop: 4 },
  setInfo: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: 15, marginTop: 8 },
  targets: { flexDirection: 'row', gap: 16, marginTop: 8 },
  target: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },

  mainButton: { paddingVertical: 20 },
  secondaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  secondaryText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },

  upcoming: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 6 },
  upcomingTitle: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13, marginBottom: 2 },
  upcomingItem: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
});
```

- [ ] **Step 4: WorkoutSummary**

`FrontEndTorv/src/screens/WorkoutSummary/index.tsx`:

```tsx
import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { CheckCircle2 } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { AuthContext } from '../../contexts/AuthContext';
import { workoutsApi } from '../../services/workouts';
import { summaryFromDetail, summaryFromState, toSessionPayload, type SessionState, type SummaryView } from '../../utils/workoutSession';
import { formatClock } from '../../utils/clock';
import { loadDraft, clearDraft } from '../../utils/workoutDraft';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

// saving → saved | retry (rede/5xx: rascunho fica) | invalid (400: só descartar) | history (vindo do Perfil)
type Status = 'loading' | 'saving' | 'saved' | 'retry' | 'invalid' | 'history' | 'missing';

export default function WorkoutSummary() {
  const navigation = useNavigation<AppNavigation>();
  const { sessionId } = useRoute<RouteProp<AppStackParamList, 'WorkoutSummary'>>().params ?? {};
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const [summary, setSummary] = useState<SummaryView | null>(null);
  const [draft, setDraft] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const save = async (state: SessionState) => {
    if (!userId) return;
    setStatus('saving');
    try {
      await workoutsApi.saveSession(toSessionPayload(state));
      await clearDraft(userId);
      setStatus('saved');
    } catch (error) {
      setStatus(axios.isAxiosError(error) && error.response?.status === 400 ? 'invalid' : 'retry');
    }
  };

  useEffect(() => {
    (async () => {
      if (sessionId) {
        try {
          setSummary(summaryFromDetail(await workoutsApi.getSession(sessionId)));
          setStatus('history');
        } catch {
          setStatus('missing');
        }
        return;
      }
      if (!userId) return;
      const state = await loadDraft(userId);
      if (!state || state.phase !== 'done') {
        setStatus('missing');
        return;
      }
      setDraft(state);
      setSummary(summaryFromState(state));
      save(state);
    })();
  }, [sessionId, userId]);

  const discard = async () => {
    if (userId) await clearDraft(userId);
    navigation.popTo('Tabs', { screen: 'Workouts' });
  };

  if (status === 'loading' || !summary) {
    return (
      <SafeAreaView style={styles.container}>
        {status === 'missing' ? (
          <View style={styles.centered}>
            <Text style={styles.muted}>Treino não encontrado.</Text>
            <Button title="Voltar" outline onPress={() => navigation.goBack()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {status !== 'history' && (
          <View style={styles.hero}>
            <CheckCircle2 color={colors.brand} size={40} />
            <Text style={styles.heroTitle}>Treino concluído</Text>
          </View>
        )}
        <Text style={styles.title}>{summary.title}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatClock(summary.total_sec)}</Text>
            <Text style={styles.statLabel}>tempo total</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.set_count}</Text>
            <Text style={styles.statLabel}>séries</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.avg_rest_sec === null ? '—' : formatClock(summary.avg_rest_sec)}</Text>
            <Text style={styles.statLabel}>descanso médio</Text>
          </View>
        </View>

        {summary.groups.map((g, gi) => (
          <Card key={`${g.name}-${gi}`}>
            <Text style={styles.groupName}>{g.name}</Text>
            {g.sets.map((s) => (
              <View key={s.set_number} style={styles.setRow}>
                <Text style={styles.setLabel}>Série {s.set_number}</Text>
                <Text style={styles.setValue}>{formatClock(s.duration_sec)}</Text>
                <Text style={[styles.restValue, s.overdue && styles.overdue]}>
                  {s.rest_before_sec === null ? '—' : `descanso ${formatClock(s.rest_before_sec)}`}
                </Text>
              </View>
            ))}
          </Card>
        ))}

        {status === 'saving' && <ActivityIndicator color={colors.brand} />}
        {status === 'retry' && (
          <>
            <Text style={styles.error}>Não foi possível salvar. O treino continua guardado no aparelho.</Text>
            <Button title="Tentar de novo" onPress={() => draft && save(draft)} />
            <Button title="Voltar depois" outline onPress={() => navigation.popTo('Tabs', { screen: 'Workouts' })} />
          </>
        )}
        {status === 'invalid' && (
          <>
            <Text style={styles.error}>Não foi possível salvar este treino.</Text>
            <Button title="Descartar" danger onPress={discard} />
          </>
        )}
        {(status === 'saved' || status === 'history') && (
          <Button title="Concluir" onPress={() => (status === 'saved' ? navigation.popTo('Tabs', { screen: 'Workouts' }) : navigation.goBack())} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

`FrontEndTorv/src/screens/WorkoutSummary/styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 64 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 15, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 48, gap: 12 },
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  heroTitle: { color: colors.brand, fontFamily: fontFamily.extraBold, fontSize: 22 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, alignItems: 'center' },
  statValue: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2 },
  groupName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, marginBottom: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  setLabel: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
  setValue: { width: 64, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14, textAlign: 'right' },
  restValue: { width: 128, color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, textAlign: 'right' },
  overdue: { color: colors.error },
  error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 14, textAlign: 'center' },
});
```

- [ ] **Step 5: Typecheck**

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Refinamento visual com `/frontend-design`** em `WorkoutSession/styles.ts` e `WorkoutSummary/styles.ts` (mesmas regras da Task 6, Step 4). Na sessão: os dois cronômetros são o foco da tela, legíveis a um braço de distância; o estado vermelho usa `colors.error` e precisa ser inconfundível; botão principal grande (≥ 56 px de altura). `npx tsc --noEmit` de novo.

- [ ] **Step 7: Commit**

```bash
git add -- FrontEndTorv/src/screens/WorkoutSession FrontEndTorv/src/screens/WorkoutSummary FrontEndTorv/src/routes/types.ts FrontEndTorv/src/routes/PrivateRoutes/index.tsx
git commit -m "feat(workouts): workout session with total and rest timers, summary screen" -- FrontEndTorv/src/screens/WorkoutSession FrontEndTorv/src/screens/WorkoutSummary FrontEndTorv/src/routes/types.ts FrontEndTorv/src/routes/PrivateRoutes/index.tsx
```

---

### Task 13: Front — Treinos (rascunho e ▶), Home (Iniciar/Continuar) e Perfil (histórico)

**Owner:** Torv Frontend (Lumen) — depois da Task 12.

**Files:**
- Modify: `FrontEndTorv/src/screens/Workouts/index.tsx`, `styles.ts`
- Modify: `FrontEndTorv/src/screens/Home/index.tsx`
- Modify: `FrontEndTorv/src/screens/Profile/index.tsx`

- [ ] **Step 1: Treinos** — substituir `FrontEndTorv/src/screens/Workouts/index.tsx` inteiro (entra o banner "Treino em andamento" e o ▶ por rotina, escondido enquanto houver rascunho):

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
import { workoutsApi, type RoutineList } from '../../services/workouts';
import { loadDraft, clearDraft } from '../../utils/workoutDraft';
import type { SessionState } from '../../utils/workoutSession';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const REASONS: Record<string, string> = {
  fitness_level: 'Seu nível físico mudou',
  goals: 'Seu objetivo mudou',
  gender: 'Seus dados mudaram',
};

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

  const suggestion = data?.plan_suggestion;
  const reasons = [...new Set((suggestion?.changed ?? []).map((k) => REASONS[k]).filter(Boolean))];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Treinos</Text>

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
            <TouchableOpacity
              key={r.id}
              onPress={() => navigation.navigate('RoutineEditor', { routineId: r.id })}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${r.name}`}
            >
              <Card style={[styles.routineCard, r.id === data.next_routine_id && styles.routineCardNext]}>
                <View style={styles.routineInfo}>
                  <View style={styles.tags}>
                    {r.id === data.next_routine_id && <Text style={styles.nextTag}>Próximo</Text>}
                    {r.is_default && <Text style={styles.defaultTag}>Padrão</Text>}
                  </View>
                  <Text style={styles.routineName}>{r.name}</Text>
                  <Text style={styles.routineMeta}>{r.exercise_count} exercícios · {r.set_count} séries</Text>
                </View>
                {/* Com treino em andamento, só o banner continua/descarta: nada de 2 treinos ao mesmo tempo. */}
                {draft ? (
                  <ChevronRight color={colors.textSecondary} size={20} />
                ) : (
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => navigation.navigate('WorkoutSession', { routineId: r.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Iniciar ${r.name}`}
                  >
                    <Play color={colors.background} size={18} fill={colors.background} />
                  </TouchableOpacity>
                )}
              </Card>
            </TouchableOpacity>
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
    </SafeAreaView>
  );
}
```

Em `Workouts/styles.ts`, adicionar depois de `error: …,`:

```ts
  draftCard: { borderColor: colors.accentIntermediate },
  draftTitle: { color: colors.accentIntermediate, fontFamily: fontFamily.semiBold, fontSize: 13 },
  draftName: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 18, marginTop: 4 },
```

e depois de `routineMeta: …,`:

```ts
  playButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
```

- [ ] **Step 2: Home** — em `screens/Home/index.tsx`:

Imports: depois de `import { workoutsApi } from '../../services/workouts';` adicionar

```tsx
import { loadDraft } from '../../utils/workoutDraft';
import type { AppNavigation } from '../../routes/types';
```

e trocar `const navigation = useNavigation();` por `const navigation = useNavigation<AppNavigation>();`.

Trocar o bloco da Task 7:

```tsx
  const [remaining, setRemaining] = useState(0);
  // undefined = carregando/erro; null = sem rotinas
  const [nextRoutine, setNextRoutine] = useState<{ id: string; name: string } | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      loadDietSummary();
      loadWorkout();
    }, [])
  );

  // 1ª chamada depois do login gera o treino padrão no backend.
  const loadWorkout = async () => {
    try {
      const list = await workoutsApi.listRoutines();
      setNextRoutine(list.routines.find((r) => r.id === list.next_routine_id) ?? null);
    } catch (error) {
      console.log('Failed to load workouts', error);
      setNextRoutine(undefined);
    }
  };
```

por:

```tsx
  const [remaining, setRemaining] = useState(0);
  // undefined = carregando/erro; null = sem rotinas
  const [nextRoutine, setNextRoutine] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [hasDraft, setHasDraft] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDietSummary();
      loadWorkout();
    }, [user?.id])
  );

  // 1ª chamada depois do login gera o treino padrão no backend.
  const loadWorkout = async () => {
    try {
      const [list, draft] = await Promise.all([
        workoutsApi.listRoutines(),
        user?.id ? loadDraft(user.id) : Promise.resolve(null),
      ]);
      setNextRoutine(list.routines.find((r) => r.id === list.next_routine_id) ?? null);
      setHasDraft(!!draft);
    } catch (error) {
      console.log('Failed to load workouts', error);
      setNextRoutine(undefined);
    }
  };

  const onWorkoutPress = () => {
    if (hasDraft) navigation.navigate('WorkoutSession', { resume: true });
    else if (nextRoutine) navigation.navigate('WorkoutSession', { routineId: nextRoutine.id });
    else navigation.navigate('Workouts' as never);
  };
```

Trocar o card da Task 7:

```tsx
          <Card style={styles.workoutCard}>
            <Text style={styles.workoutTitle}>Treino de hoje</Text>
            <Text style={styles.workoutValue} numberOfLines={2}>
              {nextRoutine ? nextRoutine.name : nextRoutine === null ? 'Monte seu treino' : 'Treinos'}
            </Text>
            <TouchableOpacity style={styles.workoutAction} onPress={() => navigation.navigate('Workouts' as never)} accessibilityRole="button">
              <Play color={colors.brand} size={14} fill={colors.brand} />
              <Text style={styles.workoutActionText}>Ver treinos</Text>
            </TouchableOpacity>
          </Card>
```

por:

```tsx
          <Card style={styles.workoutCard}>
            <Text style={styles.workoutTitle}>Treino de hoje</Text>
            <Text style={styles.workoutValue} numberOfLines={2}>
              {hasDraft ? 'Treino em andamento' : nextRoutine ? nextRoutine.name : nextRoutine === null ? 'Monte seu treino' : 'Treinos'}
            </Text>
            <TouchableOpacity style={styles.workoutAction} onPress={onWorkoutPress} accessibilityRole="button">
              <Play color={colors.brand} size={14} fill={colors.brand} />
              <Text style={styles.workoutActionText}>{hasDraft ? 'Continuar treino' : nextRoutine ? 'Iniciar' : 'Ver treinos'}</Text>
            </TouchableOpacity>
          </Card>
```

- [ ] **Step 3: Perfil** — em `screens/Profile/index.tsx`:

No import do `lucide-react-native`, remover `Footprints` (deixa de ser usado).

Imports, depois de `import api from '../../services/api';`:

```tsx
import { workoutsApi, type SessionSummary } from '../../services/workouts';
import type { AppNavigation } from '../../routes/types';
```

Trocar `const navigation = useNavigation();` por `const navigation = useNavigation<AppNavigation>();`.

Antes de `export default function Profile`:

```tsx
const formatDayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
```

Depois de `const [profileData, setProfileData] = useState<any>(null);`:

```tsx
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
```

No `loadData`, trocar:

```tsx
          const [dietResponse, profileResponse] = await Promise.all([
            api.get('/diet/summary'),
            api.get('/profile'),
          ]);
```

por (histórico que falhar não derruba a tela):

```tsx
          const [dietResponse, profileResponse, recentSessions] = await Promise.all([
            api.get('/diet/summary'),
            api.get('/profile'),
            workoutsApi.listSessions(5).catch(() => [] as SessionSummary[]),
          ]);
          setSessions(recentSessions);
```

Trocar o mock de "Atividade Física":

```tsx
        {/* Mocked Activity */}
        <Card style={styles.listCard}>
          <View style={styles.listCardIconContainer}>
            <Footprints color={colors.brand} size={22} />
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>Caminhada</Text>
            <Text style={styles.listCardSubtitle}>07:15 · 32 min · 180kcal · via relógio</Text>
          </View>
        </Card>
```

por:

```tsx
        {sessions.length > 0 ? (
          sessions.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => navigation.navigate('WorkoutSummary', { sessionId: s.id })}
              accessibilityRole="button"
              accessibilityLabel={`Ver treino ${s.title}`}
            >
              <Card style={styles.listCard}>
                <View style={styles.listCardIconContainer}>
                  <Dumbbell color={colors.brand} size={22} />
                </View>
                <View style={styles.listCardContent}>
                  <Text style={styles.listCardTitle}>{s.title}</Text>
                  <Text style={styles.listCardSubtitle}>
                    {formatDayMonth(s.start_time)} · {Math.max(1, Math.round(s.duration_sec / 60))} min · {s.set_count} séries
                  </Text>
                </View>
                <ChevronRight color={colors.textSecondary} size={20} style={styles.listCardRight} />
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card style={styles.listCard}>
            <View style={styles.listCardIconContainer}>
              <Dumbbell color={colors.textSecondary} size={22} />
            </View>
            <View style={styles.listCardContent}>
              <Text style={styles.listCardTitle}>Nenhum treino ainda</Text>
              <Text style={styles.listCardSubtitle}>Seus treinos finalizados aparecem aqui.</Text>
            </View>
          </Card>
        )}
```

- [ ] **Step 4: Typecheck e testes**

Run: `cd FrontEndTorv && npx tsc --noEmit && node --test src/utils/*.test.mjs`
Expected: sem erros; `pass 14`, `fail 0`.

- [ ] **Step 5: Refinamento visual com `/frontend-design`** no banner de rascunho e no botão ▶ (`Workouts/styles.ts`), mesmas regras da Task 6, Step 4. `npx tsc --noEmit` de novo.

- [ ] **Step 6: Fumaça no Expo web:** Treinos → ▶ numa rotina → fazer 2 séries (ver o descanso ficar vermelho passando do alvo) → Finalizar → resumo salva → Perfil mostra o treino e "treinos"/"Este mês" = 1.

- [ ] **Step 7: Commit**

```bash
git add -- FrontEndTorv/src/screens/Workouts FrontEndTorv/src/screens/Home/index.tsx FrontEndTorv/src/screens/Profile/index.tsx
git commit -m "feat(workouts): start/resume from workouts tab and home, workout history on profile" -- FrontEndTorv/src/screens/Workouts FrontEndTorv/src/screens/Home/index.tsx FrontEndTorv/src/screens/Profile/index.tsx
```

---

### Task 14: Test — entrega 2 (review + API + usabilidade no navegador)

**Owner:** Torv Review and Tests (Loupe) — diff completo da branch.

**Relatório:** `docs/qa-workout-session-<AAAA-MM-DD>.md` (rodadas: `-round2`…).

- [ ] **Step 1: Automatizado** — `cd BackEndTorv && npm test`; `cd FrontEndTorv && node --test src/utils/*.test.mjs && npx tsc --noEmit`. Tudo verde.

- [ ] **Step 2: Contrato HTTP** (via portal)

- `POST /workouts/sessions` válido → 201; **o mesmo corpo de novo** → 200 com o mesmo `activity_id`; `GET /profile` → `total_workouts` subiu 1 e `streak` subiu no máximo 1 (não 2). *(Review Focus 3)*
- Duas chamadas iguais em paralelo (`Promise.all`) → mesmo `activity_id` nas duas.
- `routine_id` de rotina apagada → 201 com `title` "Treino livre"; `exercise_id` de exercício próprio apagado → série gravada como "Exercício removido". *(Review Focus 5)*
- IDOR: B envia sessão com `routine_id`/`exercise_id` de A → gravado sem vínculo ("Treino livre"/"Exercício removido"), nome de A não aparece; B faz `GET /sessions/<id de A>` → 404; `GET /sessions` de B não lista os de A.
- Limites: `started_at` antes de 2026-01-01 / 10 min no futuro / inválido, `duration_sec` 0 e 21601, 201 séries, série 3601, descanso 7201 → 400.
- `GET /sessions?limit=51` → 400; sem `limit` → até 10, mais recente primeiro.

- [ ] **Step 3: Usabilidade no navegador** (portal Maestri, 412x915; itens visuais também em 320)

1. Home: card mostra a próxima rotina → **Iniciar** abre a sessão; cronômetro Total corre.
2. Iniciar série → Terminei → descanso conta com o alvo (`alvo 1:00`); esperar passar do alvo → caixa e números **vermelhos**; "Acabou o descanso — iniciar série 2" → volta ao normal.
3. **Recarregar a página no meio de um descanso** → Treinos mostra "Treino em andamento" → Continuar → descanso continua do tempo original (não zera), vermelho se já passou. *(Review Focus 4)*
4. Pular série / Próximo exercício → não aparecem no resumo.
5. Durante o treino, em outra aba do portal (ou via `fetch`), excluir o exercício próprio usado → finalizar → resumo salva ("Exercício removido" no histórico). *(Review Focus 5)*
6. Finalizar → resumo com tempos e descanso estourado em vermelho → **Concluir** volta pra aba Treinos; a rotina seguinte ganhou o selo **Próximo**.
7. Perfil → "Atividade Física" lista o treino → abre o resumo do histórico (sem vermelho); contadores "treinos"/"Este mês" corretos.
8. Iniciar treino → Finalizar sem nenhuma série → confirmação "Descartar" → nada salvo.
9. Iniciar treino → logout → login de novo → sem banner de treino em andamento.
10. Backend parado (pedir ao Maestro pra parar o Furnace) ao finalizar → "Não foi possível salvar" + **Tentar de novo**; religar o Furnace → Tentar de novo → salva uma vez só.
11. Console do navegador sem erros vermelhos.

- [ ] **Step 4: Relatório** — pass/fail por item, checagens só-navegador anotadas. Falha → rework só na camada responsável; nova rodada, novo arquivo.

---

### Task 15: Security — entrega 2

**Owner:** Torv Security (Warden) — só depois da Task 14 100% verde.

**Relatório:** `docs/security-workout-session-<AAAA-MM-DD>.md`.

- [ ] **Step 1: OWASP Top 10 no diff da entrega 2**, com atenção a:
  - IDOR/BOLA em `/workouts/sessions*`; `routine_id`/`exercise_id` alheios nunca vinculados nem com nome exposto.
  - Integridade: `exercise_name` e `title` vêm só do banco; idempotência não permite sobrescrever sessão existente.
  - Dados no aparelho: rascunho só com dados de treino (sem token), apagado no logout; nada novo em `EXPO_PUBLIC_*`.
  - Dependência nova (`@react-native-async-storage/async-storage`): versão do SDK, sem vulnerabilidade conhecida (`npm audit` do front).
  - Erros sem stack nem detalhe do Prisma.
- [ ] **Step 2:** Falha → rework só na camada apontada; nova rodada da Task 14 só sobre o que mudou.

**Feature pronta** quando Tasks 14 e 15 estiverem verdes na mesma rodada. Depois: backend no Furnace, Expo pro celular do usuário e aprovação da branch pelo usuário.
