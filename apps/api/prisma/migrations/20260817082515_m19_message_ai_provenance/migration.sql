-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "drafted_by_agent_id" TEXT,
ADD COLUMN     "drafted_by_ai" BOOLEAN NOT NULL DEFAULT false;
