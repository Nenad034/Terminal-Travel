'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { addCancellationRule, FormState } from '../../../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

export interface CancellationRule {
  id: string;
  daysBeforeStay: number;
  refundPercentage: number;
}

// M3 spec §2.5. Isti obrazac kao RateLinesPanel — backend PUT ovde uvek kreira novu stavku
// (contract-periods.service.ts upsertCancellationRule), pa je ovo forma za dodavanje, ne izmenu.
export default function CancellationRulesPanel({
  contractId,
  periodId,
  rules,
  canEdit,
}: {
  contractId: string;
  periodId: string;
  rules: CancellationRule[];
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const boundAction = addCancellationRule.bind(null, contractId, periodId);
  const [state, formAction] = useFormState(boundAction, initialState);

  const sorted = [...rules].sort((a, b) => b.daysBeforeStay - a.daysBeforeStay);

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Pravila otkazivanja</h2>
        {canEdit && (
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            {showForm ? 'Zatvori' : '+ Dodaj'}
          </Button>
        )}
      </div>

      {sorted.length === 0 && <p className="text-xs text-ink-faint">Nijedno pravilo otkazivanja još nije uneto.</p>}

      <div className="flex flex-col gap-1.5 text-xs">
        {sorted.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded border border-border bg-panel2 px-3 py-2">
            <span className="text-ink">{r.daysBeforeStay}+ dana pre dolaska</span>
            <span className="font-medium text-ink">povrat {r.refundPercentage}%</span>
          </div>
        ))}
      </div>

      {showForm && canEdit && (
        <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-xs">
          {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prag (dana pre dolaska)">
              <input name="daysBeforeStay" type="number" min={0} required className="input" />
            </Field>
            <Field label="Procenat povraćaja">
              <input name="refundPercentage" type="number" min={0} max={100} required className="input" />
            </Field>
          </div>
          <SubmitButton />
        </form>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="self-start">
      {pending ? 'Čuvanje…' : 'Sačuvaj pravilo'}
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
