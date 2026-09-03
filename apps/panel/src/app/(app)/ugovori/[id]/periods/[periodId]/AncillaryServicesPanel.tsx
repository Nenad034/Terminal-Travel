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
// M3 spec §2.6 v1.13 (3.9.2026) — zamenjuje raniji `AncillaryUnit`: osnova je PAR
// (osoba/soba × dan/period). Stari oblik je umeo da kaže „po osobi" ILI „po danu", ali ne
// „po osobi i danu", a vlasnik je potvrdio da su stvarne sve četiri kombinacije.
export type AncillaryPriceBasis =
  | 'PER_PERSON_PER_NIGHT'
  | 'PER_ROOM_PER_NIGHT'
  | 'PER_PERSON_PER_STAY'
  | 'PER_ROOM_PER_STAY'
  | 'PER_PET_PER_NIGHT'
  | 'PER_PET_PER_STAY';
export type AncillaryKind = 'SURCHARGE' | 'DISCOUNT';
export type AncillaryPayable = 'AGENCY' | 'ON_SITE';

export interface AncillaryService {
  id: string;
  name: string;
  kind: AncillaryKind;
  pricingMode: AncillaryPricingMode;
  flatAmount: number | null;
  percentageOfNightlyRate: number | null;
  priceBasis: AncillaryPriceBasis;
  coversPersons: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  childMaxAge: number | null;
  payable: AncillaryPayable;
  isMandatory: boolean;
  isRefundable: boolean;
  maxQuantity: number | null;
  notes: string | null;
}

const PRICING_MODE_LABELS: Record<AncillaryPricingMode, string> = { FLAT_PER_UNIT: 'Fiksna cena', PERCENTAGE_OF_NIGHTLY_RATE: '% od cene noćenja' };
const BASIS_LABELS: Record<AncillaryPriceBasis, string> = {
  PER_PERSON_PER_NIGHT: 'po osobi i danu',
  PER_ROOM_PER_NIGHT: 'po sobi i danu',
  PER_PERSON_PER_STAY: 'po osobi i periodu',
  PER_ROOM_PER_STAY: 'po sobi i periodu',
  PER_PET_PER_NIGHT: 'po ljubimcu i danu',
  PER_PET_PER_STAY: 'po ljubimcu i periodu',
};
const KIND_LABELS: Record<AncillaryKind, string> = { SURCHARGE: 'Doplata', DISCOUNT: 'Popust' };
const PAYABLE_LABELS: Record<AncillaryPayable, string> = { AGENCY: 'Plaća se u agenciji', ON_SITE: 'Plaća se na licu mesta' };

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
  const [priceBasis, setPriceBasis] = useState<AncillaryPriceBasis>('PER_ROOM_PER_STAY');
  const [kind, setKind] = useState<AncillaryKind>('SURCHARGE');
  const [payable, setPayable] = useState<AncillaryPayable>('AGENCY');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isRefundable, setIsRefundable] = useState(false);
  // Granice po sastavu gostiju imaju smisla samo kad se cena vezuje za SOBU — kod cene po osobi
  // svaka osoba već plaća svoje, pa „za koliko osoba važi" nema šta da znači.
  const perRoom = priceBasis.startsWith('PER_ROOM');

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
                {s.kind === 'DISCOUNT' && <Badge variant="secondary">popust</Badge>}
                {s.isMandatory && <Badge variant="warn">obavezno</Badge>}
                {s.payable === 'ON_SITE' && <Badge variant="warn">na licu mesta</Badge>}
                <Badge variant="secondary">{BASIS_LABELS[s.priceBasis]}</Badge>
              </div>
            </div>
            <div className="mt-0.5 text-ink-faint">
              {s.pricingMode === 'FLAT_PER_UNIT' ? `${s.flatAmount}` : `${s.percentageOfNightlyRate}% od cene noćenja`}
              {s.isRefundable && ' · povratno'}
              {s.coversPersons != null && ` · za ${s.coversPersons} os.`}
              {s.maxAdults != null && ` · max ${s.maxAdults} odr.`}
              {s.maxChildren != null && ` · max ${s.maxChildren} dece`}
              {s.childMaxAge != null && ` · dete do ${s.childMaxAge}`}
              {/* §6.7a — iznos koji gost plaća dobavljaču ne ulazi u cenu aranžmana; mora se
                  videti i ovde, ne samo u ugovoru i na vaučeru. */}
              {s.payable === 'ON_SITE' && ' · ne ulazi u cenu aranžmana'}
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

          <Field label="Doplata ili popust">
            <input type="hidden" name="kind" value={kind} />
            <ButtonGroup value={kind} onChange={setKind} options={(Object.keys(KIND_LABELS) as AncillaryKind[]).map((v) => ({ value: v, label: KIND_LABELS[v] }))} />
          </Field>

          <Field label="Osnova obračuna">
            <input type="hidden" name="priceBasis" value={priceBasis} />
            <ButtonGroup
              value={priceBasis}
              onChange={setPriceBasis}
              options={(Object.keys(BASIS_LABELS) as AncillaryPriceBasis[]).map((v) => ({ value: v, label: BASIS_LABELS[v] }))}
            />
          </Field>

          {perRoom && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Važi za ukupno osoba">
                <input name="coversPersons" type="number" min={1} required className="input" />
              </Field>
              <Field label="Max odraslih (opciono)">
                <input name="maxAdults" type="number" min={0} className="input" />
              </Field>
              <Field label="Max dece (opciono)">
                <input name="maxChildren" type="number" min={0} className="input" />
              </Field>
              <Field label="Dete do (godina, npr. 6,99)">
                <input name="childMaxAge" type="number" min={0} step="0.01" className="input" />
              </Field>
            </div>
          )}

          <Field label="Gde se plaća">
            <input type="hidden" name="payable" value={payable} />
            <ButtonGroup
              value={payable}
              onChange={setPayable}
              options={(Object.keys(PAYABLE_LABELS) as AncillaryPayable[]).map((v) => ({ value: v, label: PAYABLE_LABELS[v] }))}
            />
            {payable === 'ON_SITE' && (
              <span className="mt-1 text-[11px] text-ink-faint">
                Ne ulazi u ukupnu cenu aranžmana (agencija je ne naplaćuje), ali se štampa u ugovoru sa klijentom i na vaučeru — M5 spec §6.7a.
              </span>
            )}
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
