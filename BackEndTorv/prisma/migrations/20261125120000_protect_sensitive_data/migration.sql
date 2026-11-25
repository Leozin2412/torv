-- LGPD (spec, secao C): campos sensiveis passam a guardar texto cifrado pela aplicacao (AES-GCM), entao o tipo vira text; email so existe no Supabase Auth.
-- A troca de tipo usa USING NULL: o bloco abaixo garante que as tabelas estao vazias e aborta se houver dado.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_measurements)
     OR EXISTS (SELECT 1 FROM activity_gps_data)
     OR EXISTS (SELECT 1 FROM nutrition_targets) THEN
    RAISE EXCEPTION 'Migration protect_sensitive_data assume user_measurements, activity_gps_data e nutrition_targets vazias; nao rode com dados (USING NULL apagaria os valores).';
  END IF;
END $$;

ALTER TABLE user_measurements
  DROP CONSTRAINT user_measurements_weight_kg_check,
  DROP CONSTRAINT user_measurements_height_cm_check;
ALTER TABLE activity_gps_data DROP CONSTRAINT activity_gps_data_hr_check;

ALTER TABLE user_measurements
  ALTER COLUMN weight_kg TYPE text USING NULL,
  ALTER COLUMN height_cm TYPE text USING NULL;

ALTER TABLE activity_gps_data
  ALTER COLUMN avg_hr TYPE text USING NULL,
  ALTER COLUMN max_hr TYPE text USING NULL,
  ALTER COLUMN splits DROP NOT NULL,
  ALTER COLUMN route DROP NOT NULL;
ALTER TABLE activity_gps_data
  ALTER COLUMN splits TYPE text USING NULL,
  ALTER COLUMN route TYPE text USING NULL;
ALTER TABLE activity_gps_data
  ALTER COLUMN splits SET NOT NULL,
  ALTER COLUMN route SET NOT NULL;

ALTER TABLE nutrition_targets ALTER COLUMN basis_json TYPE text USING NULL;

ALTER TABLE users DROP COLUMN email;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, auth_provider, created_at)
  VALUES (NEW.id, 'email', now());

  RETURN NEW;
END;
$$;
