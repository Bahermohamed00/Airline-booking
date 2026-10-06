-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(600) NOT NULL,
    "badge" VARCHAR(60),
    "destination" VARCHAR(120),
    "offer_value" VARCHAR(60),
    "terms" VARCHAR(600),
    "image_url" VARCHAR(500),
    "status" "offer_status" NOT NULL DEFAULT 'DRAFT',
    "valid_from" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "offers_title_key" ON "offers"("title");

-- CreateIndex
CREATE INDEX "offers_status_valid_from_valid_until_idx" ON "offers"("status", "valid_from", "valid_until");

