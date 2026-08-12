-- CreateEnum
CREATE TYPE "TravelGuaranteeStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'PENDING_RENEWAL');

-- CreateEnum
CREATE TYPE "TravelGuaranteeRegistrationStatus" AS ENUM ('PENDING', 'REGISTERED', 'RELEASE_PENDING', 'RELEASED', 'FAILED');

-- CreateTable
CREATE TABLE "travel_guarantees" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "policy_number" TEXT NOT NULL,
    "coverage_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "document_url" TEXT,
    "status" "TravelGuaranteeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_guarantees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_guarantee_registrations" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "travel_guarantee_id" TEXT NOT NULL,
    "cis_registration_number" TEXT,
    "status" "TravelGuaranteeRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "registered_at" TIMESTAMP(3),
    "release_requested_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_guarantee_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "travel_guarantee_registrations_booking_id_key" ON "travel_guarantee_registrations"("booking_id");

-- AddForeignKey
ALTER TABLE "travel_guarantee_registrations" ADD CONSTRAINT "travel_guarantee_registrations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_guarantee_registrations" ADD CONSTRAINT "travel_guarantee_registrations_travel_guarantee_id_fkey" FOREIGN KEY ("travel_guarantee_id") REFERENCES "travel_guarantees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
