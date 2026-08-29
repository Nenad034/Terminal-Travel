'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { approveSupplierObligation, paySupplierObligation, FormState } from './actions';
import { Button } from '@/components/ui/button';

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
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="h-auto px-2 py-1 text-[11px]">
      {pending ? pendingLabel : label}
    </Button>
  );
}
