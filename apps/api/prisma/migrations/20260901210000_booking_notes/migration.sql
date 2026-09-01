-- M5 spec §4.6 (1.9.2026) — interne beleške uz rezervaciju.
CREATE TABLE "booking_notes" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_notes_booking_id_created_at_idx" ON "booking_notes"("booking_id", "created_at");

ALTER TABLE "booking_notes" ADD CONSTRAINT "booking_notes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
