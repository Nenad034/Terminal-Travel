'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { runReconciliation, FormState } from './actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

export default function ReconciliationButton() {
  const [state, formAction] = useActionState(runReconciliation, initialState);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <Btn />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function Btn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="gap-1.5">
      {pending ? 'Pokrećem…' : 'pokreni rekonsilijaciju'}
    </Button>
  );
}
