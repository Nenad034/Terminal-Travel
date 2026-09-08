'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateBranch, type FormState } from '../actions';

interface BranchDetail {
  id: string;
  name: string;
  active: boolean;
  address: string | null;
  phone: string | null;
  email: string | null;
  responsiblePersonName: string | null;
  taxId: string | null;
  licenseNumber: string | null;
}

const initialState: FormState = { error: null };

// M1 spec §3.9b dopuna (8.9.2026) — puna forma poslovnice, isti obrazac kao AgencyForm
// (uvek postoji, samo se ažurira, nema poseban "režim izmene").
export default function BranchDetailForm({ branch }: { branch: BranchDetail }) {
  const boundAction = updateBranch.bind(null, branch.id);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 text-xs">
      {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Naziv poslovnice" name="name" defaultValue={branch.name} required />
        <Field
          label="Odgovorna osoba"
          name="responsiblePersonName"
          defaultValue={branch.responsiblePersonName}
          hint="Ime osobe zadužene za poslovnicu — ne mora imati nalog u sistemu."
        />
        <Field label="Adresa" name="address" defaultValue={branch.address} />
        <Field label="PIB" name="taxId" defaultValue={branch.taxId} hint="Vidi napomenu ispod." />
        <Field
          label="Broj licence"
          name="licenseNumber"
          defaultValue={branch.licenseNumber}
          hint="Popunite samo ako se razlikuje od licence agencije."
        />
        <Field label="Email" name="email" defaultValue={branch.email} />
        <Field label="Telefon" name="phone" defaultValue={branch.phone} />
      </div>

      <label className="flex items-center gap-1.5 text-ink-dim">
        <input
          type="checkbox"
          name="active"
          defaultChecked={branch.active}
          className="h-3.5 w-3.5"
        />
        aktivna
      </label>

      <p className="border-t border-border pt-3 text-ink-faint">
        PIB poslovnice se čuva ovde, ali se trenutno NE koristi u fiskalizaciji (Finansije) —
        fiskalni dokumenti i dalje idu preko PIB-a iz Podataka agencije.
      </p>

      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  required,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block font-medium text-ink" htmlFor={name}>
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="input w-full"
      />
      {hint && <p className="mt-1 text-ink-faint">{hint}</p>}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-brand px-3 py-1.5 font-medium text-brand-ink hover:brightness-90 disabled:opacity-50"
    >
      {pending ? 'Čuvam…' : 'Sačuvaj'}
    </button>
  );
}
