/*
  Warnings:

  - You are about to drop the column `unit` on the `ancillary_services` table. All the data in the column will be lost.
  - Added the required column `price_basis` to the `ancillary_services` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AncillaryPriceBasis" AS ENUM ('PER_PERSON_PER_NIGHT', 'PER_ROOM_PER_NIGHT', 'PER_PERSON_PER_STAY', 'PER_ROOM_PER_STAY', 'PER_PET_PER_NIGHT', 'PER_PET_PER_STAY');

-- CreateEnum
CREATE TYPE "AncillaryKind" AS ENUM ('SURCHARGE', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "AncillaryPayable" AS ENUM ('AGENCY', 'ON_SITE');

-- AlterTable
ALTER TABLE "ancillary_services" DROP COLUMN "unit",
ADD COLUMN     "child_max_age" DECIMAL(65,30),
ADD COLUMN     "covers_persons" INTEGER,
ADD COLUMN     "kind" "AncillaryKind" NOT NULL DEFAULT 'SURCHARGE',
ADD COLUMN     "max_adults" INTEGER,
ADD COLUMN     "max_children" INTEGER,
ADD COLUMN     "payable" "AncillaryPayable" NOT NULL DEFAULT 'AGENCY',
ADD COLUMN     "price_basis" "AncillaryPriceBasis" NOT NULL;

-- AlterTable
ALTER TABLE "booking_items" ADD COLUMN     "ancillary_service_id" TEXT,
ADD COLUMN     "parent_item_id" TEXT,
ADD COLUMN     "payable" "AncillaryPayable" NOT NULL DEFAULT 'AGENCY';

-- DropEnum
DROP TYPE "AncillaryUnit";

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "booking_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
