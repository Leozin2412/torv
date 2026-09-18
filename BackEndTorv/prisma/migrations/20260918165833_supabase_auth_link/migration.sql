-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "users" DROP COLUMN "password_hash";

-- Dead code cleanup: fn_register_new_user (init migration, documentation-parity only,
-- never called from BackEndTorv/src) inserts into users.password_hash, which no longer
-- exists. Registration now goes through Supabase Auth + handle_new_user below.
DROP FUNCTION IF EXISTS fn_register_new_user(varchar, varchar, varchar, varchar);

-- Reset test data: no production accounts to preserve (confirmed in design doc).
-- Must run before the FK below -- existing rows weren't created via auth.users and
-- would fail the constraint's validation against current data otherwise.
TRUNCATE TABLE users CASCADE;

-- users.id must equal the auth.users.id that owns it.
ALTER TABLE users
  ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Bounds that used to live in authController.register (BackEndTorv/src/controller/auth.controller.js,
-- now removed) move here so they hold for every future writer, not just registration.
ALTER TABLE user_measurements
  ADD CONSTRAINT user_measurements_weight_kg_check CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 300)),
  ADD CONSTRAINT user_measurements_height_cm_check CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250));

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
