-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "leave_records" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_user_id" TEXT,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING';
