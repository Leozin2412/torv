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
