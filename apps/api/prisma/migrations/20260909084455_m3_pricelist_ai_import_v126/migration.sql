-- AlterEnum
ALTER TYPE "AgentRole" ADD VALUE 'PRICELIST_IMPORT_AGENT';

-- AlterEnum
ALTER TYPE "PricelistImportStatus" ADD VALUE 'FAILED';

-- AlterEnum
ALTER TYPE "PricelistSourceFormat" ADD VALUE 'PASTED_TEXT';

-- AlterTable
ALTER TABLE "pricelist_imports" ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "source_text" TEXT,
ALTER COLUMN "source_file_url" DROP NOT NULL;
