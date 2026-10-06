-- Postgres (Supabase) — documentation copy of the functions, views, triggers and
-- CHECK rules actually deployed. Source of truth: BackEndTorv/prisma/migrations/, refletindo
-- todas as migrations aplicadas até aqui:
--   20260915170948_init_postgres        - functions, views e triggers base
--   20260918165833_supabase_auth_link   - remove fn_register_new_user, adiciona handle_new_user
--   20260924171548_nutrition_targets_basis - só colunas, não mexe em function/trigger
--   20260925180000_lock_down_public_schema - revoga EXECUTE de PUBLIC/anon/authenticated (ver Gestao_e_Performance.sql, passo 1.3)
--   20260925210000_revoke_global_function_execute - tira o EXECUTE global de PUBLIC em functions novas (ver Gestao_e_Performance.sql, passo 1.3)
--   20260930200000_workout_module      - não mexe em function/trigger; CHECKs do módulo de treinos (ver "Regras (CHECKs)" no fim)
--   20261001150000_workout_generator_rules - idem: CHECKs de type/min_level/catálogo em exercises e de workout_template_slots
-- This file has no runtime effect; it exists for readability/presentation only.

--UDFs

--Calculo de consumo de calorias
CREATE OR REPLACE FUNCTION fn_get_consumed_calories(p_user_id uuid, p_target_date date)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_total int;
BEGIN
  SELECT COALESCE(SUM(calories), 0) INTO v_total
  FROM food_logs WHERE user_id = p_user_id AND logged_date = p_target_date;
  RETURN v_total;
END;
$$;


--Calculo idade para o TMB
CREATE OR REPLACE FUNCTION fn_calculate_age(p_birth_date date)
RETURNS int
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN DATE_PART('year', AGE(CURRENT_DATE, p_birth_date));
END;
$$;



--Views


--Metas diarias
CREATE VIEW vw_dashboard_user_stats AS
SELECT
  u.id AS user_id,
  p.name,
  p.username,
  p.photo_url,
  s.current_streak,
  s.longest_streak,
  nt.daily_calories AS goal_calories
FROM users u
INNER JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN user_streaks s ON u.id = s.user_id
LEFT JOIN nutrition_targets nt ON u.id = nt.user_id;

SELECT * FROM vw_dashboard_user_stats;

--"Gym rats"
CREATE VIEW vw_group_leaderboard AS
SELECT
  g.id AS group_id,
  g.name AS group_name,
  gr.total_points,
  p.name AS user_name,
  p.photo_url
FROM group_rankings gr
INNER JOIN groups g ON gr.group_id = g.id
INNER JOIN user_profiles p ON gr.user_id = p.user_id;

SELECT * FROM vw_group_leaderboard;



--Procedures
-- Note: Postgres has no stand-alone stored-procedure call syntax matching T-SQL's
-- EXEC — these are regular functions, invoked with SELECT (see
-- "Testes Procedures e Triggers.sql" for calling examples).

--Registro de User (via Supabase Auth)
-- fn_register_new_user foi REMOVIDA em 20260918165833_supabase_auth_link: ela
-- escrevia em users.password_hash, coluna que não existe mais. O cadastro agora
-- acontece no Supabase Auth, e esta trigger é quem cria as linhas do schema public
-- a partir do usuário recém-criado em auth.users.
--
-- SECURITY DEFINER porque a trigger roda no contexto do Auth, que não tem
-- privilégio de escrita nas tabelas de public; search_path fixo em public para a
-- função não poder ser sequestrada por um schema plantado no search_path de quem
-- dispara o INSERT.
-- Os dados de perfil chegam em auth.users.raw_user_meta_data (preenchido pelo app
-- no signUp). Sem username no metadata, gera um a partir do e-mail + 8 chars do id,
-- que é único por construção.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := NEW.raw_user_meta_data;
  final_username text;
