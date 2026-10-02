-- Carga feita em cada série (NULL = sem carga, ou treino gravado antes desta migration)
-- e o momento em que a pessoa viu a mensagem de boas-vindas (NULL = ainda não viu).
ALTER TABLE "workout_sets"
  ADD COLUMN "weight_kg" DECIMAL(6,2),
  ADD CONSTRAINT "workout_sets_weight_kg_check" CHECK ("weight_kg" IS NULL OR "weight_kg" BETWEEN 0 AND 999.99);

ALTER TABLE "user_profiles" ADD COLUMN "welcomed_at" TIMESTAMPTZ;
