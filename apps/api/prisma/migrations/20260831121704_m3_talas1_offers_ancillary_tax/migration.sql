-- CreateEnum
CREATE TYPE "CommissionModel" AS ENUM ('NET', 'COMMISSIONABLE');

-- CreateEnum
CREATE TYPE "CancellationRuleType" AS ENUM ('PRE_ARRIVAL', 'EARLY_DEPARTURE');

-- CreateEnum
CREATE TYPE "EarlyDepartureBasis" AS ENUM ('PERCENTAGE_OF_REMAINING_STAY', 'FLAT_AMOUNT');

-- CreateEnum
CREATE TYPE "PricelistOfferType" AS ENUM ('EARLY_BOOKING', 'FREE_NIGHTS');

-- CreateEnum
CREATE TYPE "OfferDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "AncillaryPricingMode" AS ENUM ('FLAT_PER_UNIT', 'PERCENTAGE_OF_NIGHTLY_RATE');

-- CreateEnum
CREATE TYPE "AncillaryUnit" AS ENUM ('PER_STAY', 'PER_NIGHT', 'PER_DAY', 'PER_PERSON', 'PER_PET', 'PER_ROOM');

-- CreateEnum
CREATE TYPE "TouristTaxCollectedBy" AS ENUM ('PAID_ON_SITE_BY_GUEST', 'INVOICED_TO_AGENCY');

-- AlterTable
ALTER TABLE "cancellation_rules" ADD COLUMN     "early_departure_basis" "EarlyDepartureBasis",
ADD COLUMN     "early_departure_flat_amount" INTEGER,
ADD COLUMN     "early_departure_percentage" INTEGER,
ADD COLUMN     "rule_type" "CancellationRuleType" NOT NULL DEFAULT 'PRE_ARRIVAL',
ALTER COLUMN "days_before_stay" DROP NOT NULL,
ALTER COLUMN "refund_percentage" DROP NOT NULL;

-- AlterTable
ALTER TABLE "contract_periods" ADD COLUMN     "max_stay_nights" INTEGER,
ADD COLUMN     "min_stay_nights" INTEGER;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "commission_model" "CommissionModel",
ADD COLUMN     "commission_percentage" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "pricelist_offers" (
    "id" TEXT NOT NULL,
    "contract_period_id" TEXT NOT NULL,
    "offer_type" "PricelistOfferType" NOT NULL,
    "booking_from" TIMESTAMP(3) NOT NULL,
    "booking_to" TIMESTAMP(3) NOT NULL,
    "discount_type" "OfferDiscountType",
    "discount_percentage" DECIMAL(65,30),
    "discount_amount" INTEGER,
    "stay_nights" INTEGER,
    "pay_nights" INTEGER,
    "deposit_percentage" DECIMAL(65,30),
    "deposit_deadline" TIMESTAMP(3),
    "min_age" DECIMAL(65,30),
    "max_age" DECIMAL(65,30),
    "valid_arrival_weekdays" INTEGER[],
    "excluded_room_types" TEXT[],
    "combinable_with_other_offers" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricelist_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ancillary_services" (
    "id" TEXT NOT NULL,
    "contract_period_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricing_mode" "AncillaryPricingMode" NOT NULL,
    "flat_amount" INTEGER,
    "percentage_of_nightly_rate" DECIMAL(65,30),
    "unit" "AncillaryUnit" NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "is_refundable" BOOLEAN NOT NULL DEFAULT false,
    "max_quantity" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ancillary_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_tax_info" (
    "id" TEXT NOT NULL,
    "contract_period_id" TEXT NOT NULL,
    "included_in_price" BOOLEAN NOT NULL,
    "collected_by" "TouristTaxCollectedBy",
    "amount_per_night" INTEGER,
    "currency" TEXT,
    "tax_exempt_max_age" DECIMAL(65,30),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_tax_info_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tourist_tax_info_contract_period_id_key" ON "tourist_tax_info"("contract_period_id");

-- AddForeignKey
ALTER TABLE "pricelist_offers" ADD CONSTRAINT "pricelist_offers_contract_period_id_fkey" FOREIGN KEY ("contract_period_id") REFERENCES "contract_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ancillary_services" ADD CONSTRAINT "ancillary_services_contract_period_id_fkey" FOREIGN KEY ("contract_period_id") REFERENCES "contract_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tourist_tax_info" ADD CONSTRAINT "tourist_tax_info_contract_period_id_fkey" FOREIGN KEY ("contract_period_id") REFERENCES "contract_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
