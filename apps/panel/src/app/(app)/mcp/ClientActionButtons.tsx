'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { activateMcpClient, approveReadWriteMcpClient, suspendMcpClient, FormState } from './actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M16 spec §3.1/§7 — tri ljudske radnje, nikad automatske: aktivacija (MANAGE), odobrenje
// READ_WRITE (APPROVE_READ_WRITE, odvojena dozvola od MANAGE) i suspendovanje (MANAGE).
export function ActivateButton({ id, canManage }: { id: string; canManage: boolean }) {
  const boundAction = activateMcpClient.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  if (!canManage) return null;
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Btn label="Aktiviraj" pendingLabel="Aktiviram…" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

export function ApproveReadWriteButton({ id, canApprove }: { id: string; canApprove: boolean }) {
  const boundAction = approveReadWriteMcpClient.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  if (!canApprove) return null;
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Btn label="Odobri READ_WRITE" pendingLabel="Odobravam…" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

export function SuspendButton({ id, canManage }: { id: string; canManage: boolean }) {
  const boundAction = suspendMcpClient.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  if (!canManage) return null;
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Btn label="Suspenduj" pendingLabel="Suspendujem…" danger />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function Btn({ label, pendingLabel, danger }: { label: string; pendingLabel: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      size="sm"
      className={`h-auto px-2 py-1 text-[11px] ${danger ? 'hover:border-danger hover:text-danger' : ''}`}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