BEGIN
  final_username := NULLIF(meta->>'username', '');
  IF final_username IS NULL THEN
    final_username := split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 8);
  END IF;

  INSERT INTO public.users (id, email, auth_provider, created_at)
  VALUES (NEW.id, NEW.email, 'email', now());

  INSERT INTO public.user_profiles (user_id, username, name, fitness_level, goal, birth_date, gender)
  VALUES (
    NEW.id,
    final_username,
    meta->>'name',
    meta->>'fitness_level',
    meta->>'goal',
    NULLIF(meta->>'birth_date', '')::date,
    meta->>'gender'
  );

  INSERT INTO public.user_measurements (id, user_id, weight_kg, height_cm)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NULLIF(meta->>'weight', '')::decimal,
    NULLIF(meta->>'height', '')::int
  );

  INSERT INTO public.user_streaks (user_id, current_streak, longest_streak)
  VALUES (NEW.id, 0, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

--Insert food log and return macro balance
CREATE OR REPLACE FUNCTION fn_log_food_and_return_remaining(
  p_user_id uuid, p_food_name varchar(255), p_calories int, p_macros_json text, p_date date
)
RETURNS TABLE(
  "GoalCalories" int, "ConsumedCalories" int, "RemainingCalories" int,
  "GoalProtein" int, "ConsumedProtein" int, "RemainingProtein" int,
  "GoalCarbs" int, "ConsumedCarbs" int, "RemainingCarbs" int,
  "GoalFat" int, "ConsumedFat" int, "RemainingFat" int
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO food_logs (user_id, food_name, calories, macros_json, logged_date)
  VALUES (p_user_id, p_food_name, p_calories, p_macros_json, p_date);

  -- Reuse the summary function to return the single source of truth balance
  RETURN QUERY SELECT * FROM fn_get_diet_summary(p_user_id, p_date);
END;
$$;

--Get full macro summary for a specific day
-- Column names are double-quoted to preserve exact PascalCase ("GoalCalories" etc.)
-- so BackEndTorv/src/controller/diet.controller.js's formatDietSummaryResponse
-- (which reads spResult.GoalCalories etc.) needs zero changes.
-- Note: preserves the original T-SQL's JSON_VALUE('$.protein')/('$.fat') key names
-- (singular) exactly, even though other parts of the app default macros_json to
-- {proteins, carbs, fats} (plural) — this is pre-existing behavior, not something
-- this migration fixes.
-- Fix applied during migration review: the goal-lookup below uses scalar
-- subqueries, not a plain `SELECT ... INTO ... FROM nutrition_targets WHERE ...`.
-- T-SQL's `SELECT @var = expr FROM ... WHERE ...` leaves @var unchanged on zero
-- matching rows, but PL/pgSQL's non-aggregate `SELECT ... INTO` sets the target to
-- NULL on zero rows instead — which would have silently defeated the intended
-- 2000/150/250/65 defaults for every user without a nutrition_targets row (i.e.
-- every brand-new user, since handle_new_user above doesn't create one).
-- Scalar subqueries always evaluate to exactly one value (NULL on no match), so
-- COALESCE works correctly here, the same way it already does for the
-- aggregate-based consumed-totals query below.
CREATE OR REPLACE FUNCTION fn_get_diet_summary(p_user_id uuid, p_date date)
RETURNS TABLE(
  "GoalCalories" int, "ConsumedCalories" int, "RemainingCalories" int,
  "GoalProtein" int, "ConsumedProtein" int, "RemainingProtein" int,
  "GoalCarbs" int, "ConsumedCarbs" int, "RemainingCarbs" int,
  "GoalFat" int, "ConsumedFat" int, "RemainingFat" int
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_goal_calories int := 2000;
  v_goal_protein int := 150;
  v_goal_carbs int := 250;
  v_goal_fat int := 65;
  v_consumed_calories int := 0;
  v_consumed_protein int := 0;
  v_consumed_carbs int := 0;
  v_consumed_fat int := 0;
BEGIN
  SELECT
    COALESCE((SELECT nt.daily_calories FROM nutrition_targets nt WHERE nt.user_id = p_user_id), 2000),
    COALESCE((SELECT nt.protein_g FROM nutrition_targets nt WHERE nt.user_id = p_user_id), 150),
    COALESCE((SELECT nt.carbs_g FROM nutrition_targets nt WHERE nt.user_id = p_user_id), 250),
    COALESCE((SELECT nt.fat_g FROM nutrition_targets nt WHERE nt.user_id = p_user_id), 65)
  INTO v_goal_calories, v_goal_protein, v_goal_carbs, v_goal_fat;

  SELECT
    COALESCE(SUM(fl.calories), 0),
    COALESCE(SUM((fl.macros_json::json->>'protein')::int), 0),
    COALESCE(SUM((fl.macros_json::json->>'carbs')::int), 0),
    COALESCE(SUM((fl.macros_json::json->>'fat')::int), 0)
  INTO v_consumed_calories, v_consumed_protein, v_consumed_carbs, v_consumed_fat
  FROM food_logs fl
  WHERE fl.user_id = p_user_id AND fl.logged_date = p_date;

  RETURN QUERY SELECT
    v_goal_calories, v_consumed_calories, (v_goal_calories - v_consumed_calories),
    v_goal_protein, v_consumed_protein, (v_goal_protein - v_consumed_protein),
    v_goal_carbs, v_consumed_carbs, (v_goal_carbs - v_consumed_carbs),
    v_goal_fat, v_consumed_fat, (v_goal_fat - v_consumed_fat);
END;
$$;



--Triggers
-- Not explicitly listed in this file's Task 9 brief (they're introduced in Task 7),
-- but included here for documentation completeness since this file already
-- documented triggers before the migration and this doc set must match what's
-- actually running.

--Analise Streak
CREATE OR REPLACE FUNCTION trg_fn_update_streak_on_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_activity_date date;
  v_last_activity date;
  v_current_streak int;
  v_longest_streak int;
BEGIN
  v_activity_date := (NEW.start_time)::date;

  SELECT last_activity, current_streak, longest_streak
  INTO v_last_activity, v_current_streak, v_longest_streak
  FROM user_streaks WHERE user_id = NEW.user_id;

  IF v_last_activity IS NULL OR (v_activity_date - v_last_activity) = 1 THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
  ELSIF (v_activity_date - v_last_activity) > 1 THEN
    v_current_streak := 1;
  END IF;

  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;

  UPDATE user_streaks
  SET current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_activity = v_activity_date
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_streak_on_activity
AFTER INSERT ON activities
FOR EACH ROW
EXECUTE FUNCTION trg_fn_update_streak_on_activity();

--Regras (CHECKs)
-- Regras de domínio que o banco garante para qualquer escritor (app, seed ou SQL
-- manual). Na migration elas nascem junto com a coluna/tabela; aqui ficam como
-- ALTER TABLE para ler num lugar só. Os CHECKs de user_measurements continuam
-- inline em "SQL BANCO DE DADOS.sql".

--Exercícios (20260930200000_workout_module + 20261001150000_workout_generator_rules)
-- Os 12 grupos musculares do app (mesma lista em workout_template_slots).
ALTER TABLE exercises ADD CONSTRAINT exercises_muscle_group_check CHECK (muscle_group IN ('Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior de coxa', 'Glúteos', 'Panturrilha', 'Abdômen', 'Lombar', 'Antebraço'));
-- Ou é do catálogo (slug) ou é próprio (owner_user_id), nunca os dois.
ALTER TABLE exercises ADD CONSTRAINT exercises_catalog_or_owned_check CHECK (slug IS NULL OR owner_user_id IS NULL);
ALTER TABLE exercises ADD CONSTRAINT exercises_type_check CHECK (type IN ('COMPOSTO', 'ISOLADO'));
ALTER TABLE exercises ADD CONSTRAINT exercises_min_level_check CHECK (min_level IN ('INICIANTE', 'INTERMEDIÁRIO', 'AVANÇADO'));
-- Catálogo (sem dono) tem type, min_level e catalog_order; exercício próprio tem os 3 NULL.
-- catalog_order também é único (exercises_catalog_order_key).
ALTER TABLE exercises ADD CONSTRAINT exercises_catalog_rules_check CHECK (
  (owner_user_id IS NULL AND type IS NOT NULL AND min_level IS NOT NULL AND catalog_order IS NOT NULL)
  OR (owner_user_id IS NOT NULL AND type IS NULL AND min_level IS NULL AND catalog_order IS NULL)
);

--Rotinas (20260930200000_workout_module)
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_reps_check CHECK (reps_min BETWEEN 1 AND 100 AND reps_max BETWEEN 1 AND 100 AND reps_min <= reps_max);
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_rest_sec_check CHECK (rest_sec BETWEEN 0 AND 600);
ALTER TABLE routine_exercise_sets ADD CONSTRAINT routine_exercise_sets_set_number_check CHECK (set_number BETWEEN 1 AND 10);
ALTER TABLE routine_exercise_sets ADD CONSTRAINT routine_exercise_sets_weight_kg_check CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 999.99);

--Treinos finalizados (20260930200000_workout_module)
-- rest_before_sec NULL = primeira série do treino. A idempotência do treino
-- (um STRENGTH por usuário + start_time) é o índice único parcial
-- activities_strength_user_start_key, em Gestao_e_Performance.sql, passo 2.4.
ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_duration_sec_check CHECK (duration_sec BETWEEN 0 AND 3600);
ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_rest_before_sec_check CHECK (rest_before_sec IS NULL OR rest_before_sec BETWEEN 0 AND 7200);

--Carga por série (20261002120000_loads_welcome)
ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_weight_kg_check CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 999.99);

--Slots do gerador de treino (20261001150000_workout_generator_rules)
ALTER TABLE workout_template_slots ADD CONSTRAINT workout_template_slots_day_check CHECK (day BETWEEN 1 AND days_per_week);
ALTER TABLE workout_template_slots ADD CONSTRAINT workout_template_slots_position_check CHECK (position >= 1);
ALTER TABLE workout_template_slots ADD CONSTRAINT workout_template_slots_muscle_group_check CHECK (muscle_group IN ('Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps', 'Posterior de coxa', 'Glúteos', 'Panturrilha', 'Abdômen', 'Lombar', 'Antebraço'));
ALTER TABLE workout_template_slots ADD CONSTRAINT workout_template_slots_type_check CHECK (type IN ('COMPOSTO', 'ISOLADO'));
ALTER TABLE workout_template_slots ADD CONSTRAINT workout_template_slots_min_level_check CHECK (min_level IN ('INICIANTE', 'INTERMEDIÁRIO', 'AVANÇADO'));
-- TODOS = vale para qualquer sexo; M/F/N = só para quem tem esse sexo no perfil.
ALTER TABLE workout_template_slots ADD CONSTRAINT workout_template_slots_sex_check CHECK (sex IN ('TODOS', 'M', 'F', 'N'));

--Grupos e competição (20261006120000_groups)
-- group_rankings é materializado e recalculado pelo backend (recomputeRanking); o trigger
-- antigo que somava +10 por atividade foi removido em 20261006120100_drop_group_points_trigger.
ALTER TABLE groups ADD CONSTRAINT groups_visibility_check CHECK (visibility IN ('PUBLIC', 'PRIVATE'));
ALTER TABLE groups ADD CONSTRAINT groups_period_check CHECK (ends_at IS NULL OR ends_at >= starts_at);
ALTER TABLE groups ADD CONSTRAINT groups_tz_offset_min_check CHECK (tz_offset_min BETWEEN -840 AND 840);
ALTER TABLE group_invitations ADD CONSTRAINT group_invitations_kind_check CHECK (kind IN ('INVITE', 'REQUEST'));
ALTER TABLE group_invitations ADD CONSTRAINT group_invitations_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED'));
