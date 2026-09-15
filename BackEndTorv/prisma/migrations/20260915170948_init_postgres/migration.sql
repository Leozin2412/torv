-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "auth_provider" VARCHAR(50),
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "fitness_level" VARCHAR(50),
    "goal" VARCHAR(100),
    "photo_url" VARCHAR(500),
    "birth_date" DATE,
    "gender" VARCHAR(50),

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_measurements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "weight_kg" DECIMAL(5,2),
    "height_cm" INTEGER,
    "recorded_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streaks" (
    "user_id" UUID NOT NULL,
    "current_streak" INTEGER DEFAULT 0,
    "longest_streak" INTEGER DEFAULT 0,
    "last_activity" DATE,

    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "follows" (
    "follower_id" UUID NOT NULL,
    "followed_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","followed_id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "period_type" VARCHAR(50),

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "group_rankings" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "total_points" INTEGER DEFAULT 0,
    "activities_count" INTEGER DEFAULT 0,

    CONSTRAINT "group_rankings_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "activity_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255),
    "start_time" TIMESTAMPTZ,
    "duration_sec" INTEGER,
    "calories" INTEGER,
    "distance_m" DECIMAL(10,2),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_gps_data" (
    "activity_id" UUID NOT NULL,
    "route_json" TEXT,

    CONSTRAINT "activity_gps_data_pkey" PRIMARY KEY ("activity_id")
);

-- CreateTable
CREATE TABLE "workout_routines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "day_of_week" VARCHAR(50),

    CONSTRAINT "workout_routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "muscle_group" VARCHAR(100),

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "routine_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "sets" INTEGER,
    "reps" INTEGER,

    CONSTRAINT "routine_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_targets" (
    "user_id" UUID NOT NULL,
    "daily_calories" INTEGER,
    "protein_g" INTEGER,
    "carbs_g" INTEGER,
    "fat_g" INTEGER,

    CONSTRAINT "nutrition_targets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "food_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "food_name" VARCHAR(255) NOT NULL,
    "calories" INTEGER NOT NULL,
    "macros_json" TEXT,
    "logged_date" DATE NOT NULL,

    CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_username_key" ON "user_profiles"("username");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_measurements" ADD CONSTRAINT "user_measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_id_fkey" FOREIGN KEY ("followed_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_rankings" ADD CONSTRAINT "group_rankings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_rankings" ADD CONSTRAINT "group_rankings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_gps_data" ADD CONSTRAINT "activity_gps_data_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_routines" ADD CONSTRAINT "workout_routines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "workout_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UDFs

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

CREATE OR REPLACE FUNCTION fn_calculate_age(p_birth_date date)
RETURNS int
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN DATE_PART('year', AGE(CURRENT_DATE, p_birth_date));
END;
$$;

-- Views

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

-- Diet summary (replaces sp_GetDietSummary)
-- Note: preserves the original T-SQL's JSON_VALUE('$.protein')/('$.fat') key names
-- (singular) exactly, even though other parts of the app default macros_json to
-- {proteins, carbs, fats} (plural) — this is pre-existing behavior, not something
-- this migration fixes.

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
  -- Fix (Task 6 review): T-SQL's `SELECT @var = expr FROM ... WHERE ...` leaves @var
  -- unchanged on zero matching rows, but PL/pgSQL's non-aggregate `SELECT ... INTO`
  -- sets the target to NULL on zero rows, silently defeating the COALESCE fallback
  -- and the declared defaults above. Scalar subqueries always evaluate to exactly
  -- one value (NULL on no match), so COALESCE works here the same way it already
  -- does for the aggregate-based consumed-totals query below.
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

-- Log food + return remaining (replaces sp_LogFoodAndReturnRemaining)

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

  RETURN QUERY SELECT * FROM fn_get_diet_summary(p_user_id, p_date);
END;
$$;

-- Register new user (replaces sp_RegisterNewUser)
-- Ported for BancoDeDadosTorv documentation parity only. auth.repository.js keeps
-- using Prisma's nested `create` (already transactional) — this function is not
-- called from BackEndTorv/src.

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
