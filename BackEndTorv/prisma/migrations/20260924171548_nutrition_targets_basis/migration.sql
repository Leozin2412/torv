-- AlterTable
ALTER TABLE "nutrition_targets" ADD COLUMN     "basis_json" JSONB,
ADD COLUMN     "updated_at" TIMESTAMPTZ;
