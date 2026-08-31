'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { addRateLine, FormState } from '../../../actions';
import { ButtonGroup } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const initialState: FormState = { error: null };

export type PriceBasis = 'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT';
export type AgePricingMode = 'PERCENTAGE_OF_BASE_PRICE' | 'FLAT_PRICE_PER_NIGHT';

export interface AgePricingEntry {
  ageCategory: string;
  occupantIndex: number | null;
  minAdultsPresent: number | null;
  pricingMode: AgePricingMode;
  percentage: number | null;
  flatPrice: number | null;
}

export interface RateLine {
  id: string;
  boardType: string;
  occupancy: string;
  priceBasis: PriceBasis;
  price: number;
  cribFeePerNight: number | null;
  agePricing: AgePricingEntry[];
}

const PRICE_BASIS_LABELS: Record<PriceBasis, string> = { PER_ROOM_PER_NIGHT: 'po sobi/noć', PER_PERSON_PER_NIGHT: 'po osobi/noć' };

// M3 spec §2.4/§2.4a. Napomena: backend PUT ovde uvek KREIRA novu stavku (contract-periods.
// service.ts upsertRateLine — nema izmene/brisanja postojeće po ID-ju), pa panel prati isti
// oblik — dodavanje novih cenovnih stavki, ne izmena postojećih. `age_pricing[]` (cena po
// uzrasnoj kategoriji, §2.4a) je van obima ovog prolaza — RateLine se kreira sa osnovnom cenom,
// dopuna uzrasnih cena po redu ostaje API-only dok se pokaže potreba (isti princip kao svaki
// drugi "beleži se kao poznat gap, ne rešava se u ovom prolazu").
export default function RateLinesPanel({ contractId, periodId, rateLines, canEdit }: { contractId: string; periodId: string; rateLines: RateLine[]; canEdit: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const boundAction = addRateLine.bind(null, contractId, periodId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [priceBasis, setPriceBasis] = useState<PriceBasis>('PER_ROOM_PER_NIGHT');

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Cenovne stavke</h2>
        {canEdit && (
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            {showForm ? 'Zatvori' : '+ Dodaj'}
          </Button>
        )}
      </div>

      {rateLines.length === 0 && <p className="text-xs text-ink-faint">Nijedna cenovna stavka još nije uneta.</p>}

      <div className="flex flex-col gap-1.5 text-xs">
        {rateLines.map((r) => (
          <div key={r.id} className="rounded border border-border bg-panel2 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">{r.boardType}</span>
              <Badge variant="secondary">{PRICE_BASIS_LABELS[r.priceBasis]}</Badge>
            </div>
            <div className="mt-0.5 text-ink-faint">
              {r.occupancy} · {r.price}
              {r.cribFeePerNight != null && ` · krevetac +${r.cribFeePerNight}/noć`}
            </div>
            {r.agePricing.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {r.agePricing.map((ap, i) => (
                  <Badge key={i} variant="outline">
                    {ap.ageCategory}: {ap.pricingMode === 'PERCENTAGE_OF_BASE_PRICE' ? `${ap.percentage}%` : `${ap.flatPrice}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && canEdit && (
        <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-xs">
          {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}
          <Field label="Tip usluge (board type)">
            <input name="boardType" required className="input" placeholder="npr. polupansion, all-inclusive" />
          </Field>
          <Field label="Popunjenost na koju se cena odnosi">
            <input name="occupancy" required className="input" placeholder="npr. odrasla osoba u dvokrevetnoj" />
          </Field>
          <Field label="Osnova cene">
            <input type="hidden" name="priceBasis" value={priceBasis} />
            <ButtonGroup value={priceBasis} onChange={setPriceBasis} options={(Object.keys(PRICE_BASIS_LABELS) as PriceBasis[]).map((v) => ({ value: v, label: PRICE_BASIS_LABELS[v] }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cena (u najmanjoj jedinici valute ugovora)">
              <input name="price" type="number" min={0} required className="input" />
            </Field>
            <Field label="Doplata za krevetac po noći (opciono)">
              <input name="cribFeePerNight" type="number" min={0} className="input" />
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
      {pending ? 'Čuvanje…' : 'Sačuvaj cenovnu stavku'}
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
