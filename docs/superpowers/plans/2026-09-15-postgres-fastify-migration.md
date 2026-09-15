# Postgres/Supabase + Fastify Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution note for this plan specifically:** the "subagents" are external agents on the Maestri canvas, not the internal Agent tool. The orchestrator (Claude Code, this session or a resumed one) dispatches each task's prompt via `maestri ask "<Agent Name>" "..."` (or `maestri ask --batch` for independent tasks), reviews the agent's diff/output between tasks exactly as subagent-driven-development prescribes for internal subagents, and only then marks the checkbox done and moves to the next task. Route by role: database tasks → **Cistern**, backend tasks → **Anvil**, security review → **Warden**, test/review pass → **Loupe**.

**Goal:** Migrate the torv database from SQL Server to Postgres (hosted on Supabase) and the backend from Express to Fastify, with the HTTP contract to the frontend left unchanged.

**Architecture:** Database first, backend second, both on a single `migration/postgres-fastify-supabase` branch. Business logic that lived in T-SQL stored procedures/triggers/UDFs is ported to equivalent Postgres plpgsql functions/triggers (not moved to the Node layer), so it stays enforced at the database level regardless of future hosting provider. `schema.prisma` stays the source of truth for tables; a hand-edited Prisma migration adds the functions/views/triggers/roles/indexes Prisma doesn't model natively.

**Tech Stack:** Postgres 17 (Supabase, project ref `figlsyikardnbfuykhxq`), Prisma 6, Fastify 4+, `@fastify/cors`, `@fastify/multipart`, `@fastify/static`, bcrypt, jsonwebtoken.

**Spec:** `docs/superpowers/specs/2026-09-15-postgres-fastify-migration-design.md`

## Global Constraints

- HTTP contract (routes, request/response JSON shapes) must stay identical to today — `FrontEndTorv/` gets zero code changes.
- No real data migration — fresh schema, mock/test data only.
- No adoption of Supabase Auth or Supabase Storage — keep bcrypt+JWT auth and local-disk photo storage (`profilePhotos/`, served at `/uploads`).
- Business logic (diet summary calculation, streak/points triggers, age calc) lives in Postgres as plpgsql functions/triggers, not in `BackEndTorv/src`.
- Database roles (`torv_api`, `torv_analyst`) are plain portable Postgres roles created via migration SQL — not Supabase-dashboard-specific configuration.
- `torv_api` gets its own freshly generated password, distinct from the Supabase `postgres` superuser password. Never write a real secret value into a file that gets committed to git (this plan included) — generate passwords at execution time and only place them in `BackEndTorv/.env` (gitignored) and the Maestri credentials note.
- `BackEndTorv/prisma/schema.prisma` datasource needs both `url` (pooled, port 6543, `pgbouncer=true`) and `directUrl` (direct, port 5432) — Supabase requires the direct connection for DDL/migrations.
- All work happens on branch `migration/postgres-fastify-supabase`; `backup/main-pre-postgres` is a frozen snapshot of `main` and never receives commits.
- Commit after every task.

---

## File Structure

| File | Change |
|---|---|
| `BackEndTorv/prisma/schema.prisma` | Modify — datasource provider + all field type annotations (SQL Server → Postgres) |
| `BackEndTorv/prisma/migrations/<timestamp>_init_postgres/migration.sql` | Create — table DDL (from `prisma migrate dev --create-only`) + hand-added functions/views/triggers/indexes/roles |
| `BancoDeDadosTorv/SQL BANCO DE DADOS.sql` | Modify — table DDL rewritten in Postgres syntax |
| `BancoDeDadosTorv/Regras BD.sql` | Modify — UDFs/views/procedures/triggers rewritten as plpgsql |
| `BancoDeDadosTorv/Gestao_e_Performance.sql` | Modify — roles/indexes rewritten for Postgres, `SHRINKDATABASE` section removed with a note |
| `BancoDeDadosTorv/Mock Dados.sql` | Modify — seed data rewritten for Postgres syntax |
| `BancoDeDadosTorv/Testes Procedures e Triggers.sql` | Modify — test queries updated to call the new plpgsql functions |
| `BackEndTorv/.env` | Create/modify locally (gitignored, not committed) — `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` |
| `BackEndTorv/package.json` | Modify — swap `express`/`cors`/`multer` for `fastify`/`@fastify/cors`/`@fastify/multipart`/`@fastify/static` |
| `BackEndTorv/server.js` | Rewrite — Fastify bootstrap |
| `BackEndTorv/src/middlewares/auth.middleware.js` | Rewrite — Fastify `preHandler` |
| `BackEndTorv/src/routes/auth.routes.js` | Rewrite — Fastify plugin |
| `BackEndTorv/src/routes/profile.routes.js` | Rewrite — Fastify plugin + multipart upload |
| `BackEndTorv/src/routes/diet.routes.js` | Rewrite — Fastify plugin |
| `BackEndTorv/src/controller/auth.controller.js` | Modify — `(req, res)` → `(request, reply)` |
| `BackEndTorv/src/controller/profile.controller.js` | Modify — `(req, res)` → `(request, reply)`, multipart file handling |
| `BackEndTorv/src/controller/diet.controller.js` | Modify — `(req, res)` → `(request, reply)` |
| `BackEndTorv/src/repository/diet.repository.js` | Modify — 2 raw queries: T-SQL `EXEC sp_...` → Postgres `SELECT * FROM fn_...(...)` |

---

### Task 1: Branches

**Files:** none (git operations only)

