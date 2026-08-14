'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createContract, FormState } from '../../dobavljaci/actions';

const CURRENCIES = ['EUR', 'RSD', 'USD'];

const initialState: FormState = { error: null };

export default function NewContractForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createContract, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <Field label="dobavljač">
        <select name="supplierId" required className="input">
          <option value="">— izaberite —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="broj ugovora">
        <input name="contractNumber" required className="input" />
      </Field>
      <Field label="valuta">
        <select name="currency" required className="input">
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="važi od">
        <input name="validFrom" type="date" required className="input" />
      </Field>
      <Field label="važi do">
        <input name="validTo" type="date" required className="input" />
      </Field>
      <Field label="uslovi otkazivanja (sažetak)">
        <textarea name="cancellationTermsSummary" rows={3} required className="input" />
      </Field>
      <Field label="link ka dokumentu ugovora">
        <input name="documentUrl" required className="input" placeholder="https://…" />
      </Field>

      <SubmitButton />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-ink-faint">
      {label}
      <div className="mt-1">{children}</div>
    </label>
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
      {pending ? 'Čuvanje…' : 'Sačuvaj ugovor'}
    </button>
  );
}
