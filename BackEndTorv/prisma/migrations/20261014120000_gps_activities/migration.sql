-- Importador de GPX: tipo da rotina, tipos de atividade, deduplicação da importação e métricas de GPS.
-- Pré-condições conferidas antes de aplicar: activities só com STRENGTH e activity_gps_data vazia.

ALTER TABLE "workout_routines" ADD COLUMN "activity_type" VARCHAR(10) NOT NULL DEFAULT 'STRENGTH';
ALTER TABLE "workout_routines" ADD CONSTRAINT "workout_routines_activity_type_check"
  CHECK ("activity_type" IN ('STRENGTH', 'RUN', 'WALK'));

ALTER TABLE "activities" ADD CONSTRAINT "activities_activity_type_check"
  CHECK ("activity_type" IN ('STRENGTH', 'RUN', 'WALK'));

-- Uma atividade de GPS por usuário e instante de início: importar o mesmo arquivo de novo dá conflito (409 na API).
CREATE UNIQUE INDEX "activities_gps_user_start_key" ON "activities"("user_id", "start_time") WHERE "activity_type" <> 'STRENGTH';

-- route_json nunca foi usado (tabela vazia). A rota simplificada e as parciais vão em JSONB; o resto em colunas tipadas.
ALTER TABLE "activity_gps_data" DROP COLUMN "route_json";
ALTER TABLE "activity_gps_data"
  ADD COLUMN "elapsed_sec" INTEGER NOT NULL,
  ADD COLUMN "elevation_gain_m" DECIMAL(7,1),
  ADD COLUMN "avg_hr" SMALLINT,
  ADD COLUMN "max_hr" SMALLINT,
  ADD COLUMN "avg_cadence" SMALLINT,
  ADD COLUMN "splits" JSONB NOT NULL,
  ADD COLUMN "route" JSONB NOT NULL;
ALTER TABLE "activity_gps_data"
  ADD CONSTRAINT "activity_gps_data_elapsed_sec_check" CHECK ("elapsed_sec" > 0),
  ADD CONSTRAINT "activity_gps_data_elevation_gain_m_check" CHECK ("elevation_gain_m" IS NULL OR "elevation_gain_m" >= 0),
  ADD CONSTRAINT "activity_gps_data_hr_check"
    CHECK (("avg_hr" IS NULL OR "avg_hr" BETWEEN 20 AND 250) AND ("max_hr" IS NULL OR "max_hr" BETWEEN 20 AND 250)),
  ADD CONSTRAINT "activity_gps_data_avg_cadence_check" CHECK ("avg_cadence" IS NULL OR "avg_cadence" BETWEEN 1 AND 400);
