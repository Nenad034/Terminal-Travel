'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateGuarantee, FormState } from '../actions';
import { Button } from '@/components/ui/button';
import DateField from '@/components/DateField';

interface TravelGuarantee {
  id: string;
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  currency: string;
  validFrom: string;
  validTo: string;
  documentUrl: string | null;
  status: string;
}

const initialState: FormState = { error: null };

// M11 spec §2.1 — createNew=true unosi novu godišnju polisu (obavezna sva polja na servisu);
// bez toga menja postojeći "trenutni" zapis. Podrazumevano createNew čekiran ako još nema
// nijedne garancije (nema šta da se izmeni).
export default function UpdateGuaranteeForm({ guarantee }: { guarantee: TravelGuarantee | null }) {
  const [state, formAction] = useFormState(updateGuarantee, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <label className="flex items-center gap-2 text-xs text-ink-faint">
        <input type="checkbox" name="createNew" defaultChecked={!guarantee} className="h-3.5 w-3.5" />
        unesi novu godišnju polisu (umesto izmene postojeće)
      </label>

      <Field label="osiguravač/provajder (npr. YUTA)">
        <input name="provider" defaultValue={guarantee?.provider} required className="input" />
      </Field>
      <Field label="broj polise">
        <input name="policyNumber" defaultValue={guarantee?.policyNumber} required className="input" />
      </Field>
      <Field label="pokriće (u celim jedinicama valute, npr. 5000000)">
        <input name="coverageAmount" type="number" min={0} defaultValue={guarantee ? guarantee.coverageAmount / 100 : undefined} required className="input" />
      </Field>
      <Field label="valuta">
        <select name="currency" defaultValue={guarantee?.currency ?? 'RSD'} required className="input">
          <option value="RSD">RSD</option>
          <option value="EUR">EUR</option>
        </select>
      </Field>
      <Field label="važi od">
        <DateField name="validFrom" defaultValue={guarantee?.validFrom?.slice(0, 10)} required />
      </Field>
      <Field label="važi do">
        <DateField name="validTo" defaultValue={guarantee?.validTo?.slice(0, 10)} required />
      </Field>
      <Field label="link ka skeniranom sertifikatu">
        <input name="documentUrl" defaultValue={guarantee?.documentUrl ?? ''} className="input" placeholder="https://…" />
      </Field>
      <Field label="status">
        <select name="status" defaultValue={guarantee?.status ?? 'ACTIVE'} className="input">
          <option value="ACTIVE">ACTIVE</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="PENDING_RENEWAL">PENDING_RENEWAL</option>
        </select>
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
      {pending ? 'Čuvanje…' : 'Sačuvaj garanciju'}
    </Button>
  );
}
