/*
  Warnings:

  - Added the required column `booking_id` to the `fact_bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "fact_bookings" ADD COLUMN     "booking_id" TEXT NOT NULL;
