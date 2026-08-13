-- CreateEnum
CREATE TYPE "McpAccessLevel" AS ENUM ('READ_ONLY', 'READ_WRITE');

-- CreateEnum
CREATE TYPE "McpClientStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "mcp_client_registrations" (
    "id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "credentials_encrypted" TEXT NOT NULL,
    "access_level" "McpAccessLevel" NOT NULL DEFAULT 'READ_ONLY',
    "status" "McpClientStatus" NOT NULL DEFAULT 'PENDING',
    "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60,
    "linked_user_id" TEXT,
    "linked_client_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_client_registrations_pkey" PRIMARY KEY ("id")
);
