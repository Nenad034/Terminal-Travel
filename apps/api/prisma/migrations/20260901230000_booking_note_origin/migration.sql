-- M5 spec §4.6 dopuna (1.9.2026) — poreklo beleške (kancelarija vs predstavnik na destinaciji).
CREATE TYPE "BookingNoteOrigin" AS ENUM ('OFFICE', 'FIELD_REP');

ALTER TABLE "booking_notes" ADD COLUMN "origin" "BookingNoteOrigin" NOT NULL DEFAULT 'OFFICE';
