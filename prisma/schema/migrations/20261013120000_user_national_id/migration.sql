-- AlterTable
ALTER TABLE "users" ADD COLUMN     "national_id" VARCHAR(14);

-- CreateIndex
-- PostgreSQL unique indexes treat NULLs as distinct, so legacy rows and staff
-- accounts without a national ID coexist; only real values must be unique.
CREATE UNIQUE INDEX "users_national_id_key" ON "users"("national_id");
