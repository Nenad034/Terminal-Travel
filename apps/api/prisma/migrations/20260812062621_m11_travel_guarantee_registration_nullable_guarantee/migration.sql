-- DropForeignKey
ALTER TABLE "travel_guarantee_registrations" DROP CONSTRAINT "travel_guarantee_registrations_travel_guarantee_id_fkey";

-- AlterTable
ALTER TABLE "travel_guarantee_registrations" ALTER COLUMN "travel_guarantee_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "travel_guarantee_registrations" ADD CONSTRAINT "travel_guarantee_registrations_travel_guarantee_id_fkey" FOREIGN KEY ("travel_guarantee_id") REFERENCES "travel_guarantees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
