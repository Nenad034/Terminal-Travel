// Isti obrazac kao `change-form-state.ts`/`guide-form-state.ts` — mora živeti van
// `booking-guest-actions.ts` jer je taj fajl `'use server'` (sme da izvozi isključivo async
// funkcije, vidi zamku 9.5 u docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md).
export interface GuestCrudFormState {
  error: string | null;
  ok: string | null;
}

export const emptyGuestCrudState: GuestCrudFormState = { error: null, ok: null };
