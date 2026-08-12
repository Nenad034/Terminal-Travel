-- CreateEnum
CREATE TYPE "ClientAccountType" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY');

-- CreateEnum
CREATE TYPE "GuestDocumentType" AS ENUM ('PASSPORT', 'LICNA_KARTA');

-- CreateEnum
CREATE TYPE "LoyaltyQualificationMetric" AS ENUM ('TOTAL_SPEND_RSD', 'BOOKING_COUNT', 'NIGHT_COUNT');

-- CreateEnum
CREATE TYPE "LoyaltyQualificationPeriod" AS ENUM ('LIFETIME', 'ROLLING_12_MONTHS', 'CALENDAR_YEAR');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "PostTripSurveyStatus" AS ENUM ('PENDING', 'SENT', 'COMPLETED');

-- CreateTable
CREATE TABLE "client_accounts" (
    "id" TEXT NOT NULL,
    "account_type" "ClientAccountType" NOT NULL,
    "full_name" TEXT,
    "company_name" TEXT,
    "tax_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "country" TEXT,
    "preferred_language" "LanguageCode",
    "linked_user_id" TEXT,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent_date" TIMESTAMP(3),
    "tags" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_profiles" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "document_type" "GuestDocumentType" NOT NULL,
    "document_number" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "preferences" JSONB,
    "linked_client_account_id" TEXT,
    "linked_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "qualification_metric" "LoyaltyQualificationMetric" NOT NULL,
    "qualification_period" "LoyaltyQualificationPeriod" NOT NULL,
    "threshold" DECIMAL(65,30) NOT NULL,
    "discount_percentage" DECIMAL(65,30) NOT NULL,
    "benefit_description" TEXT,

    CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_loyalty_statuses" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "current_tier_id" TEXT,
    "calculated_metric_value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tier_since" TIMESTAMP(3),
    "last_recalculated_at" TIMESTAMP(3),
    "manual_override_tier_id" TEXT,
    "manual_override_reason" TEXT,
    "manual_override_by" TEXT,

    CONSTRAINT "client_loyalty_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT,
    "guest_profile_id" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "summary" TEXT NOT NULL,
    "drafted_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "sent_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_trip_surveys" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "status" "PostTripSurveyStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_send_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "responses" JSONB,
    "overall_rating" INTEGER,
    "wants_google_review" BOOLEAN,
    "google_review_clicked_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_trip_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_loyalty_statuses_client_account_id_key" ON "client_loyalty_statuses"("client_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_trip_surveys_booking_id_key" ON "post_trip_surveys"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_trip_surveys_access_token_key" ON "post_trip_surveys"("access_token");

-- AddForeignKey
ALTER TABLE "guest_profiles" ADD CONSTRAINT "guest_profiles_linked_client_account_id_fkey" FOREIGN KEY ("linked_client_account_id") REFERENCES "client_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_loyalty_statuses" ADD CONSTRAINT "client_loyalty_statuses_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_loyalty_statuses" ADD CONSTRAINT "client_loyalty_statuses_current_tier_id_fkey" FOREIGN KEY ("current_tier_id") REFERENCES "loyalty_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_loyalty_statuses" ADD CONSTRAINT "client_loyalty_statuses_manual_override_tier_id_fkey" FOREIGN KEY ("manual_override_tier_id") REFERENCES "loyalty_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_guest_profile_id_fkey" FOREIGN KEY ("guest_profile_id") REFERENCES "guest_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_trip_surveys" ADD CONSTRAINT "post_trip_surveys_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_trip_surveys" ADD CONSTRAINT "post_trip_surveys_client_account_id_fkey" FOREIGN KEY ("client_account_id") REFERENCES "client_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
