-- M21 spec §1/§2 (avgust 2026, vlasnikova odluka — M15 spec §11 "B2C_SITE omnisearch dopuna").
-- Nova publika PUBLIC_GUEST — pokriva anonimnog B2C posetioca i logovanog GUEST naloga sa
-- INDIVIDUAL (ili nepovezanim) ClientAccount, koji su ranije bili potpuno van obima.

-- AlterEnum
ALTER TYPE "HelpAudience" ADD VALUE 'PUBLIC_GUEST';

-- AlterEnum
ALTER TYPE "HelpAudienceContext" ADD VALUE 'PUBLIC_GUEST';

-- AlterTable: asked_by postaje nullable — NULL označava potpuno anonimnog B2C posetioca
-- (nema User zapis); logovan INDIVIDUAL gost i dalje upisuje stvaran userId.
ALTER TABLE "help_questions" ALTER COLUMN "asked_by" DROP NOT NULL;
