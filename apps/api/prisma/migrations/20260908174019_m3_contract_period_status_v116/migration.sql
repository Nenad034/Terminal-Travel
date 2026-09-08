-- CreateEnum
CREATE TYPE "ContractPeriodStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "contract_periods" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "deactivated_by" TEXT,
ADD COLUMN     "status" "ContractPeriodStatus" NOT NULL DEFAULT 'ACTIVE';
