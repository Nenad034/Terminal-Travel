'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateClientAccount, FormState } from '../actions';

const initialState: FormState = { error: null };
const LANGUAGES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'];

interface Account {
  id: string;
  accountType: 'INDIVIDUAL' | 'LEGAL_ENTITY';
  fullName: string | null;
  companyName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  preferredLanguage: string | null;
  marketingConsent: boolean;
  tags: string[] | null;
}

// M6 spec §2.1 — PATCH /client-accounts/:id, isti obrazac kao katalog EditProductForm.
export default function EditClientAccountForm({ account }: { account: Account }) {
  const boundAction = updateClientAccount.bind(null, account.id);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <input type="hidden" name="accountType" value={account.accountType} />

      {account.accountType === 'INDIVIDUAL' ? (
        <Field label="puno ime">
          <input name="fullName" defaultValue={account.fullName ?? ''} className="input" />
        </Field>
      ) : (
        <>
          <Field label="naziv firme">
            <input name="companyName" defaultValue={account.companyName ?? ''} className="input" />
          </Field>
          <Field label="PIB">
            <input name="taxId" defaultValue={account.taxId ?? ''} className="input" />
          </Field>
        </>
      )}

      <Field label="email">
        <input name="email" type="email" defaultValue={account.email ?? ''} className="input" />
      </Field>
      <Field label="telefon">
        <input name="phone" defaultValue={account.phone ?? ''} className="input" />
      </Field>
      <Field label="adresa">
        <input name="address" defaultValue={account.address ?? ''} className="input" />
      </Field>
      <Field label="država">
        <input name="country" defaultValue={account.country ?? ''} className="input" />
      </Field>
      <Field label="jezik komunikacije">
        <select name="preferredLanguage" defaultValue={account.preferredLanguage ?? 'sr'} className="input">
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="oznake (odvojene zarezom)">
        <input name="tags" defaultValue={(account.tags ?? []).join(', ')} className="input" />
      </Field>

      <label className="flex items-center gap-2 text-xs text-ink-dim">
        <input type="checkbox" name="marketingConsent" defaultChecked={account.marketingConsent} className="h-3.5 w-3.5" />
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
      {pending ? 'Čuvanje…' : 'Sačuvaj izmene'}
    </button>
  );
}
