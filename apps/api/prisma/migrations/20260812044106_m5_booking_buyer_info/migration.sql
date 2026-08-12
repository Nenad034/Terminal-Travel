/*
  Warnings:

  - Added the required column `buyer_name` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `buyer_type` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('FIZICKO_LICE', 'PRAVNO_LICE');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "buyer_name" TEXT NOT NULL,
ADD COLUMN     "buyer_tax_id" TEXT,
ADD COLUMN     "buyer_type" "BuyerType" NOT NULL;
