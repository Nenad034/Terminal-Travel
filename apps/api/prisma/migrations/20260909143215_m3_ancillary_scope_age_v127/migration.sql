-- M3 spec §2.11j/§2.11k (v1.27) — doplata i popust dobijaju DOMET, datumski opseg i uzrast.
--
-- Do sada je `AncillaryService` bio vezan iskljucivo za JEDAN `contract_period_id`, pa se
-- doplata koja vazi za ceo hotel unosila onoliko puta koliko ima perioda. Od ove verzije
-- domet je najuzi popunjen nivo: period -> sezona -> ugovor.
--
-- `contract_id` je OBAVEZAN i za najuze stavke, da se ceo cenovnik jednog ugovora cita
-- jednim upitom. Prisma je za njega generisala `ADD COLUMN ... NOT NULL`, sto bi oborilo
-- migraciju nad svakom bazom koja vec ima doplate (dev baza ih danas nema, ali sledeca
-- ne mora biti prazna). Zato ide u tri koraka: dodaj kao nullable, popuni iz perioda,
-- pa tek onda postavi NOT NULL.

-- AlterTable
ALTER TABLE "ancillary_services" ADD COLUMN     "age_from" DECIMAL(65,30),
ADD COLUMN     "age_to" DECIMAL(65,30),
ADD COLUMN     "applies_from" DATE,
ADD COLUMN     "applies_to" DATE,
ADD COLUMN     "applies_to_room_types" TEXT[],
ADD COLUMN     "contract_id" TEXT,
ADD COLUMN     "season_id" TEXT,
ALTER COLUMN "contract_period_id" DROP NOT NULL;

-- Popuni domet za postojece stavke: sve su danas vezane za period, pa se ugovor cita iz njega.
UPDATE "ancillary_services" a
SET "contract_id" = p."contract_id"
FROM "contract_periods" p
WHERE a."contract_period_id" = p."id" AND a."contract_id" IS NULL;

-- Zastita: ako bi posle popunjavanja ostao ijedan red bez ugovora, migracija staje ovde
-- umesto da tiho postavi NOT NULL nad podacima koje ne ume da objasni.
DO $$
DECLARE bez_ugovora INT;
BEGIN
  SELECT count(*) INTO bez_ugovora FROM "ancillary_services" WHERE "contract_id" IS NULL;
  IF bez_ugovora > 0 THEN
    RAISE EXCEPTION 'ancillary_services: % redova bez contract_id posle popunjavanja iz perioda', bez_ugovora;
  END IF;
END $$;

ALTER TABLE "ancillary_services" ALTER COLUMN "contract_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ancillary_services_contract_id_idx" ON "ancillary_services"("contract_id");

-- CreateIndex
CREATE INDEX "ancillary_services_season_id_idx" ON "ancillary_services"("season_id");

-- AddForeignKey
ALTER TABLE "ancillary_services" ADD CONSTRAINT "ancillary_services_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ancillary_services" ADD CONSTRAINT "ancillary_services_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