- [ ] **Step 1: Confirm `main` is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean` (untracked tooling dirs like `.claude/`, `.maestri/`, `graphify-out/`, `orchestration.md` are fine to leave untracked).

- [ ] **Step 2: Create the backup branch**

```bash
git branch backup/main-pre-postgres main
```

- [ ] **Step 3: Create and switch to the migration branch**

```bash
git checkout -b migration/postgres-fastify-supabase main
```

- [ ] **Step 4: Verify**

Run: `git branch -vv`
Expected: three branches listed, `migration/postgres-fastify-supabase` is the current one (`*`), `backup/main-pre-postgres` points at the same commit as `main`.

No commit for this task (nothing changed yet).

---

### Task 2: Environment file and Prisma datasource config

**Agent:** Cistern (Torv Database)

**Files:**
- Modify: `BackEndTorv/prisma/schema.prisma` (datasource block only)
- Create: `BackEndTorv/.env` (gitignored, local only)

**Interfaces:**
- Produces: `DATABASE_URL` and `DIRECT_URL` env vars that every later Prisma command in this plan relies on.

- [ ] **Step 1: Read the credentials note**

Run: `maestri note read "database-url-postgresql-pos"` to get the current `DATABASE_URL`/`DIRECT_URL` values (Supabase project ref `figlsyikardnbfuykhxq`, both using the `postgres` superuser for now — they get split in Task 8 once `torv_api` exists).

- [ ] **Step 2: Write `BackEndTorv/.env`**

```
DATABASE_URL="postgresql://postgres.figlsyikardnbfuykhxq:<password-from-note>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.figlsyikardnbfuykhxq:<password-from-note>@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="<keep existing value from the current .env if present, otherwise generate a new random 32+ char string>"
```

Replace `<password-from-note>` with the real password from the note. Do not paste it anywhere that gets committed.

- [ ] **Step 3: Update the datasource block in `schema.prisma`**

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- [ ] **Step 4: Verify connectivity**

Run: `cd BackEndTorv && npx prisma db execute --stdin <<< "SELECT 1;"`
Expected: command succeeds with no error (confirms both `.env` values and network/credentials are correct before any schema work starts).

- [ ] **Step 5: Commit**

```bash
git add BackEndTorv/prisma/schema.prisma
git commit -m "chore(db): point Prisma datasource at Postgres/Supabase"
```

(`.env` is gitignored — nothing to add there.)

---

### Task 3: Translate table schema to Postgres types

**Agent:** Cistern (Torv Database)

**Files:**
- Modify: `BackEndTorv/prisma/schema.prisma` (all models)

**Interfaces:**
- Consumes: datasource block from Task 2.
- Produces: final Postgres-typed Prisma schema that Task 4's migration is generated from. Model/field names are unchanged from today (`users`, `user_profiles`, `food_logs`, etc.) — only `@db.*` annotations and defaults change.

- [ ] **Step 1: Replace every model's type annotations**

Apply this mapping across the whole file:
- `@db.UniqueIdentifier` → `@db.Uuid`
- `@default(dbgenerated("NEWID()"))` → `@default(dbgenerated("gen_random_uuid()"))`
- `@db.NVarChar(n)` → `@db.VarChar(n)`
- `@db.NVarChar(Max)` → `@db.Text`
- `@db.DateTime2` → `@db.Timestamptz`
- `@default(dbgenerated("GETDATE()"))` → `@default(now())`
- `@db.Date` and `@db.Decimal(p, s)` stay unchanged (same types exist in Postgres)

Resulting full file:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

model users {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email             String              @unique @db.VarChar(255)
  password_hash     String              @db.VarChar(255)
  auth_provider     String?             @db.VarChar(50)
  created_at        DateTime?           @default(now()) @db.Timestamptz

  user_profiles     user_profiles?
  user_measurements user_measurements[]
  user_streaks      user_streaks?
  activities        activities[]
  workout_routines  workout_routines[]
  nutrition_targets nutrition_targets?
  food_logs         food_logs[]

  followers         follows[]           @relation("followed")
  following         follows[]           @relation("follower")
  group_members     group_members[]
  group_rankings    group_rankings[]
}

model user_profiles {
  user_id       String    @id @db.Uuid
  username      String    @unique @db.VarChar(100)
  name          String    @db.VarChar(100)
  fitness_level String?   @db.VarChar(50)
  goal          String?   @db.VarChar(100)
  photo_url     String?   @db.VarChar(500)
  birth_date    DateTime? @db.Date
  gender        String?   @db.VarChar(50)

  user          users     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model user_measurements {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String    @db.Uuid
  weight_kg   Decimal?  @db.Decimal(5, 2)
  height_cm   Int?
  recorded_at DateTime? @default(now()) @db.Timestamptz

  user        users     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model user_streaks {
  user_id         String    @id @db.Uuid
  current_streak  Int?      @default(0)
  longest_streak  Int?      @default(0)
  last_activity   DateTime? @db.Date

  user            users     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model follows {
  follower_id String    @db.Uuid
  followed_id String    @db.Uuid
  created_at  DateTime? @default(now()) @db.Timestamptz

  follower    users     @relation("follower", fields: [follower_id], references: [id], onUpdate: NoAction)
  followed    users     @relation("followed", fields: [followed_id], references: [id], onUpdate: NoAction)

  @@id([follower_id, followed_id])
}

model groups {
  id             String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name           String           @db.VarChar(100)
  period_type    String?          @db.VarChar(50)
  group_members  group_members[]
  group_rankings group_rankings[]
}

model group_members {
  group_id   String    @db.Uuid
  user_id    String    @db.Uuid
  joined_at  DateTime? @default(now()) @db.Timestamptz

  group      groups    @relation(fields: [group_id], references: [id], onDelete: Cascade)
  user       users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([group_id, user_id])
}

model group_rankings {
  group_id         String @db.Uuid
  user_id          String @db.Uuid
  total_points     Int?   @default(0)
  activities_count Int?   @default(0)

  group            groups @relation(fields: [group_id], references: [id], onDelete: Cascade)
  user             users  @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([group_id, user_id])
}

model activities {
  id                String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id           String             @db.Uuid
  activity_type     String             @db.VarChar(50)
  title             String?            @db.VarChar(255)
  start_time        DateTime?          @db.Timestamptz
  duration_sec      Int?
  calories          Int?
  distance_m        Decimal?           @db.Decimal(10, 2)

  user              users              @relation(fields: [user_id], references: [id], onDelete: Cascade)
  activity_gps_data activity_gps_data?
}

model activity_gps_data {
  activity_id String     @id @db.Uuid
  route_json  String?    @db.Text

  activity    activities @relation(fields: [activity_id], references: [id], onDelete: Cascade)
}

model workout_routines {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id           String              @db.Uuid
  name              String              @db.VarChar(100)
  day_of_week       String?             @db.VarChar(50)

  user              users               @relation(fields: [user_id], references: [id], onDelete: Cascade)
  routine_exercises routine_exercises[]
}

model exercises {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name              String              @db.VarChar(100)
  muscle_group      String?             @db.VarChar(100)

  routine_exercises routine_exercises[]
}

model routine_exercises {
  id          String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  routine_id  String           @db.Uuid
  exercise_id String           @db.Uuid
  sets        Int?
  reps        Int?

  routine     workout_routines @relation(fields: [routine_id], references: [id], onDelete: Cascade)
  exercise    exercises        @relation(fields: [exercise_id], references: [id], onDelete: Cascade)
}

model nutrition_targets {
  user_id        String @id @db.Uuid
  daily_calories Int?
  protein_g      Int?
  carbs_g        Int?
  fat_g          Int?

  user           users  @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model food_logs {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String   @db.Uuid
  food_name   String   @db.VarChar(255)
  calories    Int
  macros_json String?  @db.Text
  logged_date DateTime @db.Date

  user        users    @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Validate the schema**

Run: `cd BackEndTorv && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Commit**

