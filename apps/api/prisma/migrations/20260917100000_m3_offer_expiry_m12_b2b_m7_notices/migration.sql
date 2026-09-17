-- 17.9.2026 — akcija pred istek, kraj-do-kraja (M3 v1.44 §4.9, M12 v1.8 §3d, M7 v1.14 §5b).
--
-- M3: jedan zapis po (stavka, prag) da se obaveštenje emituje tačno jednom, sa snimkom stavke
--     u trenutku emisije (radni spisak čita jednu tabelu).
-- M12: nov kanal `B2B_SUBAGENTS`, nov status `EXPIRED`, tri polja na nacrtu iz akcije.
-- M7: `subagents.offer_notices_by_email` + `subagent_notices` (obaveštenje na portalu).

-- CreateEnum
CREATE TYPE "OfferExpirySourceType" AS ENUM ('PRICELIST_OFFER', 'ANCILLARY_SERVICE', 'RATE_LINE');
CREATE TYPE "OfferExpiryThreshold" AS ENUM ('INTERNAL', 'MARKETING');
CREATE TYPE "OfferKind" AS ENUM ('EARLY_BOOKING', 'FREE_NIGHTS', 'DISCOUNT', 'FIRST_TRANCHE');
CREATE TYPE "B2bAudience" AS ENUM ('ASSIGNED_ONLY', 'ALL_ACTIVE');

-- AlterEnum
ALTER TYPE "ContentChannel" ADD VALUE 'B2B_SUBAGENTS';
ALTER TYPE "ContentPieceStatus" ADD VALUE 'EXPIRED';

-- CreateTable
CREATE TABLE "offer_expiry_notices" (
    "id" TEXT NOT NULL,
    "source_type" "OfferExpirySourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "threshold" "OfferExpiryThreshold" NOT NULL,
    "days_left_at_emit" INTEGER NOT NULL,
    "emitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "contract_id" TEXT NOT NULL,
    "contract_period_id" TEXT,
    "product_id" TEXT,
    "product_name" TEXT,
    "destination_country" TEXT,
    "destination_city" TEXT,
    "offer_kind" "OfferKind" NOT NULL,
    "discount_summary" TEXT NOT NULL,
    "booking_to" DATE NOT NULL,
    "stay_from" DATE,
    "stay_to" DATE,

    CONSTRAINT "offer_expiry_notices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offer_expiry_notices_source_type_source_id_threshold_key" ON "offer_expiry_notices"("source_type", "source_id", "threshold");
CREATE INDEX "offer_expiry_notices_threshold_acknowledged_at_idx" ON "offer_expiry_notices"("threshold", "acknowledged_at");

-- AlterTable
ALTER TABLE "subagents" ADD COLUMN "offer_notices_by_email" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "subagent_notices" (
    "id" TEXT NOT NULL,
    "content_piece_id" TEXT NOT NULL,
    "subagent_id" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailed_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),

    CONSTRAINT "subagent_notices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subagent_notices_content_piece_id_subagent_id_key" ON "subagent_notices"("content_piece_id", "subagent_id");
CREATE INDEX "subagent_notices_subagent_id_read_at_idx" ON "subagent_notices"("subagent_id", "read_at");

ALTER TABLE "subagent_notices" ADD CONSTRAINT "subagent_notices_subagent_id_fkey" FOREIGN KEY ("subagent_id") REFERENCES "subagents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subagent_notices" ADD CONSTRAINT "subagent_notices_content_piece_id_fkey" FOREIGN KEY ("content_piece_id") REFERENCES "content_pieces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "content_pieces" ADD COLUMN "offer_booking_to" DATE,
ADD COLUMN "source_offer_id" TEXT,
ADD COLUMN "b2b_audience" "B2bAudience";

CREATE INDEX "content_pieces_source_offer_id_idx" ON "content_pieces"("source_offer_id");
