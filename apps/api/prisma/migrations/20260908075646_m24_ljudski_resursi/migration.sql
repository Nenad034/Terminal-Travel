-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PUNO_RADNO_VREME', 'NEPUNO_RADNO_VREME', 'UGOVOR_O_DELU');

-- CreateEnum
CREATE TYPE "ContractBasis" AS ENUM ('NEODREDJENO', 'ODREDJENO');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('GODISNJI_ODMOR', 'BOLOVANJE', 'NEPLACENO_ODSUSTVO', 'OSTALO');

-- CreateTable
CREATE TABLE "employee_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "employment_type" "EmploymentType" NOT NULL,
    "contract_basis" "ContractBasis" NOT NULL,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "probation_end_date" TIMESTAMP(3),
    "contract_end_date" TIMESTAMP(3),
    "termination_date" TIMESTAMP(3),
    "reports_to_user_id" TEXT,
    "annual_leave_days_entitled" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" TEXT,

    CONSTRAINT "employee_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_records" (
    "id" TEXT NOT NULL,
    "employee_record_id" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "days_count" INTEGER NOT NULL,
    "note" TEXT,
    "recorded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_certifications" (
    "id" TEXT NOT NULL,
    "employee_record_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "training_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_records_user_id_key" ON "employee_records"("user_id");

-- CreateIndex
CREATE INDEX "leave_records_employee_record_id_idx" ON "leave_records"("employee_record_id");

-- CreateIndex
CREATE INDEX "training_certifications_employee_record_id_idx" ON "training_certifications"("employee_record_id");

-- AddForeignKey
ALTER TABLE "employee_records" ADD CONSTRAINT "employee_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_employee_record_id_fkey" FOREIGN KEY ("employee_record_id") REFERENCES "employee_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_certifications" ADD CONSTRAINT "training_certifications_employee_record_id_fkey" FOREIGN KEY ("employee_record_id") REFERENCES "employee_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