```bash
git add BackEndTorv/prisma/schema.prisma
git commit -m "feat(db): translate schema.prisma types from SQL Server to Postgres"
```

---

### Task 4: Generate and apply the base table migration

**Agent:** Cistern (Torv Database)

**Files:**
- Create: `BackEndTorv/prisma/migrations/<timestamp>_init_postgres/migration.sql` (generated, then this task only verifies it — Tasks 5-8 append to it)

**Interfaces:**
- Consumes: `schema.prisma` from Task 3, `DIRECT_URL`/`DATABASE_URL` from Task 2.
- Produces: all 15 tables live on the Supabase Postgres instance, matching the Prisma schema.

- [ ] **Step 1: Generate the migration without applying it**

```bash
cd BackEndTorv && npx prisma migrate dev --name init_postgres --create-only
```

This creates `prisma/migrations/<timestamp>_init_postgres/migration.sql` with `CREATE TABLE` statements for all 15 models plus their foreign keys — pure Prisma output, no manual edits yet.

- [ ] **Step 2: Apply it**

```bash
npx prisma migrate deploy
```

Expected: output ends with `All migrations have been successfully applied.`

- [ ] **Step 3: Verify tables exist**

Run: `npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"`
Expected: 15 rows — `activities, activity_gps_data, exercises, follows, food_logs, group_members, group_rankings, groups, nutrition_targets, routine_exercises, user_measurements, user_profiles, user_streaks, users, workout_routines`.

- [ ] **Step 4: Commit**

```bash
git add BackEndTorv/prisma/migrations
git commit -m "feat(db): apply base Postgres table migration"
```

---

### Task 5: Add UDFs and views

**Agent:** Cistern (Torv Database)

**Files:**
- Modify: `BackEndTorv/prisma/migrations/<timestamp>_init_postgres/migration.sql` (append to the same migration file from Task 4, since the schema is still fresh/unapplied-elsewhere — do not create a second migration for a same-session addition)

**Interfaces:**
- Consumes: tables from Task 4.
- Produces: `fn_get_consumed_calories(uuid, date) → int`, `fn_calculate_age(date) → int`, views `vw_dashboard_user_stats`, `vw_group_leaderboard`.

- [ ] **Step 1: Append the SQL below to the end of the migration file**

```sql
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
```

- [ ] **Step 2: Re-apply**

```bash
npx prisma migrate deploy
```

- [ ] **Step 3: Verify**

Run: `npx prisma db execute --stdin <<< "SELECT fn_calculate_age('2000-01-01'); SELECT * FROM vw_dashboard_user_stats LIMIT 1;"`
Expected: first query returns an integer age (~26 in 2026), second returns no rows without error (table is empty, but the view resolves).

- [ ] **Step 4: Commit**

```bash
git add BackEndTorv/prisma/migrations
git commit -m "feat(db): add fn_get_consumed_calories, fn_calculate_age, and dashboard/leaderboard views"
```

---

### Task 6: Add diet-summary functions (replacing the stored procedures)

**Agent:** Cistern (Torv Database)

**Files:**
- Modify: `BackEndTorv/prisma/migrations/<timestamp>_init_postgres/migration.sql` (append)

**Interfaces:**
- Consumes: `food_logs`, `nutrition_targets` tables from Task 4.
- Produces: `fn_get_diet_summary(uuid, date) → TABLE(...)`, `fn_log_food_and_return_remaining(uuid, text, int, text, date) → TABLE(...)`, `fn_register_new_user(text, text, text, text) → uuid`. Column names are double-quoted to preserve exact PascalCase (`"GoalCalories"`, etc.) so `BackEndTorv/src/controller/diet.controller.js`'s `formatDietSummaryResponse` (which reads `spResult.GoalCalories` etc.) needs zero changes.

- [ ] **Step 1: Append the SQL below**

```sql
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
  SELECT COALESCE(nt.daily_calories, 2000), COALESCE(nt.protein_g, 150),
         COALESCE(nt.carbs_g, 250), COALESCE(nt.fat_g, 65)
  INTO v_goal_calories, v_goal_protein, v_goal_carbs, v_goal_fat
  FROM nutrition_targets nt WHERE nt.user_id = p_user_id;

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
```

- [ ] **Step 2: Re-apply**

```bash
npx prisma migrate deploy
```

- [ ] **Step 3: Verify with a throwaway row**

```bash
npx prisma db execute --stdin <<'EOF'
SELECT fn_register_new_user('smoke@test.local', 'x', 'smoketest', 'Smoke Test');
SELECT * FROM fn_get_diet_summary(
  (SELECT id FROM users WHERE email = 'smoke@test.local'), CURRENT_DATE
);
DELETE FROM users WHERE email = 'smoke@test.local';
EOF
```

Expected: the `fn_get_diet_summary` call returns one row with `GoalCalories = 2000`, `ConsumedCalories = 0`, `RemainingCalories = 2000` (defaults, since the smoke-test user has no `nutrition_targets`/`food_logs` rows), and the final `DELETE` removes the test user (cascades to `user_profiles`/`user_streaks` via `onDelete: Cascade`).

- [ ] **Step 4: Commit**

```bash
git add BackEndTorv/prisma/migrations
git commit -m "feat(db): add fn_get_diet_summary, fn_log_food_and_return_remaining, fn_register_new_user"
```

