/*
  Warnings:

  - Added the required column `updated_at` to the `refunds` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "orphan_refund_status" AS ENUM ('UNMATCHED', 'RESOLVED');

-- AlterTable (DEFAULT backfills existing rows; @updatedAt maintains it afterwards)
ALTER TABLE "refunds" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "orphan_provider_refunds" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_refund_reference" VARCHAR(255) NOT NULL,
    "payment_provider_reference" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "orphan_refund_status" NOT NULL DEFAULT 'UNMATCHED',
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" VARCHAR(255),
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orphan_provider_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orphan_provider_refunds_status_first_seen_at_idx" ON "orphan_provider_refunds"("status", "first_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "orphan_provider_refunds_provider_provider_refund_reference_key" ON "orphan_provider_refunds"("provider", "provider_refund_reference");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_status_created_at_idx" ON "refunds"("status", "created_at");
