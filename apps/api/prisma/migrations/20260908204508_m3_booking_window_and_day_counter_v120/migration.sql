-- AlterTable
ALTER TABLE "capacity_days" ADD COLUMN     "units_reserved" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "contract_periods" ADD COLUMN     "booking_from" DATE,
ADD COLUMN     "booking_to" DATE;