---

### Task 7: Add triggers and indexes

**Agent:** Cistern (Torv Database)

**Files:**
- Modify: `BackEndTorv/prisma/migrations/<timestamp>_init_postgres/migration.sql` (append)

**Interfaces:**
- Consumes: `activities`, `user_streaks`, `group_rankings` tables from Task 4.
- Produces: triggers `trg_update_streak_on_activity`, `trg_add_points_to_group_ranking` firing `AFTER INSERT ON activities`; indexes `ix_food_logs_user_id_date`, `ix_user_profiles_user_id`, `ix_activities_user_id`.

- [ ] **Step 1: Append the SQL below**

```sql
-- Triggers

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

-- Indexes

CREATE INDEX ix_food_logs_user_id_date ON food_logs (user_id, logged_date) INCLUDE (calories);
CREATE INDEX ix_user_profiles_user_id ON user_profiles (user_id);
CREATE INDEX ix_activities_user_id ON activities (user_id);
```

- [ ] **Step 2: Re-apply**

```bash
npx prisma migrate deploy
```

- [ ] **Step 3: Verify the streak trigger with a throwaway user + activity**

```bash
npx prisma db execute --stdin <<'EOF'
SELECT fn_register_new_user('smoke2@test.local', 'x', 'smoketest2', 'Smoke Test 2');
INSERT INTO activities (user_id, activity_type, start_time)
VALUES ((SELECT id FROM users WHERE email = 'smoke2@test.local'), 'run', now());
SELECT current_streak, longest_streak FROM user_streaks
WHERE user_id = (SELECT id FROM users WHERE email = 'smoke2@test.local');
DELETE FROM users WHERE email = 'smoke2@test.local';
EOF
```

Expected: `current_streak = 1`, `longest_streak = 1` after the insert (confirms the trigger fired).

- [ ] **Step 4: Commit**

```bash
git add BackEndTorv/prisma/migrations
git commit -m "feat(db): add streak/points triggers and performance indexes"
```

---

### Task 8: Add least-privilege roles

**Agent:** Cistern (Torv Database)

**Files:**
- Modify: `BackEndTorv/prisma/migrations/<timestamp>_init_postgres/migration.sql` (append)
- Modify: `BackEndTorv/.env` (`DATABASE_URL` switches to `torv_api`)
- Modify: `database-url-postgresql-pos` Maestri note (record the new `torv_api` connection string for future reference)

**Interfaces:**
- Consumes: all tables/functions/views from Tasks 4-7.
- Produces: roles `torv_api` (read/write/execute on app tables+functions) and `torv_analyst` (read-only on the two views). `torv_api` becomes the role `DATABASE_URL` connects as; `DIRECT_URL` keeps using the `postgres` superuser.

- [ ] **Step 1: Generate two strong random passwords**

```bash
openssl rand -base64 24 | tr -d '/+=' | head -c 24
```

Run it twice — once for `torv_api`, once for `torv_analyst`. Keep both values only in your working memory for this task; do not paste them into any file that will be committed.

- [ ] **Step 2: Append the SQL below, substituting the two generated passwords**

```sql
-- Roles (least privilege)

CREATE ROLE torv_api LOGIN PASSWORD '<generated-password-1>';
GRANT USAGE ON SCHEMA public TO torv_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO torv_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO torv_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO torv_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO torv_api;

CREATE ROLE torv_analyst LOGIN PASSWORD '<generated-password-2>';
GRANT USAGE ON SCHEMA public TO torv_analyst;
GRANT SELECT ON vw_dashboard_user_stats, vw_group_leaderboard TO torv_analyst;
```

- [ ] **Step 3: Re-apply (as the `postgres` superuser, via `DIRECT_URL`)**

```bash
npx prisma migrate deploy
```

- [ ] **Step 4: Update `BackEndTorv/.env`'s `DATABASE_URL` to use `torv_api`**

