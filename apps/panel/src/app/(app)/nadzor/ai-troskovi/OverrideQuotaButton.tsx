'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { overrideAiProviderQuota, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M18 spec §6.5/§7/§9 — POST /ops/ai-provider-quota/:id/override, dozvola
// M18/ai-provider-quota/OVERRIDE. Ručan povratak iz DEGRADED u NORMAL pre isteka perioda,
// upisuje AuditLogEntry (M1) na backendu.
export default function OverrideQuotaButton({ id }: { id: string }) {
  const boundAction = overrideAiProviderQuota.bind(null, id);
  const [state, formAction] = useActionState(boundAction, initialState);
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
      {pending ? 'Vraćam…' : 'vrati na NORMAL'}
    </Button>
  );
}
