-- AlterEnum
ALTER TYPE "ProductSourceType" ADD VALUE 'MANUAL';

-- DropForeignKey
ALTER TABLE "booking_items" DROP CONSTRAINT "booking_items_markup_rule_id_fkey";

-- AlterTable
ALTER TABLE "booking_items" ALTER COLUMN "markup_rule_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "supplier_id" TEXT;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_markup_rule_id_fkey" FOREIGN KEY ("markup_rule_id") REFERENCES "markup_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
