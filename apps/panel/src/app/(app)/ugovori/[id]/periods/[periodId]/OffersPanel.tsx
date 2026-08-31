'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { addOffer, FormState } from '../../../actions';
import { ButtonGroup, ToggleButton } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DateField from '@/components/DateField';

const initialState: FormState = { error: null };

export type OfferType = 'EARLY_BOOKING' | 'FREE_NIGHTS';
export type OfferDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface PricelistOffer {
  id: string;
  offerType: OfferType;
  bookingFrom: string;
  bookingTo: string;
  discountType: OfferDiscountType | null;
  discountPercentage: number | null;
  discountAmount: number | null;
  stayNights: number | null;
  payNights: number | null;
  depositPercentage: number | null;
  depositDeadline: string | null;
  minAge: number | null;
  maxAge: number | null;
  combinableWithOtherOffers: boolean;
}

const OFFER_TYPE_LABELS: Record<OfferType, string> = { EARLY_BOOKING: 'Rana rezervacija', FREE_NIGHTS: 'Free nights' };
const DISCOUNT_TYPE_LABELS: Record<OfferDiscountType, string> = { PERCENTAGE: 'Procenat', FIXED_AMOUNT: 'Fiksan iznos' };

// M3 spec §2.4b dopuna v1.12 — akcije (rana rezervacija/free-nights) po periodu. Isti obrazac kao
// RateLinesPanel/CancellationRulesPanel — backend PUT uvek KREIRA novu stavku, forma je za
// dodavanje, ne izmenu. `validArrivalWeekdays[]`/`excludedRoomTypes[]` su API-only za sada (isti
// princip kao `age_pricing[]` u RateLinesPanel.tsx) — ne preopterećuju formu dok se ne pokaže potreba.
export default function OffersPanel({
  contractId,
  periodId,
  offers,
  canEdit,
}: {
  contractId: string;
  periodId: string;
  offers: PricelistOffer[];
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const boundAction = addOffer.bind(null, contractId, periodId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [offerType, setOfferType] = useState<OfferType>('EARLY_BOOKING');
  const [discountType, setDiscountType] = useState<OfferDiscountType>('PERCENTAGE');
  const [combinable, setCombinable] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Ponude (rana rezervacija / free nights)</h2>
        {canEdit && (
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            {showForm ? 'Zatvori' : '+ Dodaj'}
          </Button>
        )}
      </div>

      {offers.length === 0 && <p className="text-xs text-ink-faint">Nijedna ponuda još nije uneta.</p>}

      <div className="flex flex-col gap-1.5 text-xs">
        {offers.map((o) => (
          <div key={o.id} className="rounded border border-border bg-panel2 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink">{OFFER_TYPE_LABELS[o.offerType]}</span>
              <Badge variant="secondary">
                {new Date(o.bookingFrom).toLocaleDateString('sr-RS')} – {new Date(o.bookingTo).toLocaleDateString('sr-RS')}
              </Badge>
            </div>
            <div className="mt-0.5 text-ink-faint">
              {o.offerType === 'EARLY_BOOKING' &&
                (o.discountType === 'PERCENTAGE' ? `popust ${o.discountPercentage}%` : `popust ${o.discountAmount}`)}
              {o.offerType === 'FREE_NIGHTS' && `${o.stayNights}=${o.payNights}`}
              {o.combinableWithOtherOffers && ' · kombinuje se sa drugim ponudama'}
            </div>
          </div>
        ))}
      </div>

      {showForm && canEdit && (
        <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-xs">
          {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}

          <Field label="Tip ponude">
            <input type="hidden" name="offerType" value={offerType} />
            <ButtonGroup value={offerType} onChange={setOfferType} options={(Object.keys(OFFER_TYPE_LABELS) as OfferType[]).map((v) => ({ value: v, label: OFFER_TYPE_LABELS[v] }))} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prijava od">
              <DateField name="bookingFrom" required />
            </Field>
            <Field label="Prijava do">
              <DateField name="bookingTo" required />
            </Field>
          </div>

          {offerType === 'EARLY_BOOKING' && (
            <>
              <Field label="Vrsta popusta">
                <input type="hidden" name="discountType" value={discountType} />
                <ButtonGroup
                  value={discountType}
                  onChange={setDiscountType}
                  options={(Object.keys(DISCOUNT_TYPE_LABELS) as OfferDiscountType[]).map((v) => ({ value: v, label: DISCOUNT_TYPE_LABELS[v] }))}
                />
              </Field>
              {discountType === 'PERCENTAGE' ? (
                <Field label="Popust (%)">
                  <input name="discountPercentage" type="number" min={0} max={100} step="0.01" required className="input w-32" />
                </Field>
              ) : (
                <Field label="Popust (fiksan iznos, u najmanjoj jedinici valute)">
                  <input name="discountAmount" type="number" min={0} required className="input w-32" />
                </Field>
              )}
            </>
          )}

          {offerType === 'FREE_NIGHTS' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Broj plaćenih noćenja (stay_nights)">
                <input name="stayNights" type="number" min={1} required className="input" />
              </Field>
              <Field label="Broj naplaćenih noćenja (pay_nights)">
                <input name="payNights" type="number" min={1} required className="input" />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Depozit (%, opciono)">
              <input name="depositPercentage" type="number" min={0} max={100} step="0.01" className="input" />
            </Field>
            <Field label="Rok za depozit (opciono)">
              <DateField name="depositDeadline" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimalan uzrast (opciono)">
              <input name="minAge" type="number" min={0} step="0.01" className="input" />
            </Field>
            <Field label="Maksimalan uzrast (opciono)">
              <input name="maxAge" type="number" min={0} step="0.01" className="input" />
            </Field>
          </div>

          <div>
            <input type="hidden" name="combinableWithOtherOffers" value={combinable ? 'true' : 'false'} />
            <ToggleButton active={combinable} onToggle={() => setCombinable((v) => !v)} label="kombinuje se sa drugim ponudama" />
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
      {pending ? 'Čuvanje…' : 'Sačuvaj ponudu'}
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
