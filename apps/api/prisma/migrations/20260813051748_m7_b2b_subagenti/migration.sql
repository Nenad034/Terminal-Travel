-- CreateEnum
CREATE TYPE "SubagentStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CommissionVolumeMetric" AS ENUM ('TOTAL_SALES_RSD', 'BOOKING_COUNT', 'NIGHT_COUNT');

-- CreateEnum
CREATE TYPE "CommissionVolumePeriod" AS ENUM ('CALENDAR_QUARTER', 'CALENDAR_YEAR', 'ROLLING_12_MONTHS');

-- CreateEnum
CREATE TYPE "CommissionRebateStatus" AS ENUM ('DRAFT', 'APPROVED', 'APPLIED', 'REJECTED');

-- CreateTable
CREATE TABLE "subagents" (
    "id" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "parent_subagent_id" TEXT,
    "status" "SubagentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "commission_percentage" DECIMAL(65,30) NOT NULL,
    "credit_limit" DECIMAL(65,30) NOT NULL,
    "credit_limit_currency" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subagents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_volume_tiers" (
    "id" TEXT NOT NULL,
    "subagent_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "threshold_metric" "CommissionVolumeMetric" NOT NULL,
    "threshold_period" "CommissionVolumePeriod" NOT NULL,
    "threshold_value" DECIMAL(65,30) NOT NULL,
    "resulting_commission_percentage" DECIMAL(65,30),
    "resulting_commission_fixed_amount" DECIMAL(65,30),
    "resulting_commission_currency" TEXT,
    "retroactive" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_volume_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subagent_volume_statuses" (
    "id" TEXT NOT NULL,
    "subagent_id" TEXT NOT NULL,
    "calculated_metric_value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "current_tier_id" TEXT,
    "effective_commission_percentage" DECIMAL(65,30) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "last_recalculated_at" TIMESTAMP(3),

    CONSTRAINT "subagent_volume_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rebates" (
    "id" TEXT NOT NULL,
    "subagent_id" TEXT NOT NULL,
    "triggering_tier_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "calculated_amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "CommissionRebateStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_rebates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subagents_client_account_id_key" ON "subagents"("client_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "subagent_volume_statuses_subagent_id_key" ON "subagent_volume_statuses"("subagent_id");

-- AddForeignKey
ALTER TABLE "subagents" ADD CONSTRAINT "subagents_parent_subagent_id_fkey" FOREIGN KEY ("parent_subagent_id") REFERENCES "subagents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_volume_tiers" ADD CONSTRAINT "commission_volume_tiers_subagent_id_fkey" FOREIGN KEY ("subagent_id") REFERENCES "subagents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subagent_volume_statuses" ADD CONSTRAINT "subagent_volume_statuses_subagent_id_fkey" FOREIGN KEY ("subagent_id") REFERENCES "subagents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subagent_volume_statuses" ADD CONSTRAINT "subagent_volume_statuses_current_tier_id_fkey" FOREIGN KEY ("current_tier_id") REFERENCES "commission_volume_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rebates" ADD CONSTRAINT "commission_rebates_subagent_id_fkey" FOREIGN KEY ("subagent_id") REFERENCES "subagents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rebates" ADD CONSTRAINT "commission_rebates_triggering_tier_id_fkey" FOREIGN KEY ("triggering_tier_id") REFERENCES "commission_volume_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