```
DATABASE_URL="postgresql://torv_api.figlsyikardnbfuykhxq:<generated-password-1>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

(`DIRECT_URL` is unchanged — still `postgres.figlsyikardnbfuykhxq` with the superuser password, since `torv_api` must not have DDL rights.)

- [ ] **Step 5: Update the Maestri note with the new connection strings**

```bash
maestri note edit "database-url-postgresql-pos" 'DATABASE_URL="postgresql://postgres.figlsyikardnbfuykhxq:[Torv2026$2412]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"' 'DATABASE_URL="postgresql://torv_api.figlsyikardnbfuykhxq:<generated-password-1>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"'
```

- [ ] **Step 6: Verify runtime connectivity as `torv_api` and confirm it cannot run DDL**

```bash
npx prisma db execute --url "$DATABASE_URL" --stdin <<< "SELECT count(*) FROM users;"
npx prisma db execute --url "$DATABASE_URL" --stdin <<< "CREATE TABLE should_fail (id int);"
```

Expected: first command succeeds (returns `0`), second fails with a permission-denied error (confirms least privilege).

- [ ] **Step 7: Commit**

```bash
git add BackEndTorv/prisma/migrations BackEndTorv/.env
git commit -m "feat(db): add torv_api/torv_analyst least-privilege roles"
```

(`.env` is gitignored — `git add` on it is a no-op; included here only so the step list is copy-pasteable without erroring.)

---

### Task 9: Rewrite `BancoDeDadosTorv/` as Postgres documentation

**Agent:** Cistern (Torv Database)

**Files:**
- Modify: `BancoDeDadosTorv/SQL BANCO DE DADOS.sql`
- Modify: `BancoDeDadosTorv/Regras BD.sql`
- Modify: `BancoDeDadosTorv/Gestao_e_Performance.sql`
- Modify: `BancoDeDadosTorv/Mock Dados.sql`
- Modify: `BancoDeDadosTorv/Testes Procedures e Triggers.sql`

**Interfaces:**
- Consumes: the final applied schema from Tasks 3-8 (these files must match exactly what's now running on Supabase).
- Produces: no runtime effect — pure documentation. The Prisma migration file remains the actual source of truth for what's deployed.

- [ ] **Step 1: Rewrite `SQL BANCO DE DADOS.sql`**

Replace the SQL Server `CREATE TABLE` statements with the Postgres equivalents matching Task 3's schema exactly (same table/column names, `uuid` instead of `UNIQUEIDENTIFIER`, `timestamptz` instead of `DATETIME2`, `varchar`/`text` instead of `NVARCHAR`, `DEFAULT gen_random_uuid()` instead of `DEFAULT NEWID()`, `DEFAULT now()` instead of `DEFAULT GETDATE()`). Drop the `USE TorvDB;` line (no equivalent/needed in Postgres — Supabase already scopes you to one database per project).

- [ ] **Step 2: Rewrite `Regras BD.sql`**

Replace with the plpgsql from Tasks 5-6 (`fn_get_consumed_calories`, `fn_calculate_age`, `vw_dashboard_user_stats`, `vw_group_leaderboard`, `fn_get_diet_summary`, `fn_log_food_and_return_remaining`, `fn_register_new_user`), keeping the original Portuguese section comments (`--UDFs`, `--Views`, `--Procedures`) as section headers for continuity with the original file's structure.

- [ ] **Step 3: Rewrite `Gestao_e_Performance.sql`**

Replace section 1 (logins/roles) with the `torv_api`/`torv_analyst` `CREATE ROLE`/`GRANT` statements from Task 8 (passwords shown as `'<set-at-deploy-time>'` placeholders in this documentation copy — never write a real password into this file). Replace section 2 (indexes) with the `CREATE INDEX` statements from Task 7. Remove section 3 (`DBCC SHRINKDATABASE`) entirely and replace it with a one-line comment: `-- Physical storage reclamation (VACUUM FULL) is out of scope for this migration; Supabase-managed Postgres handles autovacuum automatically.`

- [ ] **Step 4: Rewrite `Mock Dados.sql`**

Translate the existing INSERT statements to use Postgres syntax (mainly: no `SET IDENTITY_INSERT`-equivalent needed since we use `gen_random_uuid()` defaults; adjust any T-SQL-specific functions like `GETDATE()` to `now()`).

- [ ] **Step 5: Rewrite `Testes Procedures e Triggers.sql`**

Update the test queries to call the new plpgsql functions (`SELECT * FROM fn_get_diet_summary(...)` instead of `EXEC sp_GetDietSummary ...`, etc.), matching the calling convention used in Task 6.

- [ ] **Step 6: Commit**

```bash
git add "BancoDeDadosTorv/SQL BANCO DE DADOS.sql" "BancoDeDadosTorv/Regras BD.sql" "BancoDeDadosTorv/Gestao_e_Performance.sql" "BancoDeDadosTorv/Mock Dados.sql" "BancoDeDadosTorv/Testes Procedures e Triggers.sql"
git commit -m "docs(db): rewrite BancoDeDadosTorv scripts as Postgres documentation"
```

---

### Task 10: Swap backend dependencies

**Agent:** Anvil (Torv Backend)

**Files:**
- Modify: `BackEndTorv/package.json`

**Interfaces:**
- Produces: `fastify`, `@fastify/cors`, `@fastify/multipart`, `@fastify/static` available as dependencies for Tasks 11-15.

- [ ] **Step 1: Remove Express-stack packages, add Fastify-stack packages**

```bash
cd BackEndTorv
npm uninstall express cors multer
npm install fastify @fastify/cors @fastify/multipart @fastify/static
```

- [ ] **Step 2: Verify `package.json`**

Run: `cat package.json`
Expected `dependencies` block contains `@fastify/cors`, `@fastify/multipart`, `@fastify/static`, `@prisma/client`, `bcrypt`, `dotenv`, `fastify`, `jsonwebtoken` — and no longer contains `express`, `cors`, or `multer`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(backend): swap Express/multer/cors deps for Fastify equivalents"
```

---

### Task 11: Rewrite the server bootstrap

**Agent:** Anvil (Torv Backend)

**Files:**
- Modify: `BackEndTorv/server.js`

**Interfaces:**
- Consumes: Fastify packages from Task 10.
- Produces: a running Fastify instance that Tasks 12-14's route plugins register into.

- [ ] **Step 1: Replace `server.js`**

```javascript
require('dotenv').config();
const path = require('path');
const fastify = require('fastify')({ logger: true });

fastify.register(require('@fastify/cors'), {});
fastify.register(require('@fastify/multipart'));
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'profilePhotos'),
  prefix: '/uploads/',
});

fastify.register(require('./src/routes/auth.routes'), { prefix: '/auth' });
fastify.register(require('./src/routes/profile.routes'), { prefix: '/profile' });
fastify.register(require('./src/routes/diet.routes'), { prefix: '/diet' });

fastify.setErrorHandler((err, request, reply) => {
  fastify.log.error(err);
  reply.status(500).send({ error: 'An unexpected error occurred' });
});

const PORT = process.env.PORT || 3000;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server is running on ${address}`);
});
```

- [ ] **Step 2: Start it and confirm it boots**

Run: `node server.js` (in `BackEndTorv/`, then stop it with Ctrl+C once confirmed)
Expected: log line `Server is running on http://0.0.0.0:3000` with no startup errors (route plugins from Tasks 12-14 don't exist as Fastify plugins yet, so this step is expected to fail until this task is redone after Task 14 exists — see note below).

**Note:** `server.js` references `./src/routes/*.routes.js` before Tasks 12-14 convert them to Fastify plugins. Do Steps 1 and 2 here as a dry run to confirm the Fastify/plugin registration syntax itself is correct; expect a boot error naming one of the not-yet-converted route files, and re-run Step 2 again as the final verification step of Task 14 once all three route files are Fastify plugins.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(backend): rewrite server bootstrap for Fastify"
```

---

### Task 12: Convert auth middleware and routes/controller

**Agent:** Anvil (Torv Backend)

**Files:**
- Modify: `BackEndTorv/src/middlewares/auth.middleware.js`
- Modify: `BackEndTorv/src/routes/auth.routes.js`
- Modify: `BackEndTorv/src/controller/auth.controller.js`

**Interfaces:**
- Consumes: `authRepository.createUser`/`findUserByEmail` (unchanged, from `src/repository/auth.repository.js`).
- Produces: `authenticateToken` as a Fastify `preHandler` function with signature `(request, reply, done)`, used by `profile.routes.js` and `diet.routes.js` in Tasks 13-14. `request.user` carries `{ userId, email }` exactly as `req.user` did before.

- [ ] **Step 1: Rewrite `auth.middleware.js`**

```javascript
const jwt = require('jsonwebtoken');

