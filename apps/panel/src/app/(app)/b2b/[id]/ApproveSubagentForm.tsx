'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { approveSubagent, FormState } from '../actions';

const initialState: FormState = { error: null };

// M7 spec §9/§11 — POST /subagents/:id/approve, isključivo ljudska radnja (Vlasnik/Direktor,
// "namerna kontrola rizika — sistem ne dozvoljava automatsko samoodobravanje kreditne linije").
export default function ApproveSubagentForm({ id, isTier1 }: { id: string; isTier1: boolean }) {
  const boundAction = approveSubagent.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-ink-faint">
        kreditni limit
        <input name="creditLimit" type="number" min={0} step="0.01" required className="input mt-1" />
      </label>
      <label className="text-xs text-ink-faint">
        valuta
        <input name="creditLimitCurrency" defaultValue="EUR" required className="input mt-1 w-20" />
      </label>
      {isTier1 && (
        <label className="text-xs text-ink-faint">
          provizija %
          <input name="commissionPercentage" type="number" min={0} max={100} step="0.01" required className="input mt-1 w-24" />
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
    <button type="submit" disabled={pending} className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50">
      {pending ? 'Odobravam…' : 'Odobri subagenta'}
    </button>
  );
}
