'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { addBookingItem, addManualBookingItem, previewAddBookingItem, type AddItemPreviewResult } from './booking-changes-actions';
import { emptyChangeState } from './change-form-state';

// M5 spec §6.7 — DODAVANJE usluge na postojeću rezervaciju (3.9.2026, vlasnikov nalaz: „ni
// jednoj rezervaciji nije moguće dodati dodatnu uslugu u tabu aranžmani a to nam treba").
//
// Ekran je vlasnikov opis, doslovno: „u odnosu na to šta se unosi (veza ikone za pretragu),
// klikom na ikonu da se u samoj rezervaciji otvori prozor za unos nove usluge bez obzira na
// poreklo." Zato:
//
//  - ikonice su ISTI `PRODUCT_ICONS` koje ekran pretrage koristi (§3.0g.1) — jedan izvor
//    istine, pa se nova vrsta proizvoda pojavi na oba mesta bez ijedne dodatne izmene;
//  - prozor se otvara U REZERVACIJI, ne vodi na pretragu — kontekst rezervacije se ne gubi;
//  - poreklo (ugovoreno ili preko API veze) se ovde uopšte ne bira: server ga izvodi iz samog
//    proizvoda, isto kao pri prvoj rezervaciji.
//
// Isti obrazac potvrde kao izmena stavke (`AranzmanItemCard.tsx`): dugme „Dodaj uslugu" je
// zaključano dok se ne proveri cena za tačno ono što je uneto, i svaka izmena polja tu proveru
// poništava. Kapacitet kod dobavljača se uzima na serveru, pre upisa stavke — nikad obrnuto.

interface CatalogOption {
  id: string;
  name: string;
  destinationCity: string;
  destinationCountry: string;
}

// §6.7 — grupni paket se ne dodaje ovim tokom (sastavlja se iz više stavki odjednom, §3.0d.6a),
// a „Individualni paketi" nije vrsta proizvoda nego način sastavljanja pretrage (§3.0d.5a).
// Obe ikonice se zato ovde ne nude: bolje da ih nema nego da postoje i vraćaju 400.
const ADDABLE_ICONS = PRODUCT_ICONS.filter((p) => p.types.length > 0 && !p.types.includes('PACKAGE'));

function formatMoney(amountCents: number, currency = 'EUR'): string {
  return `${(amountCents / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`;
}

