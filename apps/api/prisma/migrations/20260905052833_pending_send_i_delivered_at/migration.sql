-- AlterEnum
ALTER TYPE "SupplierChangeNoticeStatus" ADD VALUE 'PENDING_SEND';

-- AlterEnum
ALTER TYPE "SupplierManifestStatus" ADD VALUE 'PENDING_SEND';

-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN     "delivered_at" TIMESTAMP(3);
