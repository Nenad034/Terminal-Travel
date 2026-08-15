'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createClientAccount, FormState } from '../actions';

const initialState: FormState = { error: null };
const LANGUAGES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'];

// M6 spec §2.1 — polja prate CreateClientAccountDto tačno (apps/api/src/modules/m6-crm/
// client-accounts/dto/create-client-account.dto.ts). accountType određuje da li se prikazuje
// "puno ime" ili "naziv firme"/PIB (§2.1 napomena).
export default function NewClientAccountForm() {
  const [state, formAction] = useFormState(createClientAccount, initialState);
  const [accountType, setAccountType] = useState<'INDIVIDUAL' | 'LEGAL_ENTITY'>('INDIVIDUAL');

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <Field label="tip naloga">
        <select name="accountType" required className="input" value={accountType} onChange={(e) => setAccountType(e.target.value as 'INDIVIDUAL' | 'LEGAL_ENTITY')}>
          <option value="INDIVIDUAL">Fizičko lice</option>
          <option value="LEGAL_ENTITY">Pravno lice</option>
        </select>
      </Field>

      {accountType === 'INDIVIDUAL' ? (
        <Field label="puno ime">
          <input name="fullName" required className="input" />
        </Field>
      ) : (
        <>
          <Field label="naziv firme">
            <input name="companyName" required className="input" />
          </Field>
          <Field label="PIB">
            <input name="taxId" required className="input" />
          </Field>
        </>
      )}

      <Field label="email">
        <input name="email" type="email" className="input" />
      </Field>
      <Field label="telefon">
        <input name="phone" className="input" />
      </Field>
      <Field label="adresa">
        <input name="address" className="input" />
      </Field>
      <Field label="država">
        <input name="country" className="input" placeholder="Srbija" />
      </Field>
      <Field label="jezik komunikacije">
        <select name="preferredLanguage" className="input">
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="oznake (odvojene zarezom)">
        <input name="tags" className="input" placeholder="VIP, porodica" />
      </Field>

      <label className="flex items-center gap-2 text-xs text-ink-dim">
        <input type="checkbox" name="marketingConsent" className="h-3.5 w-3.5" />
        saglasnost za marketinšku komunikaciju
      </label>

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
      {pending ? 'Čuvanje…' : 'Sačuvaj nalogodavca'}
    </button>
  );
}
