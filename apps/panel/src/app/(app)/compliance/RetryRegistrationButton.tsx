'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { retryRegistration, FormState } from './actions';
import { Button } from '@/components/ui/button';

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
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="h-auto px-2 py-1 text-[11px]">
      {pending ? 'Pokušavam…' : 'Ponovi'}
    </Button>
  );
}
