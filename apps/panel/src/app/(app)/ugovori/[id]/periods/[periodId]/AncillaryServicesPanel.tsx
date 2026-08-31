'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { addAncillaryService, FormState } from '../../../actions';
import { ButtonGroup, ToggleButton } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const initialState: FormState = { error: null };

export type AncillaryPricingMode = 'FLAT_PER_UNIT' | 'PERCENTAGE_OF_NIGHTLY_RATE';
export type AncillaryUnit = 'PER_STAY' | 'PER_NIGHT' | 'PER_DAY' | 'PER_PERSON' | 'PER_PET' | 'PER_ROOM';

export interface AncillaryService {
  id: string;
  name: string;
  pricingMode: AncillaryPricingMode;
  flatAmount: number | null;
  percentageOfNightlyRate: number | null;
  unit: AncillaryUnit;
  isMandatory: boolean;
  isRefundable: boolean;
  maxQuantity: number | null;
  notes: string | null;
}

const PRICING_MODE_LABELS: Record<AncillaryPricingMode, string> = { FLAT_PER_UNIT: 'Fiksna cena', PERCENTAGE_OF_NIGHTLY_RATE: '% od cene noćenja' };
const UNIT_LABELS: Record<AncillaryUnit, string> = {
  PER_STAY: 'po boravku',
  PER_NIGHT: 'po noći',
  PER_DAY: 'po danu',
  PER_PERSON: 'po osobi',
  PER_PET: 'po ljubimcu',
  PER_ROOM: 'po sobi',
};

// M3 spec §2.6 dopuna v1.12 — pomoćni troškovi/usluge po periodu (npr. parking, ljubimac,
// klima). Isti obrazac kao RateLinesPanel/CancellationRulesPanel — backend PUT uvek KREIRA
// novu stavku, forma je za dodavanje, ne izmenu.
export default function AncillaryServicesPanel({
  contractId,
  periodId,
  services,
  canEdit,
}: {
  contractId: string;
  periodId: string;
  services: AncillaryService[];
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const boundAction = addAncillaryService.bind(null, contractId, periodId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [pricingMode, setPricingMode] = useState<AncillaryPricingMode>('FLAT_PER_UNIT');
  const [unit, setUnit] = useState<AncillaryUnit>('PER_STAY');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isRefundable, setIsRefundable] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Dodatne usluge</h2>
        {canEdit && (
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            {showForm ? 'Zatvori' : '+ Dodaj'}
          </Button>
        )}
      </div>

      {services.length === 0 && <p className="text-xs text-ink-faint">Nijedna dodatna usluga još nije uneta.</p>}

      <div className="flex flex-col gap-1.5 text-xs">
        {services.map((s) => (
          <div key={s.id} className="rounded border border-border bg-panel2 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">{s.name}</span>
              <div className="flex gap-1">
                {s.isMandatory && <Badge variant="warn">obavezno</Badge>}
                <Badge variant="secondary">{UNIT_LABELS[s.unit]}</Badge>
              </div>
            </div>
            <div className="mt-0.5 text-ink-faint">
              {s.pricingMode === 'FLAT_PER_UNIT' ? `${s.flatAmount}` : `${s.percentageOfNightlyRate}% od cene noćenja`}
              {s.isRefundable && ' · povratno'}
            </div>
          </div>
        ))}
      </div>

      {showForm && canEdit && (
        <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-xs">
          {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}

          <Field label="Naziv usluge">
            <input name="name" required className="input" placeholder="npr. parking, ljubimac, klima" />
          </Field>

          <Field label="Način obračuna">
            <input type="hidden" name="pricingMode" value={pricingMode} />
            <ButtonGroup
              value={pricingMode}
              onChange={setPricingMode}
              options={(Object.keys(PRICING_MODE_LABELS) as AncillaryPricingMode[]).map((v) => ({ value: v, label: PRICING_MODE_LABELS[v] }))}
            />
          </Field>

          {pricingMode === 'FLAT_PER_UNIT' ? (
            <Field label="Cena (u najmanjoj jedinici valute ugovora)">
              <input name="flatAmount" type="number" min={0} required className="input w-32" />
            </Field>
          ) : (
            <Field label="Procenat od cene noćenja">
              <input name="percentageOfNightlyRate" type="number" min={0} max={100} step="0.01" required className="input w-32" />
            </Field>
          )}

          <Field label="Jedinica">
            <input type="hidden" name="unit" value={unit} />
            <ButtonGroup value={unit} onChange={setUnit} options={(Object.keys(UNIT_LABELS) as AncillaryUnit[]).map((v) => ({ value: v, label: UNIT_LABELS[v] }))} />
          </Field>

          <div className="flex gap-2">
            <input type="hidden" name="isMandatory" value={isMandatory ? 'true' : 'false'} />
            <ToggleButton active={isMandatory} onToggle={() => setIsMandatory((v) => !v)} label="obavezno" />
            <input type="hidden" name="isRefundable" value={isRefundable ? 'true' : 'false'} />
            <ToggleButton active={isRefundable} onToggle={() => setIsRefundable((v) => !v)} label="povratno" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Maksimalna količina (opciono)">
              <input name="maxQuantity" type="number" min={1} className="input" />
            </Field>
            <Field label="Napomena (opciono)">
              <input name="notes" className="input" />
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
      {pending ? 'Čuvanje…' : 'Sačuvaj dodatnu uslugu'}
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
