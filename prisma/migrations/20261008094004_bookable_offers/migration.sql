-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('PERCENT', 'FIXED_AMOUNT');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "offer_id" UUID;

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "cabin_class" "cabin_class",
ADD COLUMN     "discount_type" "discount_type",
ADD COLUMN     "discount_value" DECIMAL(12,2),
ADD COLUMN     "route_id" UUID;

-- CreateIndex
CREATE INDEX "bookings_offer_id_idx" ON "bookings"("offer_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
