// M5 spec §4.1 — "booking_number string, unique — čitljiva oznaka za gosta (npr. TT-2027-000482)".
// Sekvenca po godini; oslanja se na broj postojećih Booking zapisa te godine (dovoljno za
// jezgro — konkurentni sudari rešava @@unique u bazi + ponovni pokušaj na nivou servisa).
export function generateBookingNumber(year: number, sequence: number): string {
  return `TT-${year}-${String(sequence).padStart(6, '0')}`;
}
