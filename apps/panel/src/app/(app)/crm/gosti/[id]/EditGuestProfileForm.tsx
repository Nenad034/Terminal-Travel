'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateGuestProfile, FormState } from '../../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

interface Guest {
  id: string;
  fullName: string;
  documentType: 'PASSPORT' | 'LICNA_KARTA';
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  email: string | null;
  phone: string | null;
  linkedClientAccountId: string | null;
}

// M6 spec §2.2 — PATCH /guest-profiles/:id.
export default function EditGuestProfileForm({ guest }: { guest: Guest }) {
  const boundAction = updateGuestProfile.bind(null, guest.id);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <input type="hidden" name="linkedClientAccountId" value={guest.linkedClientAccountId ?? ''} />

      <Field label="puno ime">
        <input name="fullName" defaultValue={guest.fullName} className="input" />
      </Field>
      <Field label="vrsta dokumenta">
        <select name="documentType" defaultValue={guest.documentType} className="input">
          <option value="PASSPORT">Pasoš</option>
          <option value="LICNA_KARTA">Lična karta</option>
        </select>
      </Field>
      <Field label="broj dokumenta">
        <input name="documentNumber" defaultValue={guest.documentNumber} className="input" />
      </Field>
      <Field label="državljanstvo">
        <input name="nationality" defaultValue={guest.nationality} className="input" />
      </Field>
      <Field label="datum rođenja">
        <input name="dateOfBirth" type="date" defaultValue={guest.dateOfBirth.slice(0, 10)} className="input" />
      </Field>
      <Field label="email">
        <input name="email" type="email" defaultValue={guest.email ?? ''} className="input" />
      </Field>
      <Field label="telefon">
        <input name="phone" defaultValue={guest.phone ?? ''} className="input" />
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
      {pending ? 'Čuvanje…' : 'Sačuvaj izmene'}
    </Button>
  );
}
