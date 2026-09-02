-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'CARD_MANUAL';
ALTER TYPE "PaymentMethod" ADD VALUE 'CHECK';
ALTER TYPE "PaymentMethod" ADD VALUE 'ADMINISTRATIVE_BAN';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "bank_id" TEXT;

-- CreateTable
CREATE TABLE "banks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_check_details" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "check_number" TEXT NOT NULL,
    "clearance_date" DATE NOT NULL,

    CONSTRAINT "payment_check_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "banks_name_key" ON "banks"("name");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_check_details" ADD CONSTRAINT "payment_check_details_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_check_details" ADD CONSTRAINT "payment_check_details_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
