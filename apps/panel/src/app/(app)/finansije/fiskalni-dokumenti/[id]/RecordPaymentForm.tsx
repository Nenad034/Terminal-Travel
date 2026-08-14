'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { recordPayment, FormState } from '../../actions';

const initialState: FormState = { error: null };

// M10 spec §5.2/§9 — ručan unos prijema uplate (BANK_TRANSFER/CASH); CARD se beleži isključivo
// preko webhook-a i namerno nije ponuđeno ovde. Gotovina namerno bez sistemskog limita (§5.2).
export default function RecordPaymentForm({ bookingId, currency, revalidatePath: path }: { bookingId: string; currency: string; revalidatePath: string }) {
  const boundAction = recordPayment.bind(null, bookingId, path);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-panel p-3">
      {state.error && <p className="w-full rounded bg-danger-bg p-2 text-xs text-danger">{state.error}</p>}
      <label className="text-xs text-ink-faint">
        iznos
        <input name="amount" type="number" step="0.01" min={0.01} required className="input mt-1 w-28" />
      </label>
      <label className="text-xs text-ink-faint">
        valuta
        <select name="currency" defaultValue={currency} className="input mt-1 w-20">
          <option value="RSD">RSD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label className="text-xs text-ink-faint">
        način
        <select name="method" className="input mt-1">
          <option value="BANK_TRANSFER">bankovni prenos</option>
          <option value="CASH">gotovina</option>
        </select>
      </label>
      <label className="text-xs text-ink-faint">
        poziv na broj (opciono)
        <input name="reference" className="input mt-1 w-32" />
      </label>
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
      className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Beležim…' : 'Zabeleži uplatu'}
    </button>
  );
}
