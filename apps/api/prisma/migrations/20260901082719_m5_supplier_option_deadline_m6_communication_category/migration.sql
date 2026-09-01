-- CreateEnum
CREATE TYPE "CommunicationLogCategory" AS ENUM ('MARKETING', 'TRANSAKCIONO');

-- AlterTable
ALTER TABLE "booking_items" ADD COLUMN     "supplier_option_deadline" TIMESTAMP(3),
ADD COLUMN     "supplier_option_reminder_sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "communication_logs" ADD COLUMN     "category" "CommunicationLogCategory" NOT NULL DEFAULT 'MARKETING';
