-- CreateEnum
CREATE TYPE "weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "schedule_rule_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "flights" ADD COLUMN     "operating_date" DATE,
ADD COLUMN     "schedule_rule_id" UUID;

-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "aircraft_id" UUID NOT NULL,
    "flight_number" VARCHAR(20) NOT NULL,
    "departure_time_local" VARCHAR(5) NOT NULL,
    "operating_days" "weekday"[],
    "effective_from" DATE NOT NULL,
    "effective_to" DATE NOT NULL,
    "status" "schedule_rule_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_rules_flight_number_key" ON "schedule_rules"("flight_number");

-- CreateIndex
CREATE INDEX "flights_operating_date_idx" ON "flights"("operating_date");

-- CreateIndex
CREATE UNIQUE INDEX "flights_schedule_rule_id_operating_date_key" ON "flights"("schedule_rule_id", "operating_date");

-- AddForeignKey
ALTER TABLE "flights" ADD CONSTRAINT "flights_schedule_rule_id_fkey" FOREIGN KEY ("schedule_rule_id") REFERENCES "schedule_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_aircraft_id_fkey" FOREIGN KEY ("aircraft_id") REFERENCES "aircraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

