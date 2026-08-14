'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { confirmQuote, ConfirmState } from './actions';

const initialState: ConfirmState = { error: null };

export default function ConfirmQuoteForm({ quoteId, itemCount }: { quoteId: string; itemCount: number }) {
  const boundAction = confirmQuote.bind(null, quoteId, itemCount);
  const [state, formAction] = useFormState(boundAction, initialState);
  const [buyerType, setBuyerType] = useState<'FIZICKO_LICE' | 'PRAVNO_LICE'>('FIZICKO_LICE');

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      {Array.from({ length: itemCount }).map((_, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <label className="text-xs text-ink-faint">
            ime (stavka {i + 1})
            <input name={`firstName-${i}`} required className="input mt-1" />
          </label>
          <label className="text-xs text-ink-faint">
            prezime (stavka {i + 1})
            <input name={`lastName-${i}`} required className="input mt-1" />
          </label>
        </div>
      ))}

      <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
        <label className="text-xs text-ink-faint">
          nalogodavac — naziv
          <input name="buyerName" required className="input mt-1" />
        </label>
        <label className="text-xs text-ink-faint">
          nalogodavac — tip
          <select name="buyerType" value={buyerType} onChange={(e) => setBuyerType(e.target.value as typeof buyerType)} className="input mt-1">
            <option value="FIZICKO_LICE">fizičko lice</option>
            <option value="PRAVNO_LICE">pravno lice</option>
          </select>
        </label>
        {buyerType === 'PRAVNO_LICE' && (
          <label className="col-span-2 text-xs text-ink-faint">
            PIB
            <input name="buyerTaxId" required className="input mt-1" />
          </label>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Potvrđivanje…' : 'Potvrdi rezervaciju'}
    </button>
  );
}
