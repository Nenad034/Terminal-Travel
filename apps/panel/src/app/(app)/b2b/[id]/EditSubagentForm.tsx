'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateSubagent, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

interface Subagent {
  id: string;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';
  creditLimit: number | null;
  creditLimitCurrency: string | null;
}

// M7 spec §10 (M7/subagent/EDIT) — PATCH /subagents/:id, kreditni limit/status. Statusi
// dozvoljeni po DTO: ACTIVE/SUSPENDED (UpdateSubagentDto) — PENDING_APPROVAL se menja
// isključivo kroz approve().
export default function EditSubagentForm({ subagent }: { subagent: Subagent }) {
  const boundAction = updateSubagent.bind(null, subagent.id);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-ink-faint">
        kreditni limit
        <input name="creditLimit" type="number" min={0} step="0.01" defaultValue={subagent.creditLimit ?? ''} className="input mt-1" />
      </label>
      <label className="text-xs text-ink-faint">
        valuta
        <input name="creditLimitCurrency" defaultValue={subagent.creditLimitCurrency ?? ''} className="input mt-1 w-20" />
      </label>
      {subagent.status !== 'PENDING_APPROVAL' && (
        <label className="text-xs text-ink-faint">
          status
          <select name="status" defaultValue={subagent.status} className="input mt-1">
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </label>
      )}
      <SubmitButton />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="secondary" size="sm">
      {pending ? 'Čuvanje…' : 'sačuvaj'}
    </Button>
  );
}