const authenticateToken = (request, reply, done) => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return reply.status(401).send({ error: 'Access token is missing' });

  jwt.verify(token, process.env.JWT_SECRET || 'uma_frase_longa_com_letras_numeros_e_simbolos_bem_aleatorios', (err, user) => {
    if (err) return reply.status(403).send({ error: 'Invalid or expired token' });
    request.user = user;
    done();
  });
};

module.exports = authenticateToken;
```

- [ ] **Step 2: Rewrite `auth.controller.js`** (same logic, Fastify request/reply signature)

```javascript
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authRepository = require('../repository/auth.repository');

class AuthController {
  async register(request, reply) {
    try {
      const { email, password, name, birth_date, weight, height, gender, fitness_level, goal } = request.body;

      if (!email || !password || !name) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      const existingUser = await authRepository.findUserByEmail(email);
      if (existingUser) {
        return reply.status(409).send({ error: 'User already exists with this email' });
      }

      let parsedBirthDate = null;
      if (birth_date) {
        if (birth_date.includes('/')) {
          const [day, month, year] = birth_date.split('/');
          parsedBirthDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
        } else {
          parsedBirthDate = new Date(birth_date);
        }

        if (isNaN(parsedBirthDate.getTime())) {
          return reply.status(400).send({ error: 'Invalid birth_date format' });
        }
      }

      const password_hash = await bcrypt.hash(password, 10);
      const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

      const user = await authRepository.createUser({
        email, password_hash, username, name,
        birth_date: parsedBirthDate, weight, height, gender, fitness_level, goal,
      });

      reply.status(201).send({ message: 'User registered successfully', userId: user.id });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error during registration' });
    }
  }

  async login(request, reply) {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({ error: 'Missing email or password' });
      }

      const user = await authRepository.findUserByEmail(email);
      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'uma_frase_longa_com_letras_numeros_e_simbolos_bem_aleatorios',
        { expiresIn: '7d' }
      );

      const photoUrl = user.user_profiles?.photo_url
        ? `${request.protocol}://${request.hostname}/uploads/${user.user_profiles.photo_url}`
        : null;

      reply.status(200).send({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_profiles ? user.user_profiles.name : null,
          username: user.user_profiles ? user.user_profiles.username : null,
          photo_url: photoUrl,
          profile: user.user_profiles,
        },
      });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error during login' });
    }
  }
}

module.exports = new AuthController();
```

- [ ] **Step 3: Rewrite `auth.routes.js` as a Fastify plugin**

```javascript
const authController = require('../controller/auth.controller');

async function authRoutes(fastify) {
  fastify.post('/register', authController.register);
  fastify.post('/login', authController.login);
}

module.exports = authRoutes;
```

- [ ] **Step 4: Smoke test**

Start the server (`node server.js` from `BackEndTorv/`) and run:
```bash
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"plan-smoke@test.local","password":"Test1234!","name":"Plan Smoke"}'
```
Expected: `201` with `{"message":"User registered successfully","userId":"<uuid>"}`. Then:
```bash
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"plan-smoke@test.local","password":"Test1234!"}'
```
Expected: `200` with a `token` field. Clean up the test user afterward: `npx prisma db execute --stdin <<< "DELETE FROM users WHERE email = 'plan-smoke@test.local';"`

- [ ] **Step 5: Commit**

```bash
git add src/middlewares/auth.middleware.js src/routes/auth.routes.js src/controller/auth.controller.js
git commit -m "feat(backend): convert auth middleware/routes/controller to Fastify"
```

---

### Task 13: Convert profile routes/controller (incl. multipart upload)

**Agent:** Anvil (Torv Backend)

**Files:**
- Modify: `BackEndTorv/src/routes/profile.routes.js`
- Modify: `BackEndTorv/src/controller/profile.controller.js`

**Interfaces:**
- Consumes: `authenticateToken` from Task 12, `profileRepository` (unchanged, from `src/repository/profile.repository.js`), `@fastify/multipart` registered in Task 11.
- Produces: `POST /profile/upload` accepting `multipart/form-data` with a `photo` field, same response shape as today (`{ message, photo_url }`).

- [ ] **Step 1: Rewrite `profile.controller.js`**

```javascript
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const profileRepository = require('../repository/profile.repository');

class ProfileController {
  async getProfile(request, reply) {
    try {
      const { userId } = request.user;
      const user = await profileRepository.getUserProfile(userId);

      if (!user) {
        return reply.status(404).send({ error: 'User profile not found' });
      }

      const profile = user.user_profiles || {};
      const streaks = user.user_streaks || {};

      const photoUrl = profile.photo_url
        ? `${request.protocol}://${request.hostname}/uploads/${profile.photo_url}`
        : null;

      reply.status(200).send({
        id: user.id,
        email: user.email,
        username: profile.username,
        name: profile.name,
        fitness_level: profile.fitness_level,
        goal: profile.goal,
        photo_url: photoUrl,
        birth_date: profile.birth_date,
        gender: profile.gender,
        streak: streaks.current_streak || 0,
        longest_streak: streaks.longest_streak || 0,
        workouts_in_month: 0,
        followers: 0,
        following: 0,
        total_workouts: 0,
      });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error fetching profile' });
    }
  }

  async uploadPhoto(request, reply) {
    try {
      const { userId } = request.user;
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: 'No image file provided' });
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `profile-${userId}-${uniqueSuffix}${path.extname(data.filename)}`;
      const destPath = path.join(__dirname, '../../profilePhotos', fileName);

      await pipeline(data.file, fs.createWriteStream(destPath));

      await profileRepository.updatePhotoUrl(userId, fileName);

      const photoUrl = `${request.protocol}://${request.hostname}/uploads/${fileName}`;

