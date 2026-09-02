'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { modifyBookingItem, previewModifyPrice, type ModifyPreviewResult } from './booking-changes-actions';
import { emptyChangeState } from './change-form-state';

export interface CandidateProduct {
  id: string;
  name: string;
  destinationCity: string;
  destinationCountry: string;
}

export interface AranzmanItem {
  id: string;
  productId: string;
  name: string;
  type: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  finalPrice: number;
  finalPriceCurrency?: string;
  itemStatus: string;
  stayFrom?: string;
  stayTo?: string;
  unitCount?: number;
  guestCount: number;
  supplierReference?: string;
}

function typeIcon(type: string): string {
  return PRODUCT_ICONS.find((p) => p.types.includes(type))?.icon ?? 'question';
}

function nightsBetween(from?: string, to?: string): string {
  if (!from || !to) return '—';
  const n = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  return n > 0 ? String(n) : '—';
}

function formatMoney(amountMinor: number, currency?: string): string {
  return `${(amountMinor / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
}

// M5 spec §6 dopuna (2.9.2026, na zahtev vlasnika) — kartica Aranžman sad dozvoljava izmenu
// USLUGE (koji proizvod) i datuma po stavci, uz obaveznu "proveru cene" pre potvrde. Naslanja
// se na postojeći `POST /bookings/:id/modify` (isti mehanizam kao kartica Izmene — otkazivanje
// stare stavke + nova provera dostupnosti/cene), samo sad prima i opcioni `productId`. Ikonica
// tipa proizvoda (`PRODUCT_ICONS`, deljena sa `/rezervacije/pretraga`) stoji UMESTO teksta tipa
// (`ACCOMMODATION`/`TRANSFER`/...) — vlasnikov zahtev.
export default function AranzmanItemCard({
  bookingId,
  item,
  candidates,
  canModify,
}: {
  bookingId: string;
  item: AranzmanItem;
  candidates: CandidateProduct[];
  canModify: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [productId, setProductId] = useState(item.productId);
  const [stayFrom, setStayFrom] = useState(item.stayFrom?.slice(0, 10) ?? '');
  const [stayTo, setStayTo] = useState(item.stayTo?.slice(0, 10) ?? '');
  const [preview, setPreview] = useState<ModifyPreviewResult | null>(null);
  const [pendingPreview, startPreview] = useTransition();
  const [state, formAction] = useActionState(modifyBookingItem.bind(null, bookingId), emptyChangeState);

  const iconName = typeIcon(item.type);
  const canEdit = canModify && item.itemStatus !== 'CANCELLED';

  function checkPrice() {
    setPreview(null);
    startPreview(async () => {
      const result = await previewModifyPrice(bookingId, {
        bookingItemId: item.id,
        productId: productId !== item.productId ? productId : undefined,
        stayFrom,
        stayTo,
        adults: item.guestCount || 1,
        children: 0,
      });
      setPreview(result);
    });
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span title={item.type} className="mt-0.5 text-accent">
            <Icon name={iconName} />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{item.name}</div>
            <div className="mt-0.5 text-xs text-ink-faint">{[item.destinationCity, item.destinationCountry].filter(Boolean).join(', ')}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-ink">{formatMoney(item.finalPrice, item.finalPriceCurrency)}</span>
          <Badge label={item.itemStatus} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
        <Field label="Od" value={item.stayFrom ? new Date(item.stayFrom).toLocaleDateString('sr-RS') : '—'} />
        <Field label="Do" value={item.stayTo ? new Date(item.stayTo).toLocaleDateString('sr-RS') : '—'} />
        <Field label="Noćenja" value={nightsBetween(item.stayFrom, item.stayTo)} />
        <Field label="Jedinica" value={String(item.unitCount ?? 1)} />
        <Field label="Putnika na stavci" value={String(item.guestCount)} />
        {item.supplierReference && <Field label="Ref. dobavljača" value={item.supplierReference} />}
      </dl>

      {canEdit && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
        >
          <Icon name="edit" /> Izmeni uslugu / datume
        </button>
      )}

      {canEdit && editing && (
        /* Server akcija (`modifyBookingItem`) se šalje tek kad postoji svež pregled cene za TAČNO
           ono što se menja — svaka izmena polja ispod briše `preview`, "Potvrdi" je zaključan dok
           se cena ponovo ne proveri (isti princip kao §6.4 duplikat upozorenje: ništa se ne
           izvršava bez eksplicitnog koraka pre). */
        <form action={formAction} className="mt-3 space-y-3 rounded border border-border bg-panel2 p-3">
          <input type="hidden" name="bookingItemId" value={item.id} />
          <input type="hidden" name="productId" value={productId !== item.productId ? productId : ''} />
          <input type="hidden" name="stayFrom" value={stayFrom} />
          <input type="hidden" name="stayTo" value={stayTo} />
          <input type="hidden" name="adults" value={String(item.guestCount || 1)} />
          <input type="hidden" name="children" value="0" />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label htmlFor={`svc-${item.id}`} className="mb-1 block text-xs font-medium text-ink">
                Usluga
              </label>
              <select
                id={`svc-${item.id}`}
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setPreview(null);
                }}
                className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value={item.productId}>{item.name} (trenutna)</option>
                {candidates
                  .filter((c) => c.id !== item.productId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {[c.destinationCity, c.destinationCountry].filter(Boolean).join(', ')}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor={`from-${item.id}`} className="mb-1 block text-xs font-medium text-ink">
                Datum od
              </label>
              <input
                id={`from-${item.id}`}
                type="date"
                value={stayFrom}
                onChange={(e) => {
                  setStayFrom(e.target.value);
                  setPreview(null);
                }}
                className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor={`to-${item.id}`} className="mb-1 block text-xs font-medium text-ink">
                Datum do
              </label>
              <input
                id={`to-${item.id}`}
                type="date"
                value={stayTo}
                onChange={(e) => {
                  setStayTo(e.target.value);
                  setPreview(null);
                }}
                className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={pendingPreview} onClick={checkPrice}>
              {pendingPreview ? 'proveravam cenu…' : 'Proveri cenu'}
            </Button>
            {preview && !preview.error && (
              <PriceCheckResult preview={preview} />
            )}
            {preview?.error && <span className="text-xs text-danger">{preview.error}</span>}
          </div>

          <div className="flex items-center gap-2">
            <SubmitButton disabled={!preview || !!preview.error} />
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setPreview(null);
                setProductId(item.productId);
                setStayFrom(item.stayFrom?.slice(0, 10) ?? '');
                setStayTo(item.stayTo?.slice(0, 10) ?? '');
              }}
              className="text-xs text-ink-faint hover:text-ink"
            >
              odustani
            </button>
          </div>

          <p className="text-[11px] text-ink-faint">
            Sistem staru stavku otkazuje i pravi novu po novom zahtevu (M5 spec §6) — dugme "Potvrdi" je zaključano dok se ne proveri cena za
            tačno ono što je uneto.
          </p>

          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.ok && <p className="text-xs text-ok">{state.ok}</p>}
        </form>
      )}
    </div>
  );
}

function PriceCheckResult({ preview }: { preview: ModifyPreviewResult }) {
  const diff = preview.priceDifference ?? 0;
  const tone = diff > 0 ? 'text-danger' : diff < 0 ? 'text-ok' : 'text-ink-faint';
  return (
    <span className="text-xs text-ink">
      trenutno <span className="font-mono">{formatMoney(preview.currentPrice ?? 0, preview.currentCurrency ?? undefined)}</span> → novo{' '}
      <span className="font-mono">{formatMoney(preview.newPrice ?? 0, preview.newCurrency ?? undefined)}</span>{' '}
      <span className={`font-mono font-semibold ${tone}`}>
        ({diff > 0 ? '+' : ''}
        {formatMoney(diff, preview.newCurrency ?? undefined)})
      </span>
    </span>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? 'primenjujem…' : 'Potvrdi izmenu'}
    </Button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  const tone = ['CONFIRMED', 'PAID'].includes(label) ? 'text-ok bg-ok-bg' : ['CANCELLED', 'UNPAID'].includes(label) ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}
