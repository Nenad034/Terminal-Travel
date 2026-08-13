-- CreateEnum
CREATE TYPE "TicketRequesterType" AS ENUM ('GUEST', 'SUBAGENT', 'STAFF_ON_BEHALF');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('REZERVACIJA', 'PLACANJE', 'TEHNICKI_PROBLEM', 'REKLAMACIJA', 'DRUGO');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('SITE_FORM', 'B2B_PORTAL', 'EMAIL', 'PHONE', 'HELP_CENTER');

-- CreateEnum
CREATE TYPE "TicketMessageSenderType" AS ENUM ('REQUESTER', 'STAFF', 'AI_DRAFT');

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "requester_client_account_id" TEXT,
    "requester_type" "TicketRequesterType" NOT NULL,
    "related_booking_id" TEXT,
    "subject" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "channel" "TicketChannel" NOT NULL,
    "source_email_thread_id" TEXT,
    "assigned_to" TEXT,
    "zzp_response_deadline" TIMESTAMP(3),
    "zzp_escalated_at" TIMESTAMP(3),
    "refund_decision" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender_type" "TicketMessageSenderType" NOT NULL,
    "sender_id" TEXT,
    "body" TEXT NOT NULL,
    "is_internal_note" BOOLEAN NOT NULL DEFAULT false,
    "sent_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
