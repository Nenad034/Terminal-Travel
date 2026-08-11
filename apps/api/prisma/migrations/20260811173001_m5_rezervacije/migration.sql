-- CreateEnum
CREATE TYPE "M5Channel" AS ENUM ('B2C_SITE', 'B2B_PORTAL', 'MOBILE', 'INTERNAL_PANEL', 'PHONE');

-- CreateEnum
CREATE TYPE "MarkupScopeType" AS ENUM ('M3_SUPPLIER', 'M3_CONTRACT', 'M3_CONTRACT_PERIOD', 'M4_PROVIDER', 'M2_PRODUCT');

-- CreateEnum
CREATE TYPE "ItineraryStatus" AS ENUM ('DRAFT', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_SUPPLIER_CONFIRMATION', 'CONFIRMED', 'MODIFIED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'INVOICE_PENDING');

-- CreateEnum
CREATE TYPE "BookingItemStatus" AS ENUM ('CONFIRMED', 'PENDING_SUPPLIER_CONFIRMATION', 'CANCELLED');

-- CreateTable
CREATE TABLE "markup_rules" (
    "id" TEXT NOT NULL,
    "scope_type" "MarkupScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "percentage" DECIMAL(65,30),
    "fixed_amount" INTEGER,
    "fixed_amount_currency" TEXT,
    "active_from" TIMESTAMP(3),
    "active_to" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markup_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itineraries" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT,
    "channel" "M5Channel" NOT NULL,
    "status" "ItineraryStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_segments" (
    "id" TEXT NOT NULL,
    "itinerary_id" TEXT NOT NULL,
    "sequence_order" INTEGER NOT NULL,
    "product_id" TEXT,
    "destination_country" TEXT,
    "destination_city" TEXT,
    "stay_from" TIMESTAMP(3),
    "stay_to" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "itinerary_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT,
    "channel" "M5Channel" NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "itinerary_id" TEXT,
    "contract_terms_accepted" BOOLEAN NOT NULL DEFAULT false,
    "contract_terms_accepted_at" TIMESTAMP(3),
    "created_by" TEXT,
    "referral_tracking_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source_type" "ProductSourceType" NOT NULL,
    "stay_from" TIMESTAMP(3) NOT NULL,
    "stay_to" TIMESTAMP(3) NOT NULL,
    "occupancy" JSONB NOT NULL,
    "base_cost" INTEGER NOT NULL,
    "base_cost_currency" TEXT NOT NULL,
    "rate_line_id" TEXT,
    "markup_rule_id" TEXT NOT NULL,
    "final_price" INTEGER NOT NULL,
    "final_price_currency" TEXT NOT NULL,
    "provider_quote_reference" TEXT,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "booking_number" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "channel" "M5Channel" NOT NULL,
    "tip_nastupanja" "TipNastupanja" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_SUPPLIER_CONFIRMATION',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "total_price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "voucher_url" TEXT,
    "voucher_override_approved_by" TEXT,
    "voucher_override_reason" TEXT,
    "voucher_override_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "referral_tracking_code" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_items" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source_type" "ProductSourceType" NOT NULL,
    "supplier_reference" TEXT NOT NULL,
    "stay_from" TIMESTAMP(3) NOT NULL,
    "stay_to" TIMESTAMP(3) NOT NULL,
    "base_cost" INTEGER NOT NULL,
    "base_cost_currency" TEXT NOT NULL,
    "rate_line_id" TEXT,
    "markup_rule_id" TEXT NOT NULL,
    "final_price" INTEGER NOT NULL,
    "final_price_currency" TEXT NOT NULL,
    "item_status" "BookingItemStatus" NOT NULL DEFAULT 'CONFIRMED',
    "cancellation_refund_percentage" INTEGER,
    "assigned_guide_id" TEXT,
    "duplicate_conflict_item_id" TEXT,
    "duplicate_check_overridden_by" TEXT,
    "duplicate_check_overridden_at" TIMESTAMP(3),
    "announced_at" TIMESTAMP(3),
    "supplier_confirmed_at" TIMESTAMP(3),
    "supplier_confirmed_by" TEXT,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_item_guests" (
    "booking_item_id" TEXT NOT NULL,
    "guest_profile_id" TEXT,
    "guest_first_name" TEXT NOT NULL,
    "guest_last_name" TEXT NOT NULL,

    CONSTRAINT "booking_item_guests_pkey" PRIMARY KEY ("booking_item_id","guest_first_name","guest_last_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_number_key" ON "bookings"("booking_number");

-- AddForeignKey
ALTER TABLE "itinerary_segments" ADD CONSTRAINT "itinerary_segments_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_segments" ADD CONSTRAINT "itinerary_segments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "itineraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_rate_line_id_fkey" FOREIGN KEY ("rate_line_id") REFERENCES "rate_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_markup_rule_id_fkey" FOREIGN KEY ("markup_rule_id") REFERENCES "markup_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_rate_line_id_fkey" FOREIGN KEY ("rate_line_id") REFERENCES "rate_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_markup_rule_id_fkey" FOREIGN KEY ("markup_rule_id") REFERENCES "markup_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_item_guests" ADD CONSTRAINT "booking_item_guests_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- M5 poglavlje 8 — SupplierManifest/SupplierManifestItem/SupplierChangeNotice/
-- SupplierAnnouncementRule (dodato u istom prolazu kao poglavlje 8 implementacije)
-- ============================================================================

-- CreateEnum
CREATE TYPE "SupplierManifestStatus" AS ENUM ('DRAFT', 'SENT', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SupplierManifestLanguage" AS ENUM ('SR', 'EN');

-- CreateEnum
CREATE TYPE "SupplierChangeNoticeType" AS ENUM ('MODIFICATION', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "SupplierChangeNoticeStatus" AS ENUM ('DRAFT', 'SENT');

-- CreateEnum
CREATE TYPE "AnnouncementTriggerCondition" AS ENUM ('DAYS_BEFORE_STAY', 'ON_CONFIRMATION', 'AFTER_DEPOSIT_PAID', 'AFTER_FULL_PAYMENT');

-- CreateTable
CREATE TABLE "supplier_manifests" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "contract_period_id" TEXT,
    "supplier_type_snapshot" "SupplierType" NOT NULL,
    "language" "SupplierManifestLanguage" NOT NULL DEFAULT 'SR',
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "status" "SupplierManifestStatus" NOT NULL DEFAULT 'DRAFT',
    "document_url" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "sent_by" TEXT,
    "sent_to_email" TEXT,
    "reference_code" TEXT,
    "confirmation_email_thread_id" TEXT,
    "supersedes_manifest_id" TEXT,

    CONSTRAINT "supplier_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_manifest_items" (
    "supplier_manifest_id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "included_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_manifest_items_pkey" PRIMARY KEY ("supplier_manifest_id","booking_item_id")
);

-- CreateTable
CREATE TABLE "supplier_change_notices" (
    "id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "notice_type" "SupplierChangeNoticeType" NOT NULL,
    "reference_code" TEXT NOT NULL,
    "status" "SupplierChangeNoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "sent_by" TEXT,
    "supplier_confirmed_at" TIMESTAMP(3),
    "supplier_confirmed_by" TEXT,
    "confirmation_email_thread_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_change_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_announcement_rules" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "trigger_condition" "AnnouncementTriggerCondition" NOT NULL,
    "days_before_stay" INTEGER,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_announcement_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_manifests_reference_code_key" ON "supplier_manifests"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_change_notices_reference_code_key" ON "supplier_change_notices"("reference_code");

-- AddForeignKey
ALTER TABLE "supplier_manifests" ADD CONSTRAINT "supplier_manifests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_manifests" ADD CONSTRAINT "supplier_manifests_contract_period_id_fkey" FOREIGN KEY ("contract_period_id") REFERENCES "contract_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_manifests" ADD CONSTRAINT "supplier_manifests_supersedes_manifest_id_fkey" FOREIGN KEY ("supersedes_manifest_id") REFERENCES "supplier_manifests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_manifest_items" ADD CONSTRAINT "supplier_manifest_items_supplier_manifest_id_fkey" FOREIGN KEY ("supplier_manifest_id") REFERENCES "supplier_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_manifest_items" ADD CONSTRAINT "supplier_manifest_items_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_change_notices" ADD CONSTRAINT "supplier_change_notices_booking_item_id_fkey" FOREIGN KEY ("booking_item_id") REFERENCES "booking_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_announcement_rules" ADD CONSTRAINT "supplier_announcement_rules_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
