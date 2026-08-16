-- CreateEnum
CREATE TYPE "MailboxType" AS ENUM ('SHARED', 'PERSONAL');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MailboxAccessLevel" AS ENUM ('VIEW', 'REPLY');

-- CreateEnum
CREATE TYPE "EmailCorrespondentType" AS ENUM ('GUEST', 'SUBAGENT', 'SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailThreadStatus" AS ENUM ('OPEN', 'AWAITING_REPLY', 'CLOSED');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "EmailSenderType" AS ENUM ('CORRESPONDENT', 'STAFF', 'AI_DRAFT');

-- AlterEnum
ALTER TYPE "AgentRole" ADD VALUE 'EMAIL_INBOX_AGENT';

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "mailbox_type" "MailboxType" NOT NULL,
    "owner_user_id" TEXT,
    "provider_connection_ref" TEXT NOT NULL,
    "is_supplier_unified_inbox" BOOLEAN NOT NULL DEFAULT false,
    "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_access" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_level" "MailboxAccessLevel" NOT NULL,
    "granted_by" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "correspondent_type" "EmailCorrespondentType" NOT NULL DEFAULT 'OTHER',
    "correspondent_client_account_id" TEXT,
    "correspondent_supplier_id" TEXT,
    "related_booking_id" TEXT,
    "related_supplier_manifest_id" TEXT,
    "related_supplier_change_notice_id" TEXT,
    "status" "EmailThreadStatus" NOT NULL DEFAULT 'OPEN',
    "converted_to_ticket_id" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "sender_type" "EmailSenderType" NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_addresses" TEXT[],
    "body" TEXT NOT NULL,
    "ai_summary" TEXT,
    "sent_by" TEXT,
    "provider_message_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_address_key" ON "mailboxes"("address");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_access_mailbox_id_user_id_key" ON "mailbox_access"("mailbox_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_provider_message_id_key" ON "email_messages"("provider_message_id");

-- AddForeignKey
ALTER TABLE "mailbox_access" ADD CONSTRAINT "mailbox_access_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
