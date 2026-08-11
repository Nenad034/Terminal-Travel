-- CreateEnum
CREATE TYPE "ProviderCategory" AS ENUM ('HOTEL', 'FLIGHT', 'TRANSFER', 'ACTIVITY', 'INSURANCE');

-- CreateEnum
CREATE TYPE "ProviderAuthStrategy" AS ENUM ('API_KEY', 'BASIC', 'OAUTH2_CLIENT_CREDENTIALS', 'REQUEST_SIGNING', 'SESSION_TOKEN');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CircuitState" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateEnum
CREATE TYPE "ProviderCallOperation" AS ENUM ('SEARCH', 'CONTENT', 'AVAILABILITY', 'BOOK', 'CANCEL');

-- CreateEnum
CREATE TYPE "ProviderCallErrorCode" AS ENUM ('TIMEOUT', 'RATE_LIMITED', 'AUTH_FAILED', 'INVALID_REQUEST', 'NO_AVAILABILITY', 'PROVIDER_UNAVAILABLE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL,
    "provider_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "category" "ProviderCategory" NOT NULL,
    "auth_config_encrypted" TEXT NOT NULL,
    "auth_strategy" "ProviderAuthStrategy" NOT NULL,
    "capabilities_profile" JSONB NOT NULL DEFAULT '{}',
    "status" "ProviderStatus" NOT NULL DEFAULT 'INACTIVE',
    "timeout_search_ms" INTEGER NOT NULL,
    "timeout_booking_ms" INTEGER NOT NULL,
    "circuit_state" "CircuitState" NOT NULL DEFAULT 'CLOSED',
    "circuit_failure_threshold" INTEGER NOT NULL DEFAULT 5,
    "circuit_cooldown_seconds" INTEGER NOT NULL DEFAULT 60,
    "circuit_consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "circuit_opened_at" TIMESTAMP(3),
    "default_tip_nastupanja" "TipNastupanja",
    "use_mock" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_call_logs" (
    "id" TEXT NOT NULL,
    "provider_code" TEXT NOT NULL,
    "operation" "ProviderCallOperation" NOT NULL,
    "request_summary" JSONB NOT NULL,
    "response_status" TEXT NOT NULL,
    "error_code" "ProviderCallErrorCode",
    "latency_ms" INTEGER NOT NULL,
    "error_message" TEXT,
    "idempotency_key" TEXT,
    "response_body" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_provider_code_key" ON "provider_configs"("provider_code");

-- AddForeignKey
ALTER TABLE "provider_call_logs" ADD CONSTRAINT "provider_call_logs_provider_code_fkey" FOREIGN KEY ("provider_code") REFERENCES "provider_configs"("provider_code") ON DELETE RESTRICT ON UPDATE CASCADE;
