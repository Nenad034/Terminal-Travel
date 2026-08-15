-- CreateEnum
CREATE TYPE "HealthSignalType" AS ENUM ('PROVIDER_ERROR_SPIKE', 'PAYMENT_FAILURE_SPIKE', 'GUEST_REGISTRATION_FAILED', 'FIELD_INCIDENT_URGENT', 'AUTH_ANOMALY', 'TOKEN_USAGE_ANOMALY', 'RECONCILIATION_MISMATCH', 'PROVIDER_DEGRADED', 'LOW_CAPACITY_CRITICAL', 'HELP_AGENT_ABUSE_PATTERN', 'PAYMENT_DEADLINE_MISSED');

-- CreateEnum
CREATE TYPE "HealthSignalSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HealthSignalSecurityCategory" AS ENUM ('AUTH', 'PII', 'GDPR', 'API_ABUSE', 'ENCRYPTION');

-- CreateEnum
CREATE TYPE "NotificationChannelType" AS ENUM ('TELEGRAM', 'EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationChannelStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProviderHealthStatus" AS ENUM ('ONLINE', 'UNSTABLE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "WeeklyHealthReviewStatus" AS ENUM ('GENERATED', 'SENT');

-- CreateEnum
CREATE TYPE "TrendSuggestionCategory" AS ENUM ('AGENTSKI_TURIZAM', 'PROIZVOD_UX', 'TEHNOLOGIJA');

-- CreateEnum
CREATE TYPE "TrendSuggestionStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuotaPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EnforcementState" AS ENUM ('NORMAL', 'DEGRADED');

-- CreateTable
CREATE TABLE "health_signals" (
    "id" TEXT NOT NULL,
    "source_module" TEXT NOT NULL,
    "signal_type" "HealthSignalType" NOT NULL,
    "severity" "HealthSignalSeverity" NOT NULL,
    "security_category" "HealthSignalSecurityCategory",
    "details" JSONB NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "health_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" TEXT NOT NULL,
    "channel_type" "NotificationChannelType" NOT NULL,
    "config_encrypted" TEXT NOT NULL,
    "recipient_role" TEXT NOT NULL,
    "status" "NotificationChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_health_snapshots" (
    "id" TEXT NOT NULL,
    "provider_code" TEXT NOT NULL,
    "latency_ms_avg" INTEGER NOT NULL,
    "uptime_percentage" DECIMAL(65,30) NOT NULL,
    "error_count_last_hour" INTEGER NOT NULL,
    "status" "ProviderHealthStatus" NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_health_reviews" (
    "id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "signals_included" JSONB NOT NULL,
    "status" "WeeklyHealthReviewStatus" NOT NULL DEFAULT 'GENERATED',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "weekly_health_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trend_suggestions" (
    "id" TEXT NOT NULL,
    "category" "TrendSuggestionCategory" NOT NULL,
    "summary" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "status" "TrendSuggestionStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trend_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_invocation_logs" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "action_code" TEXT NOT NULL,
    "model_tier" "ModelTier" NOT NULL,
    "model_identifier" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "estimated_cost_eur" DECIMAL(65,30) NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_invocation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_quotas" (
    "id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "period" "QuotaPeriod" NOT NULL,
    "quota_limit" INTEGER NOT NULL,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "budget_limit_eur" DECIMAL(65,30),
    "consumed_eur" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "enforcement_state" "EnforcementState" NOT NULL DEFAULT 'NORMAL',
    "degraded_at" TIMESTAMP(3),
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "alert_threshold_percentage" INTEGER NOT NULL DEFAULT 80,

    CONSTRAINT "ai_provider_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent_budgets" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "period" "QuotaPeriod" NOT NULL,
    "budget_limit_eur" DECIMAL(65,30) NOT NULL,
    "consumed_eur" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "enforcement_state" "EnforcementState" NOT NULL DEFAULT 'NORMAL',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,

    CONSTRAINT "ai_agent_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_quotas_provider_name_period_period_start_key" ON "ai_provider_quotas"("provider_name", "period", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "ai_agent_budgets_agent_id_period_period_start_key" ON "ai_agent_budgets"("agent_id", "period", "period_start");

-- AddForeignKey
ALTER TABLE "agent_invocation_logs" ADD CONSTRAINT "agent_invocation_logs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent_budgets" ADD CONSTRAINT "ai_agent_budgets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
