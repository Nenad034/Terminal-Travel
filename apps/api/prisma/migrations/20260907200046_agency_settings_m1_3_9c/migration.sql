-- CreateTable
CREATE TABLE "agency_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "brand_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "address" TEXT,
    "tax_id" TEXT,
    "license_number" TEXT,
    "emergency_contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "agency_settings_pkey" PRIMARY KEY ("id")
);