export default function AddServicePanel({
  bookingId,
  defaults,
}: {
  bookingId: string;
  /** Datumi i sastav gostiju sa same rezervacije — polazna vrednost, agent ih menja. */
  defaults: { stayFrom?: string; stayTo?: string; adults: number; children: number };
}) {
  const [openIcon, setOpenIcon] = useState<string | null>(null);
  const [options, setOptions] = useState<CatalogOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const [stayFrom, setStayFrom] = useState(defaults.stayFrom?.slice(0, 10) ?? '');
  const [stayTo, setStayTo] = useState(defaults.stayTo?.slice(0, 10) ?? '');
  const [adults, setAdults] = useState(String(defaults.adults || 1));
  const [children, setChildren] = useState(String(defaults.children || 0));
  const [preview, setPreview] = useState<AddItemPreviewResult | null>(null);
  const [pendingPreview, startPreview] = useTransition();
  const [state, formAction] = useActionState(addBookingItem.bind(null, bookingId), emptyChangeState);
  // §6.7b — ručni unos je odvojen režim, ne još jedna ikonica: polja su druga (dobavljač, obe
  // cene), a i sama radnja je druga — ovde se usluga PRAVI, ne bira iz kataloga.
  const [manualOpen, setManualOpen] = useState(false);

  const active = ADDABLE_ICONS.find((p) => p.label === openIcon) ?? null;

  // Katalog se traži tek kad se ikonica stvarno klikne (vidi komentar u
  // `app/api/catalog/products/route.ts`) — dovlačenje svih osam vrsta pri otvaranju kartice bi
  // bilo osam poziva za posao koji agent u većini slučajeva ne radi.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setOptions(null);
    setLoadError(null);
    Promise.all(
      active.types.map((t) =>
        fetch(`/api/catalog/products?type=${encodeURIComponent(t)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      ),
    )
      .then((lists: CatalogOption[][]) => {
        if (cancelled) return;
        setOptions(lists.flat());
      })
      .catch(() => {
        if (!cancelled) setLoadError('Spisak usluga nije dostupan — pokušajte ponovo.');
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  function reset() {
    setManualOpen(false);
    setOpenIcon(null);
    setOptions(null);
    setProductId('');
    setPreview(null);
    setLoadError(null);
  }

  function checkPrice() {
    setPreview(null);
    startPreview(async () => {
      setPreview(await previewAddBookingItem(bookingId, { productId, stayFrom, stayTo, adults: Number(adults), children: Number(children) }));
    });
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-1 text-sm font-semibold text-ink">Dodaj uslugu</div>
      <p className="mb-3 text-xs text-ink-faint">
        Izaberite vrstu usluge — iste ikonice kao u pretrazi. Usluga se dodaje na ovu rezervaciju bez obzira na poreklo (ugovoreno ili preko API
        veze); ukupno zaduženje se preračunava.
      </p>

      <div className="flex flex-wrap gap-2">
        {/* Ručni unos stoji u istom redu sa ikonicama, ali vizuelno odvojen (isprekidan okvir):
            ostale ikonice BIRAJU postojeću uslugu, ova PRAVI novu. */}
        <button
          type="button"
          aria-pressed={manualOpen}
          onClick={() => {
            const next = !manualOpen;
            reset();
            setManualOpen(next);
          }}
          className={`flex min-w-[84px] flex-col items-center gap-1 rounded border border-dashed px-3 py-2 text-[11px] ${
            manualOpen ? 'border-accent bg-accent-soft font-semibold text-accent-strong' : 'border-border text-ink-dim hover:border-accent hover:text-ink'
          }`}
        >
          <Icon name="edit" />
          Ručni unos
        </button>
        {ADDABLE_ICONS.map((p) => {
          const on = openIcon === p.label;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => (on ? reset() : (reset(), setOpenIcon(p.label)))}
              className={`flex min-w-[84px] flex-col items-center gap-1 rounded border px-3 py-2 text-[11px] ${
                on ? 'border-accent bg-accent-soft font-semibold text-accent-strong' : 'border-border text-ink-dim hover:border-accent hover:text-ink'
              }`}
            >
              <Icon name={p.icon} />
              {p.label}
            </button>
          );
        })}
      </div>

      {manualOpen && <ManualServiceForm bookingId={bookingId} defaults={defaults} onDone={reset} />}

      {active && (
        <form action={formAction} className="mt-3 space-y-3 rounded border border-border bg-panel2 p-3">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="stayFrom" value={stayFrom} />
          <input type="hidden" name="stayTo" value={stayTo} />
          <input type="hidden" name="adults" value={adults} />
          <input type="hidden" name="children" value={children} />

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <label htmlFor="add-svc" className="mb-1 block text-xs font-medium text-ink">
                {active.label}
              </label>
              {loadError && <p className="text-xs text-danger">{loadError}</p>}
              {!loadError && options === null && <p className="text-xs text-ink-faint">učitavam spisak…</p>}
              {options !== null && options.length === 0 && (
                // §3.0g.5 — izričita rečenica umesto prazne liste; prazan spisak inače uči
                // korisnika da je ekran pokvaren.
                <p className="text-xs text-ink-faint">
                  {active.emptyMessage ?? 'Za ovu vrstu još nema nijednog aktivnog proizvoda u katalogu (M2).'}
                </p>
              )}
              {options !== null && options.length > 0 && (
                <select
                  id="add-svc"
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setPreview(null);
                  }}
                  className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  <option value="">— izaberite uslugu —</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {[o.destinationCity, o.destinationCountry].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <DateField id="add-from" label="Datum od" value={stayFrom} onChange={(v) => (setStayFrom(v), setPreview(null))} />
            <DateField id="add-to" label="Datum do" value={stayTo} onChange={(v) => (setStayTo(v), setPreview(null))} />
            <NumberField id="add-adults" label="Odraslih" min={1} value={adults} onChange={(v) => (setAdults(v), setPreview(null))} />
            <NumberField id="add-children" label="Dece" min={0} value={children} onChange={(v) => (setChildren(v), setPreview(null))} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={pendingPreview || !productId} onClick={checkPrice}>
              {pendingPreview ? 'proveravam cenu…' : 'Proveri cenu'}
            </Button>
            {preview && !preview.error && (
              <span className="text-xs text-ink">
                usluga <span className="font-mono font-semibold">{formatMoney(preview.newPrice ?? 0, preview.newCurrency ?? undefined)}</span> ·
                ukupno <span className="font-mono">{formatMoney(preview.bookingTotalBefore ?? 0, preview.newCurrency ?? undefined)}</span> →{' '}
                <span className="font-mono font-semibold text-ink">{formatMoney(preview.bookingTotalAfter ?? 0, preview.newCurrency ?? undefined)}</span>
              </span>
            )}
            {preview?.error && <span className="text-xs text-danger">{preview.error}</span>}
          </div>

          <div className="flex items-center gap-2">
            <SubmitButton disabled={!preview || !!preview.error} />
            <button type="button" onClick={reset} className="text-xs text-ink-faint hover:text-ink">
              odustani
            </button>
          </div>

          <p className="text-[11px] text-ink-faint">
            Kapacitet kod dobavljača se uzima pre upisa stavke (M5 spec §6.7). Za ugovorenu uslugu se odmah priprema NOVA najava tom dobavljaču;
            već poslate najave se ne diraju.
          </p>

          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          {state.ok && <p className="text-xs text-ok">{state.ok}</p>}
        </form>
      )}
    </div>
  );
}

/**
 * §6.7b — usluga koje nema ni u ugovoru (M3) ni kod provajdera (M4).
 *
 * Četiri polja koja je vlasnik izričito tražio — dobavljač, nabavna cena, marža, izlazna cena —
 * ovde su tri polja i jedan izračun: marža je RAZLIKA dve cene, prikazana uživo. Tako je uvek
 * tačna; treće uneto polje bi se prvom greškom razišlo sa druga dva.
 *
 * Kvačica „sačuvaj u katalog" (vlasnikova odluka): bez nje usluga ostaje samo na ovoj
 * rezervaciji, sa njom ulazi u katalog i sledeći put se bira kao svaka druga.
 */
function ManualServiceForm({
  bookingId,
  defaults,
  onDone,
}: {
  bookingId: string;
  defaults: { stayFrom?: string; stayTo?: string; adults: number; children: number };
  onDone: () => void;
}) {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[] | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [productType, setProductType] = useState('TRANSFER');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [baseCost, setBaseCost] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [stayFrom, setStayFrom] = useState(defaults.stayFrom?.slice(0, 10) ?? '');
  const [stayTo, setStayTo] = useState(defaults.stayTo?.slice(0, 10) ?? '');
  const [saveToCatalog, setSaveToCatalog] = useState(false);
  const [result, setResult] = useState<{ error: string | null; ok: string | null } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/suppliers')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list) => !cancelled && setSuppliers(list))
      .catch(() => !cancelled && setSuppliers([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const toMinor = (v: string) => Math.round(Number(v.replace(',', '.')) * 100);
  const margin = baseCost && finalPrice ? toMinor(finalPrice) - toMinor(baseCost) : null;

  function submit() {
    setResult(null);
    start(async () => {
      const res = await addManualBookingItem(bookingId, {
        productType,
        name,
        supplierId,
        destinationCountry: country,
        destinationCity: city,
        baseCost: toMinor(baseCost),
        finalPrice: toMinor(finalPrice),
        currency: 'EUR',
        stayFrom,
        stayTo,
        adults: defaults.adults || 1,
        children: defaults.children || 0,
        saveToCatalog,
      });
      setResult({ error: res.error, ok: res.ok });
      if (!res.error) onDone();
    });
  }

  return (
    <div className="mt-3 space-y-3 rounded border border-dashed border-border bg-panel2 p-3">
      <p className="text-xs text-ink-faint">
        Usluga koje nema ni u ugovoru ni kod provajdera. Dobavljač je obavezan — bez njega vaučer i najava po dobavljaču ne mogu da rade.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="m-type" className="mb-1 block text-xs font-medium text-ink">
            Vrsta
          </label>
          <select
            id="m-type"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {ADDABLE_ICONS.flatMap((p) => p.types).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="m-name" className="mb-1 block text-xs font-medium text-ink">
            Naziv usluge
          </label>
          <input
            id="m-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="npr. Prevoz kombijem, aerodrom — hotel"
            className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="m-supplier" className="mb-1 block text-xs font-medium text-ink">
            Dobavljač
          </label>
          <select
            id="m-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">{suppliers === null ? 'učitavam…' : '— izaberite dobavljača —'}</option>
            {(suppliers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <TextField id="m-country" label="Država" value={country} onChange={setCountry} />
        <TextField id="m-city" label="Mesto" value={city} onChange={setCity} />

        <DateField id="m-from" label="Datum od" value={stayFrom} onChange={setStayFrom} />
        <DateField id="m-to" label="Datum do" value={stayTo} onChange={setStayTo} />
        <TextField id="m-base" label="Nabavna cena (EUR)" value={baseCost} onChange={setBaseCost} />
        <TextField id="m-final" label="Izlazna cena (EUR)" value={finalPrice} onChange={setFinalPrice} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        {/* Marža je izračun, ne polje — vidi komentar iznad komponente. */}
        <span className="text-ink-dim">
          Marža:{' '}
          <span className={`font-mono font-semibold ${margin != null && margin < 0 ? 'text-danger' : 'text-ink'}`}>
            {margin == null ? '—' : `${(margin / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} EUR`}
          </span>
        </span>
        <label className="flex items-center gap-1.5 text-ink-dim">
          <input type="checkbox" checked={saveToCatalog} onChange={(e) => setSaveToCatalog(e.target.checked)} />
          sačuvaj u katalog (usluga koja se ponavlja)
        </label>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={submit}>
          {pending ? 'dodajem…' : 'Dodaj uslugu'}
        </Button>
        <button type="button" onClick={onDone} className="text-xs text-ink-faint hover:text-ink">
          odustani
        </button>
      </div>

      <p className="text-[11px] text-ink-faint">
        Bez kvačice usluga ostaje samo na ovoj rezervaciji — ne pojavljuje se u pretrazi, na sajtu ni u B2B portalu (M5 spec §6.7b).
      </p>

      {result?.error && <p className="text-xs text-danger">{result.error}</p>}
      {result?.ok && <p className="text-xs text-ok">{result.ok}</p>}
    </div>
  );
}

function TextField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}

function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}

function NumberField({ id, label, min, value, onChange }: { id: string; label: string; min: number; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-panel px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled || pending}>
      {pending ? 'dodajem…' : 'Dodaj uslugu'}
    </Button>
  );
}
