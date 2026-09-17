-- M5 §3.0j (v2.53, 17.9.2026) — ponuda iz nalepljenog teksta.
-- QuoteItem bez pravila marže (MANUAL stavka, kao BookingItem od v2.25); nalepljen tekst uz ponudu.
ALTER TABLE "quote_items" ALTER COLUMN "markup_rule_id" DROP NOT NULL;
ALTER TABLE "quotes" ADD COLUMN "intake_source_text" TEXT;
-- Opciona relacija menja i ponašanje FK-a (Prisma: SET NULL umesto RESTRICT).
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_markup_rule_id_fkey";
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_markup_rule_id_fkey" FOREIGN KEY ("markup_rule_id") REFERENCES "markup_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
