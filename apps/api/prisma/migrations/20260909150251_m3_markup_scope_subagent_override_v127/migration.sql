-- CreateEnum
CREATE TYPE "SubagentCommissionScopeType" AS ENUM ('M3_CONTRACT', 'M3_SEASON', 'M3_CONTRACT_PERIOD', 'M3_RATE_LINE', 'M3_ANCILLARY_SERVICE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarkupScopeType" ADD VALUE 'M3_RATE_LINE';
ALTER TYPE "MarkupScopeType" ADD VALUE 'M3_ANCILLARY_SERVICE';

-- CreateTable
CREATE TABLE "subagent_commission_overrides" (
    "id" TEXT NOT NULL,
    "subagent_id" TEXT,
    "scope_type" "SubagentCommissionScopeType" NOT NULL,
    "scope_id" TEXT NOT NULL,
    "no_commission" BOOLEAN NOT NULL DEFAULT false,
    "percentage" DECIMAL(65,30),
    "fixed_amount" INTEGER,
    "active_from" DATE,
    "active_to" DATE,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subagent_commission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subagent_commission_overrides_scope_type_scope_id_idx" ON "subagent_commission_overrides"("scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "subagent_commission_overrides_subagent_id_idx" ON "subagent_commission_overrides"("subagent_id");
