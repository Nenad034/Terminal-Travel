'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { prepareFiscalDocument, FormState } from './actions';

const initialState: FormState = { error: null };

// M10 spec §6 korak 1 — priprema nacrta, "Autonomno"/nulti rizik, ali i dalje deliberatan klik
// (ne automatski poziv pri učitavanju stranice rezervacije) — vodi na detalj gde se šalje (§6
// korak 2, isključivo ljudska radnja). Idempotentno na API strani: ako nacrt/dokument za ovu
// rezervaciju već postoji, vraća baš njega umesto da pravi duplikat.
export default function PrepareFiscalDocumentButton({ bookingId }: { bookingId: string }) {
  const boundAction = prepareFiscalDocument.bind(null, bookingId);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <SubmitButton />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Pripremam…' : 'Pripremi/prikaži fiskalni dokument'}
    </button>
  );
}
