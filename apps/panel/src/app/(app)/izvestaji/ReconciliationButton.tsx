'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { runReconciliation, FormState } from './actions';

const initialState: FormState = { error: null };

export default function ReconciliationButton() {
  const [state, formAction] = useFormState(runReconciliation, initialState);
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
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent disabled:opacity-50"
    >
      {pending ? 'Pokrećem…' : 'pokreni rekonsilijaciju'}
    </button>
  );
}
