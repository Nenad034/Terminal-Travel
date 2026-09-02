// Izdvojeno iz `booking-changes-actions.ts` (2.9.2026) — Next.js "use server" fajl sme da
// izvozi ISKLJUČIVO async funkcije (https://nextjs.org/docs/messages/invalid-use-server-value).
// `emptyChangeState` je običan objekat (početno stanje forme), pa mora živeti van tog fajla da
// bi ga klijentske komponente (`BookingChangesCard.tsx`, `AranzmanItemCard.tsx`) mogle uvesti
// bez rušenja server-action modula pri build-u.
export interface ChangeFormState {
  error: string | null;
  ok: string | null;
  /** §6.4 — API vratio upozorenje o mogućem duplikatu; otkazivanje NIJE izvršeno dok
   *  čovek eksplicitno ne potvrdi. Nikad se ne potvrđuje automatski. */
  duplicateWarning: {
    bookingItemId: string;
    conflictBookingNumber: string | null;
    conflictPaymentStatus: string | null;
    message: string;
  } | null;
}

export const emptyChangeState: ChangeFormState = { error: null, ok: null, duplicateWarning: null };
