-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('HOTEL', 'PREVOZNIK', 'OSIGURAVAC', 'DRUGO');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SupplierContactStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ContractCurrency" AS ENUM ('EUR', 'RSD', 'USD');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "TipNastupanja" AS ENUM ('ORGANIZATOR', 'POSREDNIK');

-- CreateEnum
CREATE TYPE "AllotmentMode" AS ENUM ('FIXED', 'ON_REQUEST', 'CHARTER', 'FIXED_LEASE');

-- CreateEnum
CREATE TYPE "PriceBasis" AS ENUM ('PER_ROOM_PER_NIGHT', 'PER_PERSON_PER_NIGHT');

-- CreateEnum
CREATE TYPE "AgeCategory" AS ENUM ('ADULT', 'CHILD', 'TEEN', 'INFANT');

-- CreateEnum
CREATE TYPE "AgePricingMode" AS ENUM ('PERCENTAGE_OF_BASE_PRICE', 'FLAT_PRICE_PER_NIGHT');

-- CreateEnum
CREATE TYPE "PricelistSourceFormat" AS ENUM ('PDF', 'EXCEL', 'WORD', 'HTML', 'EMAIL', 'SCANNED_PDF');

-- CreateEnum
CREATE TYPE "PricelistImportStatus" AS ENUM ('PROCESSING', 'READY_FOR_REVIEW', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PricelistRowReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'MANUALLY_MATCHED', 'REJECTED');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SupplierType" NOT NULL,
    "tax_id" TEXT NOT NULL,
    "registration_number" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "bank_account" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "linked_user_id" TEXT,
    "status" "SupplierContactStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "contract_number" TEXT NOT NULL,
    "currency" "ContractCurrency" NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "cancellation_terms_summary" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "default_tip_nastupanja" "TipNastupanja",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_periods" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "stay_from" TIMESTAMP(3) NOT NULL,
    "stay_to" TIMESTAMP(3) NOT NULL,
    "room_type" TEXT NOT NULL,
    "allotment_mode" "AllotmentMode" NOT NULL,
    "total_capacity" INTEGER,
    "units_sold" INTEGER NOT NULL DEFAULT 0,
    "release_days_before" INTEGER,
    "ukupna_fiksna_obaveza" INTEGER,
    "fixed_obligation_currency" TEXT,
    "payment_schedule" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_lines" (
    "id" TEXT NOT NULL,
    "contract_period_id" TEXT NOT NULL,
    "board_type" TEXT NOT NULL,
    "occupancy" TEXT NOT NULL,
    "price_basis" "PriceBasis" NOT NULL,
    "price" INTEGER NOT NULL,
    "crib_fee_per_night" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_line_age_pricing" (
    "id" TEXT NOT NULL,
    "rate_line_id" TEXT NOT NULL,
    "age_category" "AgeCategory" NOT NULL,
    "occupant_index" INTEGER,
    "min_adults_present" INTEGER,
    "pricing_mode" "AgePricingMode" NOT NULL,
    "percentage" DECIMAL(65,30),
    "flat_price" INTEGER,

    CONSTRAINT "rate_line_age_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_rules" (
    "id" TEXT NOT NULL,
    "contract_period_id" TEXT NOT NULL,
    "days_before_stay" INTEGER NOT NULL,
    "refund_percentage" INTEGER NOT NULL,

    CONSTRAINT "cancellation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricelist_imports" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "source_file_url" TEXT NOT NULL,
    "source_format" "PricelistSourceFormat" NOT NULL,
    "status" "PricelistImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricelist_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricelist_import_rows" (
    "id" TEXT NOT NULL,
    "pricelist_import_id" TEXT NOT NULL,
    "extracted_hotel_name" TEXT NOT NULL,
    "matched_product_id" TEXT,
    "match_confidence" DECIMAL(65,30),
    "extracted_room_type" TEXT NOT NULL,
    "extracted_board_type" TEXT NOT NULL,
    "extracted_occupancy" TEXT NOT NULL,
    "extracted_stay_from" TIMESTAMP(3) NOT NULL,
    "extracted_stay_to" TIMESTAMP(3) NOT NULL,
    "extracted_price" INTEGER NOT NULL,
    "extracted_currency" TEXT NOT NULL,
    "extracted_price_basis" "PriceBasis",
    "extracted_age_pricing" JSONB,
    "extracted_crib_fee_per_night" INTEGER,
    "review_status" "PricelistRowReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,

    CONSTRAINT "pricelist_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_extraction_profiles" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "typical_price_basis" "PriceBasis",
    "typical_age_thresholds" JSONB,
    "structure_signature" JSONB,
    "last_confirmed_import_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_extraction_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_extraction_profiles_supplier_id_key" ON "supplier_extraction_profiles"("supplier_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_source_contract_id_fkey" FOREIGN KEY ("source_contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_periods" ADD CONSTRAINT "contract_periods_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_lines" ADD CONSTRAINT "rate_lines_contract_period_id_fkey" FOREIGN KEY ("contract_period_id") REFERENCES "contract_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_line_age_pricing" ADD CONSTRAINT "rate_line_age_pricing_rate_line_id_fkey" FOREIGN KEY ("rate_line_id") REFERENCES "rate_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_rules" ADD CONSTRAINT "cancellation_rules_contract_period_id_fkey" FOREIGN KEY ("contract_period_id") REFERENCES "contract_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricelist_imports" ADD CONSTRAINT "pricelist_imports_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricelist_import_rows" ADD CONSTRAINT "pricelist_import_rows_pricelist_import_id_fkey" FOREIGN KEY ("pricelist_import_id") REFERENCES "pricelist_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricelist_import_rows" ADD CONSTRAINT "pricelist_import_rows_matched_product_id_fkey" FOREIGN KEY ("matched_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_extraction_profiles" ADD CONSTRAINT "supplier_extraction_profiles_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
