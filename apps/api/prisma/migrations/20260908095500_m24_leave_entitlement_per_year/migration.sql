-- M24 spec §2.2a (predlog v1.5) — annual_leave_days_entitled (flat, bez veze za godinu) na
-- employee_records zamenjen entitetom leave_entitlements (jedan red po zaposlenom po godini).

-- CreateTable
CREATE TABLE "leave_entitlements" (
    "id" TEXT NOT NULL,
    "employee_record_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "days_entitled" INTEGER NOT NULL,
    "carried_over_days" INTEGER,
    "carried_over_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "leave_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_entitlements_employee_record_id_idx" ON "leave_entitlements"("employee_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_entitlements_employee_record_id_year_key" ON "leave_entitlements"("employee_record_id", "year");

-- AddForeignKey
ALTER TABLE "leave_entitlements" ADD CONSTRAINT "leave_entitlements_employee_record_id_fkey" FOREIGN KEY ("employee_record_id") REFERENCES "employee_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: postojeće annual_leave_days_entitled vrednosti postaju leave_entitlements red za
-- TEKUĆU godinu (izvršenja migracije) — ne gubi se već uneti podatak (spec v1.5 zahtev).
INSERT INTO "leave_entitlements" ("id", "employee_record_id", "year", "days_entitled", "created_at", "updated_at", "updated_by_user_id")
SELECT gen_random_uuid(), "id", EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, "annual_leave_days_entitled", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "updated_by_user_id"
FROM "employee_records"
WHERE "annual_leave_days_entitled" IS NOT NULL;

-- AlterTable
ALTER TABLE "employee_records" DROP COLUMN "annual_leave_days_entitled";
