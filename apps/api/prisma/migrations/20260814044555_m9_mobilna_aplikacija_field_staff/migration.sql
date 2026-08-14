-- CreateEnum
CREATE TYPE "FieldIncidentSeverity" AS ENUM ('INFO', 'WARNING', 'URGENT');

-- AlterTable
ALTER TABLE "booking_item_guests" DROP CONSTRAINT "booking_item_guests_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "booking_item_guests_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "field_check_ins" (
    "id" TEXT NOT NULL,
    "booking_item_guest_id" TEXT NOT NULL,
    "checked_in_at" TIMESTAMP(3) NOT NULL,
    "checked_in_by" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "field_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_incident_notes" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "guide_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "severity" "FieldIncidentSeverity" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "field_incident_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_item_guests_booking_item_id_guest_first_name_guest__key" ON "booking_item_guests"("booking_item_id", "guest_first_name", "guest_last_name");

