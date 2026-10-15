-- Booking extras catalog & persistence (BR extras feature).
-- Extends the pre-existing, previously unwired extra_services / booking_extras
-- tables with catalog metadata and historical price snapshots.

-- CreateEnum
CREATE TYPE "extra_service_category" AS ENUM ('BAGGAGE', 'MEAL', 'PRIORITY', 'INSURANCE');

-- CreateEnum
CREATE TYPE "extra_pricing_unit" AS ENUM ('PER_ITEM', 'PER_PASSENGER', 'PER_BOOKING');

-- AlterTable extra_services: catalog metadata
ALTER TABLE "extra_services"
ADD COLUMN     "category" "extra_service_category" NOT NULL DEFAULT 'BAGGAGE',
ADD COLUMN     "pricing_unit" "extra_pricing_unit" NOT NULL DEFAULT 'PER_ITEM',
ADD COLUMN     "max_quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "requires_passenger" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valid_from" TIMESTAMPTZ(6),
ADD COLUMN     "valid_to" TIMESTAMPTZ(6),
ADD COLUMN     "metadata" JSONB;

-- AlterTable booking_extras: passenger association + immutable snapshots
ALTER TABLE "booking_extras"
ADD COLUMN     "booking_passenger_id" UUID,
ADD COLUMN     "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'EUR',
ADD COLUMN     "pricing_unit" "extra_pricing_unit" NOT NULL DEFAULT 'PER_ITEM',
ADD COLUMN     "category" "extra_service_category" NOT NULL DEFAULT 'BAGGAGE',
ADD COLUMN     "service_code" VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN     "service_name" VARCHAR(100) NOT NULL DEFAULT '';

-- One line per (booking, service, passenger) — duplicate attachment is
-- impossible even under retry races inside booking creation.
-- Note: Postgres treats NULL booking_passenger_id values as distinct, so
-- booking-scoped duplicates are rejected by the service layer before insert.
CREATE UNIQUE INDEX "booking_extras_booking_id_extra_service_id_booking_passenger_id_key" ON "booking_extras"("booking_id", "extra_service_id", "booking_passenger_id");

-- AddForeignKey
ALTER TABLE "booking_extras" ADD CONSTRAINT "booking_extras_booking_passenger_id_fkey" FOREIGN KEY ("booking_passenger_id") REFERENCES "booking_passengers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
