'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createSubagent, FormState } from '../actions';

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
  const [state, formAction] = useFormState(createSubagent, initialState);
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
          <button type="button" onClick={() => setExpanded(true)} className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong">
            registruj kao subagent
          </button>
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
          <button type="button" onClick={() => setExpanded(false)} className="rounded px-3 py-1.5 text-xs font-medium text-ink-faint hover:text-ink">
            otkaži
          </button>
        </form>
      )}
      {state.error && <p className="mt-2 text-[11px] text-danger">{state.error}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50">
      {pending ? 'Registrujem…' : 'potvrdi'}
    </button>
  );
}
