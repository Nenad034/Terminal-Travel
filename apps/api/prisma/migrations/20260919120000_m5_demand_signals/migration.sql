-- M5 spec §3.0k (19.9.2026) — signali potražnje: lijevak upit → prikazano → ponuda → otvoreno.

-- §3.0k.1 dopuna SearchLog
ALTER TABLE "search_logs"
  ADD COLUMN "stay_from" DATE,
  ADD COLUMN "stay_to" DATE,
  ADD COLUMN "lead_time_days" INTEGER,
  ADD COLUMN "nights" INTEGER,
  ADD COLUMN "adults" INTEGER,
  ADD COLUMN "children" INTEGER,
  ADD COLUMN "amenity_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- §3.0k.2 SearchLogResult
CREATE TABLE "search_log_results" (
  "id" TEXT NOT NULL,
  "search_log_id" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "product_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "offer_final_price" INTEGER NOT NULL,
  "offer_base_cost" INTEGER,
  "currency" TEXT NOT NULL,
  "markup_rule_id" TEXT,
  "availability_status" TEXT NOT NULL,
  "remaining_units" INTEGER,
  "is_refundable" BOOLEAN,
  CONSTRAINT "search_log_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "search_log_results_search_log_id_idx" ON "search_log_results"("search_log_id");
CREATE INDEX "search_log_results_product_id_idx" ON "search_log_results"("product_id");
ALTER TABLE "search_log_results"
  ADD CONSTRAINT "search_log_results_search_log_id_fkey"
  FOREIGN KEY ("search_log_id") REFERENCES "search_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- §3.0k.3 / §3.0k.4 Quote
ALTER TABLE "quotes"
  ADD COLUMN "search_log_id" TEXT,
  ADD COLUMN "shared_first_viewed_at" TIMESTAMP(3),
  ADD COLUMN "shared_view_count" INTEGER NOT NULL DEFAULT 0;
