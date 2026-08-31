'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { addCancellationRule, FormState } from '../../../actions';
import { ButtonGroup } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const initialState: FormState = { error: null };

export type CancellationRuleType = 'PRE_ARRIVAL' | 'EARLY_DEPARTURE';
export type EarlyDepartureBasis = 'PERCENTAGE_OF_REMAINING_STAY' | 'FLAT_AMOUNT';

export interface CancellationRule {
  id: string;
  ruleType: CancellationRuleType;
  daysBeforeStay: number | null;
  refundPercentage: number | null;
  earlyDepartureBasis: EarlyDepartureBasis | null;
  earlyDeparturePercentage: number | null;
  earlyDepartureFlatAmount: number | null;
}

const RULE_TYPE_LABELS: Record<CancellationRuleType, string> = { PRE_ARRIVAL: 'Pre dolaska', EARLY_DEPARTURE: 'Prevremeni odlazak' };
const EARLY_DEPARTURE_BASIS_LABELS: Record<EarlyDepartureBasis, string> = { PERCENTAGE_OF_REMAINING_STAY: 'Procenat preostalog boravka', FLAT_AMOUNT: 'Fiksan iznos' };

// M3 spec §2.5. Isti obrazac kao RateLinesPanel — backend PUT ovde uvek kreira novu stavku
// (contract-periods.service.ts upsertCancellationRule), pa je ovo forma za dodavanje, ne izmenu.
// Dopuna v1.12 — ruleType razdvaja PRE_ARRIVAL (postojeća polja) od EARLY_DEPARTURE (kazna za
// skraćenje već započetog boravka, nova polja); prikaz razdvaja obe vrste u odvojene pod-naslove.
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
  const [state, formAction] = useActionState(boundAction, initialState);
  const [ruleType, setRuleType] = useState<CancellationRuleType>('PRE_ARRIVAL');
  const [earlyDepartureBasis, setEarlyDepartureBasis] = useState<EarlyDepartureBasis>('PERCENTAGE_OF_REMAINING_STAY');

  const preArrival = rules.filter((r) => r.ruleType === 'PRE_ARRIVAL').sort((a, b) => (b.daysBeforeStay ?? 0) - (a.daysBeforeStay ?? 0));
  const earlyDeparture = rules.filter((r) => r.ruleType === 'EARLY_DEPARTURE');

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

      {rules.length === 0 && <p className="text-xs text-ink-faint">Nijedno pravilo otkazivanja još nije uneto.</p>}

      {preArrival.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[11px] text-ink-faint">Pre dolaska</p>
          <div className="flex flex-col gap-1.5 text-xs">
            {preArrival.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded border border-border bg-panel2 px-3 py-2">
                <span className="text-ink">{r.daysBeforeStay}+ dana pre dolaska</span>
                <span className="font-medium text-ink">povrat {r.refundPercentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {earlyDeparture.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] text-ink-faint">Prevremeni odlazak</p>
          <div className="flex flex-col gap-1.5 text-xs">
            {earlyDeparture.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded border border-border bg-panel2 px-3 py-2">
                <span className="text-ink">
                  <Badge variant="secondary">{r.earlyDepartureBasis ? EARLY_DEPARTURE_BASIS_LABELS[r.earlyDepartureBasis] : ''}</Badge>
                </span>
                <span className="font-medium text-ink">
                  {r.earlyDepartureBasis === 'PERCENTAGE_OF_REMAINING_STAY' ? `${r.earlyDeparturePercentage}%` : `${r.earlyDepartureFlatAmount}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && canEdit && (
        <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-xs">
          {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}

          <Field label="Vrsta pravila">
            <input type="hidden" name="ruleType" value={ruleType} />
            <ButtonGroup value={ruleType} onChange={setRuleType} options={(Object.keys(RULE_TYPE_LABELS) as CancellationRuleType[]).map((v) => ({ value: v, label: RULE_TYPE_LABELS[v] }))} />
          </Field>

          {ruleType === 'PRE_ARRIVAL' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prag (dana pre dolaska)">
                <input name="daysBeforeStay" type="number" min={0} required className="input" />
              </Field>
              <Field label="Procenat povraćaja">
                <input name="refundPercentage" type="number" min={0} max={100} required className="input" />
              </Field>
            </div>
          )}

          {ruleType === 'EARLY_DEPARTURE' && (
            <>
              <Field label="Osnova obračuna">
                <input type="hidden" name="earlyDepartureBasis" value={earlyDepartureBasis} />
                <ButtonGroup
                  value={earlyDepartureBasis}
                  onChange={setEarlyDepartureBasis}
                  options={(Object.keys(EARLY_DEPARTURE_BASIS_LABELS) as EarlyDepartureBasis[]).map((v) => ({ value: v, label: EARLY_DEPARTURE_BASIS_LABELS[v] }))}
                />
              </Field>
              {earlyDepartureBasis === 'PERCENTAGE_OF_REMAINING_STAY' ? (
                <Field label="Procenat preostalog boravka">
                  <input name="earlyDeparturePercentage" type="number" min={0} max={100} required className="input w-32" />
                </Field>
              ) : (
                <Field label="Fiksan iznos (u najmanjoj jedinici valute ugovora)">
                  <input name="earlyDepartureFlatAmount" type="number" min={0} required className="input w-32" />
                </Field>
              )}
            </>
          )}

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
