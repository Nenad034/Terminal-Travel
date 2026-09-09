-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PriceBasis" ADD VALUE 'PER_PERSON_PER_STAY';
ALTER TYPE "PriceBasis" ADD VALUE 'PER_ROOM_PER_STAY';

-- AlterTable
ALTER TABLE "ancillary_services" ADD COLUMN     "booking_from" DATE,
ADD COLUMN     "booking_to" DATE;

-- AlterTable
ALTER TABLE "cancellation_rules" ADD COLUMN     "booking_from" DATE,
ADD COLUMN     "booking_to" DATE;

-- AlterTable
ALTER TABLE "contract_periods" ADD COLUMN     "season_id" TEXT;

-- AlterTable
ALTER TABLE "rate_lines" ADD COLUMN     "booking_from" DATE,
ADD COLUMN     "booking_to" DATE;

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "rank" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_ranges" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,

    CONSTRAINT "season_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seasons_contract_id_idx" ON "seasons"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_contract_id_code_key" ON "seasons"("contract_id", "code");

-- CreateIndex
CREATE INDEX "season_ranges_season_id_idx" ON "season_ranges"("season_id");

-- CreateIndex
CREATE INDEX "contract_periods_season_id_idx" ON "contract_periods"("season_id");

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_ranges" ADD CONSTRAINT "season_ranges_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_periods" ADD CONSTRAINT "contract_periods_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
