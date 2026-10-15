-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "notification_type" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "notification_type" ADD VALUE 'CANCELLATION_APPROVED';
ALTER TYPE "notification_type" ADD VALUE 'CANCELLATION_REJECTED';
ALTER TYPE "notification_type" ADD VALUE 'REFUND_PROCESSED';
ALTER TYPE "notification_type" ADD VALUE 'REFUND_REVIEW_REQUIRED';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "next_retry_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "notifications_channel_status_next_retry_at_idx" ON "notifications"("channel", "status", "next_retry_at");
