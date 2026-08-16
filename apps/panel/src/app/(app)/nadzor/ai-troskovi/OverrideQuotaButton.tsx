'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { overrideAiProviderQuota, FormState } from '../actions';

const initialState: FormState = { error: null };

// M18 spec §6.5/§7/§9 — POST /ops/ai-provider-quota/:id/override, dozvola
// M18/ai-provider-quota/OVERRIDE. Ručan povratak iz DEGRADED u NORMAL pre isteka perioda,
// upisuje AuditLogEntry (M1) na backendu.
export default function OverrideQuotaButton({ id }: { id: string }) {
  const boundAction = overrideAiProviderQuota.bind(null, id);
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
      {pending ? 'Vraćam…' : 'vrati na NORMAL'}
    </button>
  );
}
