-- Phase 2: Stripe PaymentIntent + webhook hardening (additive only).
--
-- 1. payments.provider_status: fine-grained provider-side status (observability/
--    reconciliation); the coarse Payment.status state machine is unchanged.
-- 2. payments (booking_id, idempotency_key) unique: database-level payment
--    idempotency — two concurrent attempts sharing an application idempotency
--    key can no longer both insert a Payment row. NULL keys coexist (Postgres).
-- 3. refunds.provider_reference: provider refund reference for reconciliation.
-- 4. payment_webhook_events: database-backed webhook deduplication —
--    unique(provider, event_id) survives restarts, multiple API instances and
--    duplicate Stripe deliveries.

-- CreateEnum
CREATE TYPE "payment_webhook_event_status" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "provider_status" VARCHAR(50);

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "provider_reference" VARCHAR(255);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "status" "payment_webhook_event_status" NOT NULL DEFAULT 'RECEIVED',
    "processing_error" TEXT,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_booking_id_idempotency_key_key" ON "payments"("booking_id", "idempotency_key");
