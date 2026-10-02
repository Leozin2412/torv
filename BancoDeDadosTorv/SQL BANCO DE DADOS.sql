-- Postgres (Supabase) — documentation copy of the schema actually deployed.
-- Source of truth: BackEndTorv/prisma/migrations/ - this file reflects ALL migrations
-- applied so far, in order:
--   20260915170948_init_postgres        - schema base
--   20260918165833_supabase_auth_link   - users passa a espelhar auth.users (Supabase Auth)
--   20260924171548_nutrition_targets_basis - basis_json / updated_at em nutrition_targets
--   20260925180000_lock_down_public_schema - privilégios + RLS (ver Gestao_e_Performance.sql, passo 1.3)
--   20260925210000_revoke_global_function_execute - tira o EXECUTE global de PUBLIC em functions novas (ver Gestao_e_Performance.sql, passo 1.3)
--   20260930200000_workout_module      - módulo de treinos: catálogo + exercícios próprios, rotinas com séries, treinos finalizados (workout_sets)
--   20261001150000_workout_generator_rules - regras do gerador de treino no banco (type/min_level/catalog_order + workout_template_slots)
--   20261002120000_loads_welcome       - carga por série (workout_sets.weight_kg) e boas-vindas (user_profiles.welcomed_at)
-- CHECKs ficam em "Regras BD.sql"; RLS e índices não-únicos em Gestao_e_Performance.sql.
-- This file has no runtime effect; it exists for readability/presentation only.
-- No CREATE DATABASE / USE statement here: Supabase already scopes a project to
-- one database, unlike SQL Server's multi-database-per-server model.

--Modulo User
-- users não gera mais o próprio id nem guarda senha: a identidade vive em
-- auth.users (Supabase Auth), e esta tabela só espelha o id dela (ver a FK
-- users_id_fkey mais abaixo e a trigger on_auth_user_created em "Regras BD.sql").
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
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
    gender VARCHAR(50),
    -- basis (nível, objetivos, sexo) da última geração/aceite do plano de treino
    -- default; comparar com o perfil atual gera a sugestão de novo plano.
    -- NULL = plano default nunca gerado.
    workout_plan_basis JSONB,
    -- momento em que a pessoa viu a mensagem de boas-vindas; NULL = ainda não viu
    welcomed_at TIMESTAMPTZ
);

-- Os CHECKs abaixo saíram do antigo authController.register e viraram regra do
-- banco, valendo para qualquer escritor (app, seed ou SQL manual).
CREATE TABLE user_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    weight_kg DECIMAL(5,2),
    height_cm INT,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_measurements_weight_kg_check CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 300)),
    CONSTRAINT user_measurements_height_cm_check CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250))
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
    distance_m DECIMAL(10,2),
    -- Rotina que originou o treino (activity_type = 'STRENGTH'); NULL = treino livre
    -- ou rotina apagada depois.
    routine_id UUID
);

CREATE TABLE activity_gps_data (
    activity_id UUID PRIMARY KEY,
    route_json TEXT
);


--Modulo Musuculação

-- day_of_week saiu em 20260930200000_workout_module: a ordem agora é position.
-- is_default = rotina criada pelo plano default (gerador de treino).
CREATE TABLE workout_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    position INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Catálogo global (slug preenchido, owner_user_id NULL) + exercícios próprios do
-- usuário (owner_user_id preenchido, slug NULL). O catálogo (71 exercícios) é
-- semeado pela migration 20260930200000_workout_module; type, min_level e
-- catalog_order (ordem de preferência do gerador) só existem no catálogo e são
-- preenchidos por 20261001150000_workout_generator_rules.
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    muscle_group VARCHAR(100) NOT NULL,
    slug VARCHAR(80),
    owner_user_id UUID,
    type VARCHAR(10),
    min_level VARCHAR(20),
    catalog_order SMALLINT
);