      reply.status(200).send({
        message: 'Profile photo updated successfully',
        photo_url: photoUrl,
      });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error uploading photo' });
    }
  }

  async updateProfile(request, reply) {
    try {
      const { userId } = request.user;
      const { username, goal } = request.body;

      if (!username && !goal) {
        return reply.status(400).send({ error: 'No fields provided for update' });
      }

      const dataToUpdate = {};
      if (username) dataToUpdate.username = username;
      if (goal) dataToUpdate.goal = goal;

      const updatedProfile = await profileRepository.updateProfile(userId, dataToUpdate);

      reply.status(200).send({
        message: 'Profile updated successfully',
        profile: updatedProfile,
      });
    } catch (error) {
      request.log.error(error);
      if (error.code === 'P2002') {
        return reply.status(409).send({ error: 'Username is already taken' });
      }
      reply.status(500).send({ error: 'Internal server error updating profile' });
    }
  }
}

module.exports = new ProfileController();
```

- [ ] **Step 2: Rewrite `profile.routes.js` as a Fastify plugin**

```javascript
const profileController = require('../controller/profile.controller');
const authenticateToken = require('../middlewares/auth.middleware');

async function profileRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/', profileController.getProfile);
  fastify.post('/upload', profileController.uploadPhoto);
  fastify.put('/', profileController.updateProfile);
}

module.exports = profileRoutes;
```

- [ ] **Step 3: Smoke test**

Register/login a test user (as in Task 12 Step 4), then:
```bash
curl http://localhost:3000/profile -H "Authorization: Bearer <token>"
```
Expected: `200` with the profile JSON shape from `getProfile` above.
```bash
curl -X POST http://localhost:3000/profile/upload -H "Authorization: Bearer <token>" -F "photo=@/path/to/any/test.jpg"
```
Expected: `200` with `{"message":"Profile photo updated successfully","photo_url":"http://localhost:3000/uploads/profile-<userId>-....jpg"}`, and the file exists in `BackEndTorv/profilePhotos/`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/profile.routes.js src/controller/profile.controller.js
git commit -m "feat(backend): convert profile routes/controller to Fastify, multer to @fastify/multipart"
```

---

### Task 14: Convert diet routes/controller and update the raw-query repository calls

**Agent:** Anvil (Torv Backend)

**Files:**
- Modify: `BackEndTorv/src/routes/diet.routes.js`
- Modify: `BackEndTorv/src/controller/diet.controller.js`
- Modify: `BackEndTorv/src/repository/diet.repository.js`

**Interfaces:**
- Consumes: `authenticateToken` from Task 12, `fn_get_diet_summary`/`fn_log_food_and_return_remaining` Postgres functions from Task 6.
- Produces: `dietRepository.getDietSummaryByDate`/`createFoodLog` return the same shape as before (`spResult.GoalCalories`, etc. — preserved by the double-quoted column names in Task 6), so `diet.controller.js`'s `formatDietSummaryResponse` needs no changes.

- [ ] **Step 1: Update the two raw queries in `diet.repository.js`**

In `getDietSummaryByDate`, replace:
```javascript
const result = await prisma.$queryRaw`EXEC sp_GetDietSummary @UserId=${userId}, @Date=${targetDate}`;
```
with:
```javascript
const result = await prisma.$queryRaw`SELECT * FROM fn_get_diet_summary(${userId}::uuid, ${targetDate}::date)`;
```

In `createFoodLog`, replace:
```javascript
const result = await prisma.$queryRaw`
  EXEC sp_LogFoodAndReturnRemaining 
  @UserId=${userId}, 
  @FoodName=${data.food_name}, 
  @Calories=${data.calories}, 
  @MacrosJson=${macrosJsonStr}, 
  @Date=${targetDate}
`;
```
with:
```javascript
const result = await prisma.$queryRaw`
  SELECT * FROM fn_log_food_and_return_remaining(
    ${userId}::uuid, ${data.food_name}, ${data.calories}, ${macrosJsonStr}, ${targetDate}::date
  )
`;
```

Everything else in `diet.repository.js` (the Prisma-native `findMany`/`findUnique`/`deleteMany`/`updateMany`/`upsert` calls) is unchanged.

- [ ] **Step 2: Rewrite `diet.controller.js`** (same logic, Fastify signature)

```javascript
const dietRepository = require('../repository/diet.repository');

const formatDietSummaryResponse = (date, spResult, logsArray) => {
  return {
    date,
    targets: {
      daily_calories: spResult.GoalCalories,
      protein_g: spResult.GoalProtein,
      carbs_g: spResult.GoalCarbs,
      fat_g: spResult.GoalFat,
    },
    consumed: {
      calories: spResult.ConsumedCalories,
      protein_g: spResult.ConsumedProtein,
      carbs_g: spResult.ConsumedCarbs,
      fat_g: spResult.ConsumedFat,
    },
    remaining: {
      calories: spResult.RemainingCalories,
      protein_g: spResult.RemainingProtein,
      carbs_g: spResult.RemainingCarbs,
      fat_g: spResult.RemainingFat,
    },
    logs: logsArray.map(log => {
      let macros = { proteins: 0, carbs: 0, fats: 0 };
      if (log.macros_json) {
        try {
          macros = typeof log.macros_json === 'string' ? JSON.parse(log.macros_json) : log.macros_json;
        } catch (e) {}
      }
      return { ...log, macros_json: macros };
    })
  };
};

class DietController {
  async getDietSummary(request, reply) {
    try {
      const { userId } = request.user;
      let { date } = request.query;

      if (!date) {
        date = new Date().toISOString().split('T')[0];
      }

      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      const finalResponse = formatDietSummaryResponse(date, spResult || {
        GoalCalories: 2000, GoalProtein: 150, GoalCarbs: 250, GoalFat: 65,
        ConsumedCalories: 0, ConsumedProtein: 0, ConsumedCarbs: 0, ConsumedFat: 0,
        RemainingCalories: 2000, RemainingProtein: 150, RemainingCarbs: 250, RemainingFat: 65
      }, foodLogs || []);

      reply.status(200).send(finalResponse);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error fetching diet summary' });
    }
  }

  async getDiet(request, reply) {
    return this.getDietSummary(request, reply);
  }

  async addFoodLog(request, reply) {
    try {
      const { userId } = request.user;
      const { food_name, calories, macros_json, logged_date } = request.body;

      if (!food_name || calories === undefined || !macros_json) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      const date = logged_date || new Date().toISOString().split('T')[0];

      const spResult = await dietRepository.createFoodLog(userId, {
        food_name, calories, macros_json, logged_date: date
      });

      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      reply.status(201).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error creating food log' });
    }
  }

  async updateFoodLog(request, reply) {
    try {
      const { userId } = request.user;
      const { logId } = request.params;
      const { food_name, calories, macros_json } = request.body;

      if (!logId) {
        return reply.status(400).send({ error: 'Missing logId' });
      }

      const existingLog = await dietRepository.getFoodLogById(logId);
      if (!existingLog || existingLog.user_id !== userId) {
        return reply.status(404).send({ error: 'Food log not found' });
      }
      const date = new Date(existingLog.logged_date).toISOString().split('T')[0];

      await dietRepository.updateFoodLog(userId, logId, { food_name, calories, macros_json });

      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      reply.status(200).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error updating food log' });
    }
  }

  async deleteFoodLog(request, reply) {
    try {
      const { userId } = request.user;
      const { logId } = request.params;

      if (!logId) {
        return reply.status(400).send({ error: 'Missing logId' });
      }

      const existingLog = await dietRepository.getFoodLogById(logId);
      if (!existingLog || existingLog.user_id !== userId) {
        return reply.status(404).send({ error: 'Food log not found' });
      }
      const date = new Date(existingLog.logged_date).toISOString().split('T')[0];

      await dietRepository.deleteFoodLog(userId, logId);

      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      reply.status(200).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error deleting food log' });
    }
  }

  async updateNutritionTargets(request, reply) {
    try {
      const { userId } = request.user;
      const { daily_calories, protein_g, carbs_g, fat_g } = request.body;

      if (daily_calories === undefined) {
        return reply.status(400).send({ error: 'Missing daily_calories' });
      }

      await dietRepository.upsertNutritionTargets(userId, {
        daily_calories, protein_g: protein_g || 0, carbs_g: carbs_g || 0, fat_g: fat_g || 0,
      });

      const date = new Date().toISOString().split('T')[0];
      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      reply.status(200).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error updating targets' });
    }
  }
}

module.exports = new DietController();
```

