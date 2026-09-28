-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "flight_id" UUID NOT NULL,
    "cabin_class" "cabin_class" NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "discount_percentage" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "offer_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offers_status_starts_at_ends_at_idx" ON "offers"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "offers_flight_id_idx" ON "offers"("flight_id");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_flight_id_fkey" FOREIGN KEY ("flight_id") REFERENCES "flights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
