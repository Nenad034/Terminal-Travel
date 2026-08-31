-- CreateEnum
CREATE TYPE "BookingHandoffStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubagentPrivilegeLevel" AS ENUM ('STANDARD', 'FRANCHISE');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "assigned_to_id" TEXT,
ADD COLUMN     "franchise_subagent_id" TEXT,
ADD COLUMN     "owner_id" TEXT;

-- AlterTable
ALTER TABLE "subagents" ADD COLUMN     "privilege_level" "SubagentPrivilegeLevel" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "booking_handoff_requests" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "status" "BookingHandoffStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "booking_handoff_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "booking_handoff_requests" ADD CONSTRAINT "booking_handoff_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
