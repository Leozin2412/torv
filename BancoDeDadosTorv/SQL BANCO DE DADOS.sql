-- Postgres (Supabase) — documentation copy of the schema actually deployed.
-- Source of truth: BackEndTorv/prisma/migrations/20260915170948_init_postgres/migration.sql
-- This file has no runtime effect; it exists for readability/presentation only.
-- No CREATE DATABASE / USE statement here: Supabase already scopes a project to
-- one database, unlike SQL Server's multi-database-per-server model.

--Modulo User
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    auth_provider VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    fitness_level VARCHAR(50),
    goal VARCHAR(100),
    photo_url VARCHAR(500),
    birth_date DATE,
    gender VARCHAR(50)
);

CREATE TABLE user_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    weight_kg DECIMAL(5,2),
    height_cm INT,
    recorded_at TIMESTAMPTZ DEFAULT now()
);



--Modulo Social
CREATE TABLE user_streaks (
    user_id UUID PRIMARY KEY,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_activity DATE
);

CREATE TABLE follows (
    follower_id UUID NOT NULL,
    followed_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id)
);

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    period_type VARCHAR(50)
);

CREATE TABLE group_members (
    group_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_rankings (
    group_id UUID NOT NULL,
    user_id UUID NOT NULL,
    total_points INT DEFAULT 0,
    activities_count INT DEFAULT 0,
    PRIMARY KEY (group_id, user_id)
);

--Modulo Tracking(Strava)

CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    start_time TIMESTAMPTZ,
    duration_sec INT,
    calories INT,
    distance_m DECIMAL(10,2)
);

CREATE TABLE activity_gps_data (
    activity_id UUID PRIMARY KEY,
    route_json TEXT
);


--Modulo Musuculação

CREATE TABLE workout_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    day_of_week VARCHAR(50)
);

CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    muscle_group VARCHAR(100)
);

CREATE TABLE routine_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL,
    exercise_id UUID NOT NULL,
    sets INT,
    reps INT
);


--Modulo Nutrição

CREATE TABLE nutrition_targets (
    user_id UUID PRIMARY KEY,
    daily_calories INT,
    protein_g INT,
    carbs_g INT,
    fat_g INT
);

CREATE TABLE food_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    food_name VARCHAR(255) NOT NULL,
    calories INT NOT NULL,
    macros_json TEXT,
    logged_date DATE NOT NULL
);


-- Unique constraints
-- Note: Prisma's `@unique` compiles to a standalone unique index, not an inline
-- UNIQUE column constraint (unlike the original SQL Server DDL) — matching that
-- here for accuracy.

CREATE UNIQUE INDEX users_email_key ON users(email);
CREATE UNIQUE INDEX user_profiles_username_key ON user_profiles(username);


-- Foreign keys
-- Names below match exactly what Prisma generated on the live database.

ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE user_measurements ADD CONSTRAINT user_measurements_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE user_streaks ADD CONSTRAINT user_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE follows ADD CONSTRAINT follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE group_members ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE group_members ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE group_rankings ADD CONSTRAINT group_rankings_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE group_rankings ADD CONSTRAINT group_rankings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE activities ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE activity_gps_data ADD CONSTRAINT activity_gps_data_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE workout_routines ADD CONSTRAINT workout_routines_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE nutrition_targets ADD CONSTRAINT nutrition_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE food_logs ADD CONSTRAINT food_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
