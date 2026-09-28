-- DropIndex
DROP INDEX "fares_flight_id_cabin_class_key";

-- CreateIndex
CREATE INDEX "fares_flight_id_cabin_class_idx" ON "fares"("flight_id", "cabin_class");
