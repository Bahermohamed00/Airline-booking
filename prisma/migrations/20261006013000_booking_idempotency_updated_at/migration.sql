-- Phase 1 booking hardening (Booking model, Ayman-owned):
-- 1. Creation idempotency: client UUID key + request hash, unique per customer.
--    NULL keys (pre-existing rows) coexist freely under the unique index.
-- 2. updated_at lifecycle timestamp, managed by Prisma @updatedAt.
-- Hand-written because `prisma migrate dev` cannot resolve this repo's
-- migrations folder with Prisma 6.19.3 folder-based schemas (see Phase 1 report);
-- the DDL below mirrors exactly what `migrate dev` would generate.

-- AlterTable
ALTER TABLE "bookings"
  ADD COLUMN "idempotency_key" VARCHAR(36),
  ADD COLUMN "idempotency_request_hash" VARCHAR(64),
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_user_id_idempotency_key_key" ON "bookings"("user_id", "idempotency_key");