- [ ] **Step 3: Rewrite `diet.routes.js` as a Fastify plugin**

```javascript
const dietController = require('../controller/diet.controller');
const authenticateToken = require('../middlewares/auth.middleware');

async function dietRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/summary', dietController.getDietSummary);
  fastify.get('/', dietController.getDiet);
  fastify.post('/', dietController.addFoodLog);
  fastify.put('/targets', dietController.updateNutritionTargets);
  fastify.put('/:logId', dietController.updateFoodLog);
  fastify.delete('/:logId', dietController.deleteFoodLog);
}

module.exports = dietRoutes;
```

- [ ] **Step 4: Full boot + end-to-end smoke test**

Start the server (`node server.js`). Confirm it now boots cleanly (this is the deferred verification from Task 11 Step 2 — all three route plugins now exist).

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"diet-smoke@test.local","password":"Test1234!","name":"Diet Smoke"}' \
  && curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"diet-smoke@test.local","password":"Test1234!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s http://localhost:3000/diet/summary -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://localhost:3000/diet -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"food_name":"Banana","calories":90,"macros_json":{"protein":1,"carbs":23,"fat":0}}'
```

Expected: `GET /diet/summary` returns `200` with `targets.daily_calories = 2000` (no `nutrition_targets` row yet, so defaults apply); `POST /diet` returns `201` with the same shape, `remaining.calories = 1910` (`2000 - 90`), and one entry in `logs`. Clean up: `npx prisma db execute --stdin <<< "DELETE FROM users WHERE email = 'diet-smoke@test.local';"`

- [ ] **Step 5: Commit**

```bash
git add src/routes/diet.routes.js src/controller/diet.controller.js src/repository/diet.repository.js
git commit -m "feat(backend): convert diet routes/controller to Fastify, port raw queries to Postgres functions"
```

---

### Task 15: Security review

**Agent:** Warden (Torv Security)

**Files:** none created/modified — review only.

- [ ] **Step 1: Review the full diff on `migration/postgres-fastify-supabase` against `main`**

Focus areas per the spec's section 7: whether `torv_analyst`'s view grants expose `password_hash` or any other sensitive column (they should not — `torv_analyst` only has `SELECT` on the two views, never on base tables); whether the `$queryRaw` calls in `diet.repository.js` are still safely parameterized after the T-SQL→Postgres syntax change (Prisma's tagged-template `$queryRaw` escapes interpolated values regardless of the underlying SQL dialect, so this should hold, but confirm no string concatenation was introduced); whether the new plpgsql functions run with definer vs. invoker rights appropriately (they should run as invoker — no `SECURITY DEFINER` was added, so they execute with the calling role's own privileges, which is correct here since `torv_api` already holds the needed grants).

- [ ] **Step 2: Report findings**

Fix anything CONFIRMED as a real issue directly in the relevant file from Tasks 5-14, then re-commit. If nothing is found, no commit needed for this task.

---

### Task 16: Final review and test pass

**Agent:** Loupe (Torv Review and Tests)

**Files:** none created/modified — review only, unless gaps are found.

- [ ] **Step 1: Re-run every smoke test from Tasks 4-14** end to end in one pass (fresh `node server.js` boot, register → login → get profile → upload photo → get diet summary → add food log → update food log → delete food log → update nutrition targets), confirming each response shape matches what's documented in this plan's tasks.

- [ ] **Step 2: Confirm `git diff main...migration/postgres-fastify-supabase --stat`** touches only the files listed in this plan's File Structure table (no accidental changes to `FrontEndTorv/`).

- [ ] **Step 3: Report** which of the 8 endpoints pass/fail. Fix any regressions found by returning to the relevant task's file and re-testing before proceeding to Task 17.

---

### Task 17: Merge to `main`

**Files:** none (git operation only)

- [ ] **Step 1: Confirm Tasks 15-16 raised no unresolved issues**

- [ ] **Step 2: Merge**

```bash
git checkout main
git merge --no-ff migration/postgres-fastify-supabase
```

- [ ] **Step 3: Verify**

Run: `git log --oneline -5`
Expected: merge commit on top of the migration branch's history, `main` now contains all of Tasks 1-16's commits.
