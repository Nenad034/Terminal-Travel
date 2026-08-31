-- AlterTable
ALTER TABLE "itinerary_segments" ADD COLUMN     "is_included" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "occupancy" JSONB,
ADD COLUMN     "preview_base_cost" INTEGER,
ADD COLUMN     "preview_final_price" INTEGER,
ADD COLUMN     "preview_final_price_currency" TEXT,
ADD COLUMN     "preview_source_type" "ProductSourceType";
