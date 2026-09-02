// Izdvojeno iz `booking-guide-actions.ts` (2.9.2026, isti nalaz kao `change-form-state.ts`) —
// Next.js "use server" fajl sme da izvozi ISKLJUČIVO async funkcije
// (https://nextjs.org/docs/messages/invalid-use-server-value); `emptyGuideState` je običan
// objekat i mora živeti van tog fajla.
export interface GuideFormState {
  error: string | null;
  ok: string | null;
}

export const emptyGuideState: GuideFormState = { error: null, ok: null };
