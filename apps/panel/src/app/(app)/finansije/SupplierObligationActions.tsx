'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { approveSupplierObligation, paySupplierObligation, FormState } from './actions';

const initialState: FormState = { error: null };

export function ApproveButton({ id }: { id: string }) {
  const boundAction = approveSupplierObligation.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Btn label="Odobri" pendingLabel="Odobravam…" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

export function PayButton({ id }: { id: string }) {
  const boundAction = paySupplierObligation.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Btn label="Označi plaćeno" pendingLabel="Beležim…" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function Btn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-border bg-panel px-2 py-1 text-[11px] font-medium text-ink-dim hover:border-accent disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
