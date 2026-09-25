-- Lock down schema public: anon/authenticated (Supabase PostgREST /rest/v1) could read
-- and write every table and call every function. Only the backend (torv_api) and the
-- owner (postgres) touch this schema. Plain Postgres, no Supabase-specific features.

-- 1. Table/view/sequence privileges.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 2. Functions: EXECUTE is granted to PUBLIC by default. torv_api keeps its explicit grant.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO torv_api;

-- 3. Future objects created by postgres (Prisma migrations) must not be born exposed.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;

-- 4/5. RLS on every table. torv_api is not the owner, so it needs an explicit policy.
-- postgres (owner, BYPASSRLS) is unaffected: views and SECURITY DEFINER handle_new_user
-- keep working. _prisma_migrations gets RLS with no policy (only postgres uses it).
-- New tables need their own ENABLE RLS + policy in the migration that creates them.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "users" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "user_profiles" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "user_measurements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "user_measurements" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "user_streaks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "user_streaks" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "follows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "follows" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "groups" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "group_members" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "group_rankings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "group_rankings" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "activities" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "activity_gps_data" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "activity_gps_data" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "exercises" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "workout_routines" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "workout_routines" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "routine_exercises" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "routine_exercises" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "food_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "food_logs" TO torv_api USING (true) WITH CHECK (true);

ALTER TABLE "nutrition_targets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "nutrition_targets" TO torv_api USING (true) WITH CHECK (true);
