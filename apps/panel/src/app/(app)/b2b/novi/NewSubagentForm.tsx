'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { createSubagent, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

interface ClientAccountSummary {
  id: string;
  companyName: string | null;
  taxId: string | null;
  email: string | null;
}

// M7 spec §11 — POST /subagents (Tier 1). commissionPercentage je opciono ovde jer §9
// dozvoljava da se postavi i kasnije, pri odobravanju (ApproveSubagentForm) — ali je korisno
// da agencija odmah unese dogovoreni procenat ako ga već zna.
export default function NewSubagentForm({ account }: { account: ClientAccountSummary }) {
  const [state, formAction] = useActionState(createSubagent, initialState);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border bg-panel px-4 py-3 text-sm last:border-b-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-ink">{account.companyName}</div>
          <div className="text-xs text-ink-faint">
            PIB {account.taxId ?? '—'} {account.email ? `· ${account.email}` : ''}
          </div>
        </div>
        {!expanded && (
          <Button type="button" onClick={() => setExpanded(true)} size="sm">
            registruj kao subagent
          </Button>
        )}
      </div>
      {expanded && (
        <form action={formAction} className="mt-2 flex items-end gap-2">
          <input type="hidden" name="clientAccountId" value={account.id} />
          <label className="text-xs text-ink-faint">
            provizija % (opciono, može i pri odobravanju)
            <input name="commissionPercentage" type="number" min={0} max={100} step="0.01" className="input mt-1" />
          </label>
          <SubmitButton />
          <Button type="button" onClick={() => setExpanded(false)} variant="ghost" size="sm">
            otkaži
          </Button>
        </form>
      )}
      {state.error && <p className="mt-2 text-[11px] text-danger">{state.error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Registrujem…' : 'potvrdi'}
    </Button>
  );
}
