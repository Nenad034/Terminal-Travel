'use client';

import { useActionState, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import {
  addAncillaryToItem,
  listItemAncillaries,
  modifyBookingItem,
  previewModifyPrice,
  type AncillaryOption,
  type ModifyPreviewResult,
} from './booking-changes-actions';
import { emptyChangeState } from './change-form-state';

export interface CandidateProduct {
  id: string;
  name: string;
  destinationCity: string;
  destinationArea?: string | null;
  destinationCountry: string;
}

/** M5 spec §6.7a — vezana doplata/popust, onako kako se prikazuje ispod matične stavke. */
export interface AranzmanAncillary {
  id: string;
  name: string;
  finalPrice: number;
  finalPriceCurrency?: string;
  itemStatus: string;
  payable?: 'AGENCY' | 'ON_SITE';
  unitCount?: number;
}

export interface AranzmanItem {
  id: string;
  productId: string;
  name: string;
  type: string;
  destinationCity: string | null;
  // M2 spec §2.1b (4.9.2026) — regija/poluostrvo KAD se razlikuje od destinationCity
  // (npr. "Sitonija, Halkidiki" za mesto koje je unutar Halkidikija).
  destinationArea?: string | null;
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
  ancillaries,
}: {
  bookingId: string;
  item: AranzmanItem;
  candidates: CandidateProduct[];
  canModify: boolean;
  /** §6.7a — doplate/popusti vezani za OVU stavku. Prikazuju se uz nju, ne kao zaseban red. */
  ancillaries?: AranzmanAncillary[];
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

  // §6.7a — spisak ugovorenih doplata se traži tek kad se panel otvori: većina pregleda
  // rezervacije nikad ne dodaje doplatu, a spisak zavisi od ugovornog perioda te stavke.
  const [ancOpen, setAncOpen] = useState(false);
  const [ancOptions, setAncOptions] = useState<AncillaryOption[] | null>(null);
  const [ancError, setAncError] = useState<string | null>(null);
  const [ancPending, startAnc] = useTransition();

  function openAncillaries() {
    setAncOpen(true);
    setAncOptions(null);
    setAncError(null);
    startAnc(async () => {
      const res = await listItemAncillaries(bookingId, item.id);
      setAncError(res.error);
      setAncOptions(res.options);
    });
  }

  function addAncillary(optionId: string) {
    startAnc(async () => {
      const res = await addAncillaryToItem(bookingId, item.id, optionId);
      if (res.error) setAncError(res.error);
      else {
        setAncError(null);
        const refreshed = await listItemAncillaries(bookingId, item.id);
        setAncOptions(refreshed.options);
      }
    });
  }

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
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span title={item.type} className="mt-0.5 text-accent">
            <Icon name={iconName} />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{item.name}</div>
            {/* font-semibold/ink-dim (4.9.2026) — isti razlog kao istoimeni red na tabu Pregled
                (page.tsx ItemsSummaryList): najbleđi ton je najvažniji podatak (šta/gde) učinio
                manje čitljivim od sekundarnih detalja. destinationArea (M2 spec §2.1b) dodat
                između mesta i države — za regije sa poluostrvima/grupama ostrva (npr. Halkidiki/
                Sitonija) samo ime mesta ne govori dovoljno. */}
            <div className="text-xs font-semibold text-ink-dim">
              {[item.destinationCity, item.destinationArea, item.destinationCountry].filter(Boolean).join(', ')}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold text-ink">{formatMoney(item.finalPrice, item.finalPriceCurrency)}</span>
          <Badge label={item.itemStatus} />
        </div>
      </div>

      {/* Kompaktan jednoredni prikaz — pre je svako polje bilo sopstvena kolona u
          grid-cols-4, što je na širokoj kartici ostavljalo veliki prazan prostor
          (posebno kad drugi red ima manje od 4 polja). flex-wrap sad pakuje polja
          jedno uz drugo, po prirodnoj širini sadržaja. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        <Field label="Od" value={item.stayFrom ? new Date(item.stayFrom).toLocaleDateString('sr-RS') : '—'} />
        <Dot />
        <Field label="Do" value={item.stayTo ? new Date(item.stayTo).toLocaleDateString('sr-RS') : '—'} />
        <Dot />
        <Field label="Noćenja" value={nightsBetween(item.stayFrom, item.stayTo)} />
        <Dot />
        <Field label="Jedinica" value={String(item.unitCount ?? 1)} />
        <Dot />
        <Field label="Putnika na stavci" value={String(item.guestCount)} />
        {item.supplierReference && (
          <>
            <Dot />
            <Field label="Ref. dobavljača" value={item.supplierReference} />
          </>
        )}
      </div>

      {/* §6.7a — vezane doplate/popusti stoje UZ stavku kojoj pripadaju. Otkazana doplata
          ostaje vidljiva, precrtana: trag da je nekad postojala je deo dosijea. */}
      {ancillaries && ancillaries.length > 0 && (
        <div className="mt-2 space-y-1 border-l-2 border-border pl-3">
          {ancillaries.map((a) => (
            <div key={a.id} className={`flex items-center justify-between text-xs ${a.itemStatus === 'CANCELLED' ? 'text-ink-faint line-through' : 'text-ink-dim'}`}>
              <span>
                {a.finalPrice < 0 ? '− ' : '+ '}
                {a.name}
                {a.unitCount && a.unitCount > 1 ? ` ×${a.unitCount}` : ''}
                {a.payable === 'ON_SITE' && <span className="ml-1.5 text-warn">plaća se na licu mesta</span>}
              </span>
              <span className="font-mono">{formatMoney(Math.abs(a.finalPrice), a.finalPriceCurrency)}</span>
            </div>
          ))}
        </div>
      )}

      {canEdit && !editing && (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
            <Icon name="edit" /> Izmeni uslugu / datume
          </button>
          {!ancOpen && (
            <button onClick={openAncillaries} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
              <Icon name="add" /> Dodaj doplatu / popust
            </button>
          )}
        </div>
      )}

      {ancOpen && canEdit && (
        <div className="mt-3 rounded border border-border bg-panel2 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-ink">Ugovorene doplate i popusti</span>
            <button onClick={() => setAncOpen(false)} className="text-ink-faint hover:text-ink">
              zatvori
            </button>
          </div>
          {ancPending && <p className="text-ink-faint">učitavam…</p>}
          {ancError && <p className="text-danger">{ancError}</p>}
          {!ancPending && ancOptions !== null && ancOptions.length === 0 && (
            // §3.0g.5 obrazac — izričita rečenica umesto prazne liste. Doplate su UGOVORNA
            // kategorija (M3 §2.6): stavka preko API veze ih nema, i to nije kvar.
            <p className="text-ink-faint">
              Za ovu stavku nema ugovorenih doplata ni popusta — unose se na periodu ugovora (M3), kartica „Dodatne usluge“.
            </p>
          )}
          <div className="flex flex-col gap-1">
            {(ancOptions ?? []).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded border border-border bg-panel px-2 py-1.5">
                <span className="text-ink-dim">
                  {o.name}
                  {o.kind === 'DISCOUNT' && <span className="ml-1.5 text-ok">popust</span>}
                  {o.isMandatory && <span className="ml-1.5 text-warn">obavezno</span>}
                  {o.payable === 'ON_SITE' && <span className="ml-1.5 text-warn">na licu mesta</span>}
                  {o.blockedReason && <span className="ml-1.5 text-danger">{o.blockedReason}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-ink">{formatMoney(o.amount, o.currency)}</span>
                  {o.alreadyAdded ? (
                    <span className="text-ink-faint">dodato</span>
                  ) : (
                    <Button type="button" size="sm" variant="secondary" disabled={ancPending || Boolean(o.blockedReason)} onClick={() => addAncillary(o.id)}>
                      dodaj
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Obavezne doplate se dodaju automatski uz uslugu (M5 spec §6.7a) — ovde se biraju opcione. Iznos koji se plaća na licu mesta ne ulazi u
            ukupno zaduženje, ali ide u ugovor i na vaučer.
          </p>
        </div>
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
                      {c.name} — {[c.destinationCity, c.destinationArea, c.destinationCountry].filter(Boolean).join(', ')}
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
            Sistem staru stavku otkazuje i pravi novu po novom zahtevu (M5 spec §6) — dugme „Potvrdi“ je zaključano dok se ne proveri cena za
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
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</span>
      <span className="text-ink">{value}</span>
    </span>
  );
}

function Dot() {
  return <span className="text-ink-faint">·</span>;
}

function Badge({ label }: { label: string }) {
  const tone = ['CONFIRMED', 'PAID'].includes(label) ? 'text-ok bg-ok-bg' : ['CANCELLED', 'UNPAID'].includes(label) ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}
