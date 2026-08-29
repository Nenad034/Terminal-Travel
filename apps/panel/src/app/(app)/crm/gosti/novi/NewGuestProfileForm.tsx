'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createGuestProfile, FormState } from '../../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M6 spec §2.2 — polja prate CreateGuestProfileDto tačno (apps/api/src/modules/m6-crm/
// guest-profiles/dto/create-guest-profile.dto.ts).
export default function NewGuestProfileForm({ linkedClientAccountId }: { linkedClientAccountId?: string }) {
  const [state, formAction] = useFormState(createGuestProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <input type="hidden" name="linkedClientAccountId" value={linkedClientAccountId ?? ''} />
      {linkedClientAccountId && <p className="text-[11px] text-ink-faint">povezuje se sa nalogodavcem {linkedClientAccountId.slice(0, 8)}…</p>}

      <Field label="puno ime">
        <input name="fullName" required className="input" />
      </Field>
      <Field label="vrsta dokumenta">
        <select name="documentType" required className="input" defaultValue="PASSPORT">
          <option value="PASSPORT">Pasoš</option>
          <option value="LICNA_KARTA">Lična karta</option>
        </select>
      </Field>
      <Field label="broj dokumenta">
        <input name="documentNumber" required className="input" />
      </Field>
      <Field label="državljanstvo">
        <input name="nationality" required className="input" placeholder="Srbija" />
      </Field>
      <Field label="datum rođenja">
        <input name="dateOfBirth" type="date" required className="input" />
      </Field>
      <Field label="email">
        <input name="email" type="email" className="input" />
      </Field>
      <Field label="telefon">
        <input name="phone" className="input" />
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
      {pending ? 'Čuvanje…' : 'Sačuvaj gosta'}
    </Button>
  );
}
