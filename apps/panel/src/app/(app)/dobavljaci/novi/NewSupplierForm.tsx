'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createSupplier, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const SUPPLIER_TYPES = ['HOTEL', 'PREVOZNIK', 'OSIGURAVAC', 'DRUGO'];

const initialState: FormState = { error: null };

export default function NewSupplierForm() {
  const [state, formAction] = useFormState(createSupplier, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <Field label="naziv">
        <input name="name" required className="input" />
      </Field>
      <Field label="tip dobavljača">
        <select name="type" required className="input">
          {SUPPLIER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="PIB">
        <input name="taxId" required className="input" />
      </Field>
      <Field label="matični broj">
        <input name="registrationNumber" required className="input" />
      </Field>
      <Field label="država">
        <input name="country" required className="input" placeholder="Grčka" />
      </Field>
      <Field label="kontakt osoba">
        <input name="contactName" required className="input" />
      </Field>
      <Field label="kontakt email">
        <input name="contactEmail" type="email" required className="input" />
      </Field>
      <Field label="kontakt telefon">
        <input name="contactPhone" required className="input" />
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
    <Button type="submit" disabled={pending} className="mt-1 self-start">
      {pending ? 'Čuvanje…' : 'Sačuvaj dobavljača'}
    </Button>
  );
}
