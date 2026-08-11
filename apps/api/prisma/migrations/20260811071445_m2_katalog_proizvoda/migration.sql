-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT');

-- CreateEnum
CREATE TYPE "ProductSourceType" AS ENUM ('CONTRACTED', 'API');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VisibleChannel" AS ENUM ('B2C_SITE', 'B2B_PORTAL', 'MOBILE');

-- CreateEnum
CREATE TYPE "CacheStatus" AS ENUM ('N/A', 'NOT_CACHED', 'CACHED', 'STALE');

-- CreateEnum
CREATE TYPE "LanguageCode" AS ENUM ('sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr');

-- CreateEnum
CREATE TYPE "TranslationSource" AS ENUM ('MANUAL', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "ImportOrigin" AS ENUM ('MANUAL_URL', 'M23_RESEARCH');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'EXTRACTED', 'REVIEW_IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportFieldType" AS ENUM ('NAME', 'DESCRIPTION', 'AMENITY', 'ROOM_TYPE', 'PHOTO', 'LOCATION', 'SERVICE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED_AND_APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "source_type" "ProductSourceType" NOT NULL,
    "source_contract_id" TEXT,
    "source_provider" TEXT,
    "source_external_id" TEXT,
    "destination_country" TEXT NOT NULL,
    "destination_city" TEXT NOT NULL,
    "geo_lat" DECIMAL(65,30),
    "geo_lng" DECIMAL(65,30),
    "media" JSONB NOT NULL DEFAULT '[]',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "visible_channels" "VisibleChannel"[],
    "cache_status" "CacheStatus" NOT NULL DEFAULT 'N/A',
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translations" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "language_code" "LanguageCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "translation_source" "TranslationSource" NOT NULL DEFAULT 'MANUAL',
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_content_imports" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "source_url" TEXT,
    "origin" "ImportOrigin" NOT NULL DEFAULT 'MANUAL_URL',
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "extracted_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_content_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_content_import_fields" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "field_type" "ImportFieldType" NOT NULL,
    "extracted_value" JSONB NOT NULL,
    "match_confidence" DECIMAL(65,30),
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "source_article_revision_id" TEXT,

    CONSTRAINT "product_content_import_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_translations_product_id_language_code_key" ON "product_translations"("product_id", "language_code");

-- CreateIndex
CREATE UNIQUE INDEX "product_translations_language_code_slug_key" ON "product_translations"("language_code", "slug");

-- AddForeignKey
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_content_imports" ADD CONSTRAINT "product_content_imports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_content_import_fields" ADD CONSTRAINT "product_content_import_fields_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "product_content_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
