-- Customer-facing sequential public flight number, backed by a database
-- sequence (concurrency-safe by construction). Existing flights get
-- backfilled sequentially; new flights draw from the sequence automatically.

-- AlterTable
ALTER TABLE "flights" ADD COLUMN "public_number" SERIAL;

-- Backfill existing rows in creation order so they also get public numbers.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM "flights"
  WHERE public_number IS NULL
)
UPDATE "flights" f
SET public_number = numbered.rn
FROM numbered
WHERE f.id = numbered.id;

-- Make it mandatory + unique after the backfill.
ALTER TABLE "flights" ALTER COLUMN "public_number" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "flights_public_number_key" ON "flights"("public_number");
