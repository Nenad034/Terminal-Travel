-- CreateTable
CREATE TABLE "fact_bookings" (
    "id" TEXT NOT NULL,
    "booking_item_id" TEXT NOT NULL,
    "booking_date" TIMESTAMP(3) NOT NULL,
    "stay_from" TIMESTAMP(3) NOT NULL,
    "stay_to" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_type" "ProductType" NOT NULL,
    "accommodation_type" TEXT,
    "stars" INTEGER,
    "room_type" TEXT,
    "board_type" TEXT,
    "destination_country" TEXT NOT NULL,
    "destination_city" TEXT NOT NULL,
    "source_type" "ProductSourceType" NOT NULL,
    "supplier_id" TEXT,
    "provider_code" TEXT,
    "channel" TEXT NOT NULL,
    "client_account_id" TEXT NOT NULL,
    "base_cost" INTEGER NOT NULL,
    "final_price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "margin" INTEGER NOT NULL,
    "product_name" TEXT NOT NULL,
    "supplier_name" TEXT,
    "subagent_name" TEXT,
    "referral_content_id" TEXT,
    "referral_content_name" TEXT,
    "status" "BookingItemStatus" NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fact_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_payments" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "amount_rsd" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fact_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fact_bookings_booking_item_id_key" ON "fact_bookings"("booking_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "fact_payments_payment_id_key" ON "fact_payments"("payment_id");
