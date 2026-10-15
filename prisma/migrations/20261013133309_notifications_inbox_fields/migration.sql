-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('BOOKING_CONFIRMED', 'PAYMENT_SUCCEEDED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" VARCHAR(150),
ADD COLUMN     "read_at" TIMESTAMPTZ(6),
ADD COLUMN     "title" VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN     "type" "notification_type";

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
