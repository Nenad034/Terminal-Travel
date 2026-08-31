'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { saveTouristTax, FormState } from '../../../actions';
import { ButtonGroup } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const initialState: FormState = { error: null };

export type TouristTaxCollectedBy = 'PAID_ON_SITE_BY_GUEST' | 'INVOICED_TO_AGENCY';

export interface TouristTaxInfo {
  id: string;
  includedInPrice: boolean;
  collectedBy: TouristTaxCollectedBy | null;
  amountPerNight: number | null;
  currency: string | null;
  taxExemptMaxAge: number | null;
  notes: string | null;
}

const COLLECTED_BY_LABELS: Record<TouristTaxCollectedBy, string> = { PAID_ON_SITE_BY_GUEST: 'Plaća gost na licu mesta', INVOICED_TO_AGENCY: 'Fakturiše se agenciji' };

// M3 spec §2.7 dopuna v1.12 — jedan zapis po periodu (1:1), backend PUT radi pravi upsert
// (izmena ako postoji, kreiranje ako ne) — za razliku od RateLine/CancellationRule/Offer/
// AncillaryService gde PUT uvek kreira nov red. Forma je uvek "izmeni trenutnu vrednost".
// VAŽNO — §2.7 pravna ograda: ovaj podatak je isključivo informativan, ne generiše fakturu
// niti obavezu ni u jednom drugom modulu (M10/M11).
export default function TouristTaxPanel({
  contractId,
  periodId,
  taxInfo,
  canEdit,
}: {
  contractId: string;
  periodId: string;
  taxInfo: TouristTaxInfo | null;
  canEdit: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const boundAction = saveTouristTax.bind(null, contractId, periodId);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [includedInPrice, setIncludedInPrice] = useState(taxInfo?.includedInPrice ?? false);
  const [collectedBy, setCollectedBy] = useState<TouristTaxCollectedBy>(taxInfo?.collectedBy ?? 'PAID_ON_SITE_BY_GUEST');

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Boravišna taksa</h2>
        {canEdit && (
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            {showForm ? 'Zatvori' : taxInfo ? 'Izmeni' : '+ Unesi'}
          </Button>
        )}
      </div>
      <p className="mb-3 text-[11px] text-ink-faint">Isključivo informativno — ne generiše fakturu niti obavezu (M3 spec §2.7).</p>

      {!taxInfo && !showForm && <p className="text-xs text-ink-faint">Nije uneto.</p>}

      {taxInfo && !showForm && (
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div className="col-span-2">
            <dt className="text-ink-faint">Uključena u cenu</dt>
            <dd className="mt-0.5">
              <Badge variant={taxInfo.includedInPrice ? 'ok' : 'secondary'}>{taxInfo.includedInPrice ? 'Da' : 'Ne'}</Badge>
            </dd>
          </div>
          {!taxInfo.includedInPrice && (
            <>
              <div>
                <dt className="text-ink-faint">Naplaćuje</dt>
                <dd className="mt-0.5 text-ink">{taxInfo.collectedBy ? COLLECTED_BY_LABELS[taxInfo.collectedBy] : '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Iznos po noći</dt>
                <dd className="mt-0.5 text-ink">
                  {taxInfo.amountPerNight != null ? `${taxInfo.amountPerNight} ${taxInfo.currency ?? ''}` : '—'}
                </dd>
              </div>
            </>
          )}
          {taxInfo.taxExemptMaxAge != null && (
            <div>
              <dt className="text-ink-faint">Oslobođeni do uzrasta</dt>
              <dd className="mt-0.5 text-ink">{taxInfo.taxExemptMaxAge}</dd>
            </div>
          )}
          {taxInfo.notes && (
            <div className="col-span-2">
              <dt className="text-ink-faint">Napomena</dt>
              <dd className="mt-0.5 text-ink">{taxInfo.notes}</dd>
            </div>
          )}
        </dl>
      )}

      {showForm && canEdit && (
        <form action={formAction} className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-xs">
          {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}

          <Field label="Uključena u cenu">
            <input type="hidden" name="includedInPrice" value={includedInPrice ? 'true' : 'false'} />
            <ButtonGroup
              value={includedInPrice ? 'DA' : 'NE'}
              onChange={(v) => setIncludedInPrice(v === 'DA')}
              options={[
                { value: 'DA', label: 'Da' },
                { value: 'NE', label: 'Ne' },
              ]}
            />
          </Field>

          {!includedInPrice && (
            <>
              <Field label="Ko naplaćuje">
                <input type="hidden" name="collectedBy" value={collectedBy} />
                <ButtonGroup
                  value={collectedBy}
                  onChange={setCollectedBy}
                  options={(Object.keys(COLLECTED_BY_LABELS) as TouristTaxCollectedBy[]).map((v) => ({ value: v, label: COLLECTED_BY_LABELS[v] }))}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Iznos po noći">
                  <input name="amountPerNight" type="number" min={0} defaultValue={taxInfo?.amountPerNight ?? undefined} className="input" />
                </Field>
                <Field label="Valuta">
                  <input name="currency" defaultValue={taxInfo?.currency ?? ''} className="input" placeholder="EUR" />
                </Field>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Oslobođeni do uzrasta (opciono)">
              <input name="taxExemptMaxAge" type="number" min={0} step="0.01" defaultValue={taxInfo?.taxExemptMaxAge ?? undefined} className="input" />
            </Field>
            <Field label="Napomena (opciono)">
              <input name="notes" defaultValue={taxInfo?.notes ?? ''} className="input" />
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
      {pending ? 'Čuvanje…' : 'Sačuvaj boravišnu taksu'}
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
