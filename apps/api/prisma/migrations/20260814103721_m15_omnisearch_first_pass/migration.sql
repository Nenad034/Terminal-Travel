-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('GLAVNI_AGENT', 'DOMENSKI_AGENT', 'OMNISEARCH_AGENT');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ModelTier" AS ENUM ('LIGHT', 'STANDARD', 'HEAVY');

-- CreateEnum
CREATE TYPE "ModuleActivationStatus" AS ENUM ('NOT_READY', 'READY_FOR_ACTIVATION', 'ACTIVATED');

-- CreateEnum
CREATE TYPE "AgentActionTier" AS ENUM ('NEVER_AUTONOMOUS', 'PROPOSE_THEN_APPROVE', 'AUTONOMOUS');

-- CreateTable
CREATE TABLE "ai_agents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_role" "AgentRole" NOT NULL,
    "module_code" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'DISABLED',
    "model_tier" "ModelTier",
    "model_identifier" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_agent_activations" (
    "module_code" TEXT NOT NULL,
    "tests_passing" BOOLEAN NOT NULL DEFAULT false,
    "production_cycle_completed" BOOLEAN NOT NULL DEFAULT false,
    "status" "ModuleActivationStatus" NOT NULL DEFAULT 'NOT_READY',
    "activated_by" TEXT,
    "activated_at" TIMESTAMP(3),

    CONSTRAINT "module_agent_activations_pkey" PRIMARY KEY ("module_code")
);

-- CreateTable
CREATE TABLE "agent_action_types" (
    "id" TEXT NOT NULL,
    "module_code" TEXT,
    "action_code" TEXT NOT NULL,
    "tier" "AgentActionTier" NOT NULL,
    "source_note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_action_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_agents_user_id_key" ON "ai_agents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_action_types_module_code_action_code_key" ON "agent_action_types"("module_code", "action_code");