-- sets/reps saíram em 20260930200000_workout_module: reps viram faixa
-- (reps_min..reps_max) e cada série vira uma linha em routine_exercise_sets.
CREATE TABLE routine_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id UUID NOT NULL,
    exercise_id UUID NOT NULL,
    position INT NOT NULL,
    reps_min INT NOT NULL,
    reps_max INT NOT NULL,
    rest_sec INT NOT NULL
);

-- Carga por série do exercício na rotina (NULL = sem carga definida).
CREATE TABLE routine_exercise_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_exercise_id UUID NOT NULL,
    set_number INT NOT NULL,
    weight_kg DECIMAL(6,2)
);

-- Séries de um treino finalizado (activities.activity_type = 'STRENGTH'): tempos e carga;
-- exercise_name é cópia do nome no momento do treino (sobrevive ao exercício apagado).
CREATE TABLE workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL,
    exercise_id UUID,
    exercise_name VARCHAR(100) NOT NULL,
    position INT NOT NULL,
    set_number INT NOT NULL,
    duration_sec INT NOT NULL,
    rest_before_sec INT,
    weight_kg DECIMAL(6,2) -- NULL = sem carga (ou treino anterior a 20261002120000_loads_welcome)
);

-- Aba Sessoes do gerador de treino: os slots do plano default por frequência
-- semanal. position = ordem do slot dentro do dia (a ordem importa pro algoritmo).
-- Os 101 slots são semeados pela migration 20261001150000_workout_generator_rules.
CREATE TABLE workout_template_slots (
    days_per_week SMALLINT NOT NULL,
    day SMALLINT NOT NULL,
    session_name VARCHAR(50) NOT NULL,
    position SMALLINT NOT NULL,
    muscle_group VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL,
    min_level VARCHAR(20) NOT NULL,
    sex VARCHAR(5) NOT NULL,
    PRIMARY KEY (days_per_week, day, position)
);


--Modulo Nutrição

-- basis_json guarda os dados de perfil usados para calcular a meta salva
-- (idade, peso, altura, sexo, nível, objetivos); comparar esse retrato com os dados
-- atuais é o que dispara a sugestão de nova meta. updated_at marca a última
-- gravação da meta.
CREATE TABLE nutrition_targets (
    user_id UUID PRIMARY KEY,
    daily_calories INT,
    protein_g INT,
    carbs_g INT,
    fat_g INT,
    basis_json JSONB,
    updated_at TIMESTAMPTZ
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
CREATE UNIQUE INDEX exercises_slug_key ON exercises(slug);
CREATE UNIQUE INDEX exercises_catalog_order_key ON exercises(catalog_order);
CREATE UNIQUE INDEX routine_exercise_sets_routine_exercise_id_set_number_key ON routine_exercise_sets(routine_exercise_id, set_number);
-- O único parcial activities_strength_user_start_key (idempotência do treino) está
-- em Gestao_e_Performance.sql, passo 2.4.


-- Foreign keys
-- Names below match exactly what Prisma generated on the live database.

-- users.id tem que ser exatamente o id do dono em auth.users (Supabase Auth);
-- apagar o usuário no Auth apaga a linha aqui em cascata.
ALTER TABLE users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

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
ALTER TABLE activities ADD CONSTRAINT activities_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE activity_gps_data ADD CONSTRAINT activity_gps_data_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE workout_routines ADD CONSTRAINT workout_routines_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_routine_id_fkey FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- Apagar o usuário apaga os exercícios próprios dele (e, por cascata, as linhas de rotina).
ALTER TABLE exercises ADD CONSTRAINT exercises_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE routine_exercise_sets ADD CONSTRAINT routine_exercise_sets_routine_exercise_id_fkey FOREIGN KEY (routine_exercise_id) REFERENCES routine_exercises(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- SET NULL: o histórico do treino sobrevive ao exercício apagado (exercise_name guarda o nome).
ALTER TABLE workout_sets ADD CONSTRAINT workout_sets_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE nutrition_targets ADD CONSTRAINT nutrition_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE food_logs ADD CONSTRAINT food_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
