-- Flight trip type: schedule attribute only (one-way vs out-and-back).
-- Flights remain independent records; no return-flight linking. Existing
-- flights default to ONE_WAY. Additive only.

-- CreateEnum
CREATE TYPE "trip_type" AS ENUM ('ONE_WAY', 'ROUND_TRIP');

-- AlterTable
ALTER TABLE "flights" ADD COLUMN "trip_type" "trip_type" NOT NULL DEFAULT 'ONE_WAY';
