-- AlterTable
ALTER TABLE "subagents" ALTER COLUMN "commission_percentage" DROP NOT NULL,
ALTER COLUMN "credit_limit" DROP NOT NULL,
ALTER COLUMN "credit_limit_currency" DROP NOT NULL;
