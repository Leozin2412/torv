-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "users" DROP COLUMN "password_hash";
