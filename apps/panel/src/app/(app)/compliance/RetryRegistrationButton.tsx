'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { retryRegistration, FormState } from './actions';

const initialState: FormState = { error: null };

// M11 spec §5 — POST /travel-guarantee-registrations/:id/retry, uvek deliberatan klik
// (dozvola M11/travel-guarantee-registration/RETRY), nikad automatski.
export default function RetryRegistrationButton({ id }: { id: string }) {
  const boundAction = retryRegistration.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
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
      className="rounded border border-border bg-panel px-2 py-1 text-[11px] font-medium text-ink-dim hover:border-accent disabled:opacity-50"
    >
      {pending ? 'Pokušavam…' : 'Ponovi'}
    </button>
  );
}
