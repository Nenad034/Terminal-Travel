-- CreateEnum
CREATE TYPE "CapacitySaleStatus" AS ENUM ('OPEN', 'STOP');

-- CreateEnum
CREATE TYPE "CapacityStopSource" AS ENUM ('SUPPLIER_EMAIL', 'SUPPLIER_PHONE', 'SUPPLIER_PORTAL', 'PROVIDER_API', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CapacityBlockStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONVERTED');

-- CreateTable
CREATE TABLE "capacity_days" (
    "id" TEXT NOT NULL,
    "contract_period_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "capacity_override" INTEGER,
    "sale_status" "CapacitySaleStatus" NOT NULL DEFAULT 'OPEN',
    "stop_reason" TEXT,
    "stop_source" "CapacityStopSource",
    "stop_set_by" TEXT,
    "stop_set_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capacity_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_blocks" (
    "id" TEXT NOT NULL,
    "contract_period_id" TEXT NOT NULL,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "units" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "hold_until" TIMESTAMP(3) NOT NULL,
    "status" "CapacityBlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "converted_booking_id" TEXT,
    "created_by" TEXT NOT NULL,
    "released_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capacity_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capacity_days_date_idx" ON "capacity_days"("date");

-- CreateIndex
CREATE UNIQUE INDEX "capacity_days_contract_period_id_date_key" ON "capacity_days"("contract_period_id", "date");

-- CreateIndex
CREATE INDEX "capacity_blocks_contract_period_id_idx" ON "capacity_blocks"("contract_period_id");

-- CreateIndex
CREATE INDEX "capacity_blocks_status_hold_until_idx" ON "capacity_blocks"("status", "hold_until");

-- AddForeignKey
ALTER TABLE "capacity_days" ADD CONSTRAINT "capacity_days_contract_period_id_fkey" FOREIGN KEY ("contract_period_id") REFERENCES "contract_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capacity_blocks" ADD CONSTRAINT "capacity_blocks_contract_period_id_fkey" FOREIGN KEY ("contract_period_id") REFERENCES "contract_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
