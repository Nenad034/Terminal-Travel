-- AlterTable
ALTER TABLE "fact_bookings" ADD COLUMN     "cancelled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "actor_id" TEXT,
    "client_account_id" TEXT,
    "product_type" TEXT,
    "destination_country" TEXT,
    "destination_city" TEXT,
    "result_count" INTEGER NOT NULL,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_logs_occurred_at_idx" ON "search_logs"("occurred_at");
