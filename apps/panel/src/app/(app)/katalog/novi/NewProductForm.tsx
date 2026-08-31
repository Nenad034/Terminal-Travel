'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { createProduct, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT'];

const initialState: FormState = { error: null };

export default function NewProductForm() {
  const [state, formAction] = useActionState(createProduct, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <Field label="tip proizvoda">
        <select name="type" required className="input">
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="naziv (srpski)">
        <input name="name" required className="input" />
      </Field>
      <Field label="opis (srpski)">
        <textarea name="description" rows={3} className="input" />
      </Field>
      <Field label="država odredišta">
        <input name="destinationCountry" required className="input" placeholder="Grčka" />
      </Field>
      <Field label="grad odredišta">
        <input name="destinationCity" required className="input" placeholder="Halkidiki" />
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
      {pending ? 'Čuvanje…' : 'Sačuvaj proizvod'}
    </Button>
  );
}
