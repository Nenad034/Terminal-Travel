-- CreateEnum
CREATE TYPE "PricelistItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "ancillary_services" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "deactivated_by" TEXT,
ADD COLUMN     "replaces_id" TEXT,
ADD COLUMN     "status" "PricelistItemStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "cancellation_rules" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "deactivated_by" TEXT,
ADD COLUMN     "replaces_id" TEXT,
ADD COLUMN     "status" "PricelistItemStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "pricelist_offers" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "deactivated_by" TEXT,
ADD COLUMN     "replaces_id" TEXT,
ADD COLUMN     "status" "PricelistItemStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "rate_lines" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "deactivated_by" TEXT,
ADD COLUMN     "replaces_id" TEXT,
ADD COLUMN     "status" "PricelistItemStatus" NOT NULL DEFAULT 'ACTIVE';
