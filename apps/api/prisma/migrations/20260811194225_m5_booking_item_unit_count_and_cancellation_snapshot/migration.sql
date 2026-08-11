-- M5 spec §4.2/§3.2 dopuna (v1.14): tačno oslobađanje kapaciteta pri otkazivanju/izmeni
-- (unit_count, umesto pretpostavljene 1 jedinice) i determinističko računanje procenta
-- povraćaja za API (M4) stavke (cancellation_policy_snapshot, isti strukturirani oblik
-- kao M3 CancellationRule).

ALTER TABLE "quote_items" ADD COLUMN "unit_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "quote_items" ADD COLUMN "cancellation_policy_snapshot" JSONB;

ALTER TABLE "booking_items" ADD COLUMN "unit_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "booking_items" ADD COLUMN "cancellation_policy_snapshot" JSONB;
