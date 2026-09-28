-- AlterTable
ALTER TABLE "seat_holds" ADD COLUMN     "booking_id" UUID;

-- CreateIndex
CREATE INDEX "seat_holds_booking_id_idx" ON "seat_holds"("booking_id");

-- AddForeignKey
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Phase 4: at most one ACTIVE hold per (flight, seat) — the database-level
-- guarantee behind seat-hold concurrency. Prisma cannot express partial
-- indexes, so this is intentionally raw SQL (reported per project rules).
-- History rows (EXPIRED/RELEASED/CONVERTED) coexist freely.
CREATE UNIQUE INDEX "seat_holds_one_active_per_flight_seat"
ON "seat_holds" ("flight_id", "seat_id")
WHERE "status" = 'ACTIVE';
