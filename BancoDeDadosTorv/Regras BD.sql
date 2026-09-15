-- Postgres (Supabase) — documentation copy of the functions, views and triggers
-- actually deployed. Source of truth:
-- BackEndTorv/prisma/migrations/20260915170948_init_postgres/migration.sql
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

--Registro de User
-- Ported for documentation parity only. BackEndTorv/src/repository/auth.repository.js
-- keeps using Prisma's nested `create` (already transactional) for real signups —
-- this function is not called from BackEndTorv/src.
CREATE OR REPLACE FUNCTION fn_register_new_user(
  p_email varchar(255), p_password_hash varchar(255), p_username varchar(100), p_name varchar(100)
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO users (id, email, password_hash, auth_provider)
  VALUES (v_new_user_id, p_email, p_password_hash, 'email');

  INSERT INTO user_profiles (user_id, username, name)
  VALUES (v_new_user_id, p_username, p_name);

  INSERT INTO user_streaks (user_id, current_streak, longest_streak)
  VALUES (v_new_user_id, 0, 0);

  RETURN v_new_user_id;
END;
$$;

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
-- every brand-new user, since fn_register_new_user above doesn't create one).
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

--Add Points GymRats
CREATE OR REPLACE FUNCTION trg_fn_add_points_to_group_ranking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE group_rankings
  SET total_points = total_points + 10,
      activities_count = activities_count + 1
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_points_to_group_ranking
AFTER INSERT ON activities
FOR EACH ROW
EXECUTE FUNCTION trg_fn_add_points_to_group_ranking();
