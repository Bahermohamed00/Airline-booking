-- Support inbox: ticket conversation messages with sender, delivery status,
-- and staff read/unread tracking. Additive only.

-- CreateEnum
CREATE TYPE "support_message_sender" AS ENUM ('CUSTOMER', 'SUPPORT_STAFF');

-- CreateEnum
CREATE TYPE "support_message_delivery" AS ENUM ('NONE', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "sender_type" "support_message_sender" NOT NULL,
    "delivery_status" "support_message_delivery" NOT NULL DEFAULT 'NONE',
    "read_by_staff_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
