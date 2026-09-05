'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import MultiSelectDropdown from '@/components/MultiSelectDropdown';
import ClearableTextField from '@/components/ClearableTextField';
import DateRangeField from '@/components/DateRangeField';
import SuggestField, { type Suggestion } from '@/components/SuggestField';
import type { CalendarFiltersShape, CalendarView } from './calendar-utils';

// Isti filter-skup kao "Lista rezervacija" (RealFilterBar.tsx), na zahtev vlasnika 27.8.2026
// ("Dodati filtere koji postoje u Listi rezervacija"). `view`/`date` idu kao skriveni input
// tako da se prikaz i pozicija u kalendaru ne izgube kad se filter primeni (obična GET forma,
// PRAVA navigacija preglednika — ne App Router "meko" navigiranje, isti obrazac kao
// RealFilterBar.tsx, pouzdanije od kliknjivog <Link> za ovakve promene, vidi zamku 9.2 u
// docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md).
//
// "Detaljna pretraga" — modal umesto stalno vidljivog bloka (5.9.2026, vlasnikov predlog, prva
// proba na ovom ekranu pre eventualnog širenja na Listu rezervacija). Ceo dosadašnji blok
// (13 polja u dva reda, stalno na ekranu) sad je iza jednog linka; posle primene sažima se u
// oznaku sa brojem aktivnih kriterijuma + "Uredi"/"×". Forma je NEPROMENJENA (isti GET, ista
// polja) — menja se samo OMOTAČ (uvek vidljiv blok naspram modala), ne podaci ni tok.
const STATUSES = ['PENDING_SUPPLIER_CONFIRMATION', 'CONFIRMED', 'MODIFIED', 'CANCELLED', 'COMPLETED'];
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'INVOICE_PENDING'];
const TIP_NASTUPANJA = ['ORGANIZATOR', 'POSREDNIK'];
const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT', 'CRUISE'];

const inputClass = 'input text-xs';

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function hasValue(v: string | string[] | undefined): boolean {
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

// "Kreirano od/do", "Dolazak od/do", "Odlazak od/do" broje se kao PO JEDAN kriterijum (ne dva) —
// svaki je jedan pojam za korisnika, makar bio upisan u dva polja.
function countActiveCriteria(f: CalendarFiltersShape): number {
  const singleFields: (keyof CalendarFiltersShape)[] = [
    'bookingNumber', 'buyerName', 'status', 'paymentStatus', 'tipNastupanja',
    'productType', 'productName', 'destinationCity', 'destinationCountry', 'currency', 'hasTravelGuarantee',
  ];
  let n = singleFields.filter((k) => hasValue(f[k])).length;
  if (f.createdFrom || f.createdTo) n += 1;
  if (f.stayFrom || f.stayTo) n += 1;
  if (f.returnFrom || f.returnTo) n += 1;
  return n;
}

export default function CalendarFilterBar({ view, date, filters }: { view: CalendarView; date: string; filters: CalendarFiltersShape }) {
  const activeCount = countActiveCriteria(filters);
  const hasAnyFilter = activeCount > 0;
  const [open, setOpen] = useState(false);

  // Zatvaranje na Escape — modal blokira ostatak ekrana dok je otvoren, isti očekivan izlaz
  // kao svaki drugi modal u panelu (CommandPalette.tsx, DestinationProfilesEditor.tsx).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="mb-3">
      {!open &&
        (hasAnyFilter ? (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 py-1.5 font-medium text-accent-strong"
            >
              <Icon name="filter" className="!text-[13px]" />
              Detaljna pretraga · {activeCount} {activeCount === 1 ? 'kriterijum' : 'kriterijuma'}
            </button>
            <button type="button" onClick={() => setOpen(true)} className="font-medium text-ink-faint hover:text-ink">
              uredi
            </button>
            <Link href={`/rezervacije/kalendar?view=${view}&date=${date}`} className="font-medium text-ink-faint hover:text-danger">
              obriši pretragu
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent hover:text-ink"
          >
            <Icon name="filter" className="!text-[13px]" />
            Detaljna pretraga
          </button>
        ))}

      {/* Ceo modal (uklj. sopstveno stanje za dolazak/odlazak, ispod) se montira TEK kad je
          otvoren — "otkaži" tako uvek odbacuje nedovršen unos i vraća se na `filters` iz URL-a,
          isto ponašanje kao ostala (uncontrolled) polja u ovoj formi. */}
      {open && <DetailedSearchModal view={view} date={date} filters={filters} hasAnyFilter={hasAnyFilter} onClose={() => setOpen(false)} />}
    </div>
  );
}

function DetailedSearchModal({
  view,
  date,
  filters,
  hasAnyFilter,
  onClose,
}: {
  view: CalendarView;
  date: string;
  filters: CalendarFiltersShape;
  hasAnyFilter: boolean;
  onClose: () => void;
}) {
  // Dolazak/odlazak od-do (5.9.2026, vlasnikov zahtev) — `DateRangeField.tsx` je kontrolisan
  // (React state, izgrađen za `SearchCriteriaForm.tsx`), pa mu ovde treba sopstveno stanje;
  // `nameFrom`/`nameTo` propovi dodaju skrivena polja da ista PRAVA GET forma i dalje ponese
  // vrednosti pri submit-u (isti "kontrolisan prikaz + skriveno polje" obrazac kao
  // `ClearableDateRange.tsx`/`DateField.tsx`).
  const [stayFrom, setStayFrom] = useState(filters.stayFrom ?? '');
  const [stayTo, setStayTo] = useState(filters.stayTo ?? '');
  const [returnFrom, setReturnFrom] = useState(filters.returnFrom ?? '');
  const [returnTo, setReturnTo] = useState(filters.returnTo ?? '');
  const [createdFrom, setCreatedFrom] = useState(filters.createdFrom ?? '');
  const [createdTo, setCreatedTo] = useState(filters.createdTo ?? '');
  // Naziv hotela — prediktivno (5.9.2026, vlasnikov zahtev: "hotel (prediktivno)"). Spisak
  // naziva se učitava JEDNOM po otvaranju modala (`GET /catalog/products?type=ACCOMMODATION`,
  // ista BFF ruta kao `AddServicePanel.tsx`) i dalje se filtrira lokalno po otkucanom tekstu —
  // katalog ne raste dovoljno brzo da bi ovo bilo skupo, a izbegava mrežni poziv na svaki taster.
  const [productName, setProductName] = useState(filters.productName ?? '');
  const hotelCache = useRef<{ name: string; destinationCity: string }[] | null>(null);
  async function fetchHotelSuggestions(q: string): Promise<Suggestion[]> {
    if (!hotelCache.current) {
      const res = await fetch('/api/catalog/products?type=ACCOMMODATION');
      hotelCache.current = res.ok ? await res.json() : [];
    }
    const needle = q.trim().toLowerCase();
    const matches = needle ? hotelCache.current!.filter((p) => p.name.toLowerCase().includes(needle)) : hotelCache.current!;
    return matches.slice(0, 8).map((p) => ({ value: p.name, label: p.name, hint: p.destinationCity }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-xl border border-border bg-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Detaljna pretraga</h2>
          <button type="button" onClick={onClose} title="Zatvori" className="text-ink-faint hover:text-ink">
            <Icon name="close" />
          </button>
        </div>
        {/* Bez auto-submit na promenu (5.9.2026, vlasnikov nalaz: "momentalno filtriranje...
            svaki put treba da se ponovo otvori modal") — svaka promena je do sad odmah slala
            formu (pravu GET navigaciju), što je zatvaralo modal pre nego što je korisnik stigao
            da popuni ostala polja. Sad se šalje isključivo na "pretraži". */}
        <form action="/rezervacije/kalendar" className="flex flex-col gap-2 text-xs">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={date} />
          {/* ISPRAVKA (5.9.2026, vlasnikov nalaz uz snimak ekrana — polja Status/Uplata/Tip
              nastupanja/Tip proizvoda su se stiskala i preklapala). Uzrok: `flex flex-wrap`
              + `flex-1 min-w-0` po polju (obrazac preuzet iz PUNE širine stranice, gde je
              originalni `CalendarFilterBar` namerno bio BEZ wrap-a) ovde radi nad MODALOM koji
              je uvek uži od stranice, pa `flex-1` polja nemaju fiksnu širinsku referencu i
              `flex-wrap` ih sažima nepredvidivo. Rešenje: `grid` sa fiksnim brojem kolona —
              svako polje dobija stvarno poznatu širinu kolone bez obzira na širinu modala. */}
          {/* Država / destinacija / hotel u JEDNOM redu (5.9.2026, vlasnikov zahtev) — logički
              jedna celina (gde je hotel), pa idu prvi, jedni pored drugih, ne razbacani po
              gridu redosledom kojim su ranije dodavani. */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Destinacija (država)">
              <ClearableTextField name="destinationCountry" defaultValue={filters.destinationCountry ?? ''} placeholder="npr. Grčka" className={inputClass} autoSubmit={false} />
            </Field>
            <Field label="Destinacija (grad)">
              <ClearableTextField name="destinationCity" defaultValue={filters.destinationCity ?? ''} placeholder="npr. Budva" className={inputClass} autoSubmit={false} />
            </Field>
            {/* Naziv hotela, prediktivno (5.9.2026, vlasnikov zahtev) — pretražuje
                `ProductTranslation.name` (M2 spec §2.2) na serveru; predlozi ovde su samo
                pomoć pri kucanju (`SuggestField.tsx`, isti obrazac kao država/destinacija na
                ekranu pretrage), slobodan unos i dalje važi i bez izbora sa liste. */}
            <Field label="Naziv hotela">
              <input type="hidden" name="productName" value={productName} />
              <SuggestField value={productName} onChange={setProductName} fetchSuggestions={fetchHotelSuggestions} placeholder="npr. Sunce" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Broj">
              <ClearableTextField name="bookingNumber" defaultValue={filters.bookingNumber ?? ''} placeholder="TT-2026-..." className={inputClass} autoSubmit={false} />
            </Field>
            <Field label="Nosilac rezervacije">
              <ClearableTextField name="buyerName" defaultValue={filters.buyerName ?? ''} placeholder="ime/naziv" className={inputClass} autoSubmit={false} />
            </Field>
            <MultiSelectDropdown name="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.status)} autoSubmit={false} />
            <MultiSelectDropdown name="paymentStatus" label="Uplata" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.paymentStatus)} autoSubmit={false} />
            <MultiSelectDropdown name="tipNastupanja" label="Tip nastupanja" options={TIP_NASTUPANJA.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.tipNastupanja)} autoSubmit={false} />
            <MultiSelectDropdown name="productType" label="Tip proizvoda" options={PRODUCT_TYPES.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.productType)} autoSubmit={false} />
            <Field label="Valuta">
              <ClearableTextField name="currency" defaultValue={filters.currency ?? ''} placeholder="EUR" className={inputClass} autoSubmit={false} />
            </Field>
            <Field label="Garancija putovanja">
              <select name="hasTravelGuarantee" defaultValue={filters.hasTravelGuarantee ?? ''} className={inputClass}>
                <option value="">svejedno</option>
                <option value="true">ima</option>
                <option value="false">nema</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Kreirano/dolazak/odlazak od-do — ISTI dvomesečni kalendar za sve troje (5.9.2026,
                vlasnikov zahtev: "kalendar za kreirano od...do treba da bude isti kao preostala
                dva"), bez broja noćenja i +3/+5/+7 dana kod sve tri (nezavisne granice, ne
                "boravak od N noći"). */}
            <Field label="Kreirano od/do">
              <DateRangeField
                fromValue={createdFrom}
                toValue={createdTo}
                onChange={(f, t) => {
                  setCreatedFrom(f);
                  setCreatedTo(t);
                }}
                showNightsAndQuick={false}
                nameFrom="createdFrom"
                nameTo="createdTo"
                className={inputClass}
              />
            </Field>
            <Field label="Dolazak od/do">
              <DateRangeField
                fromValue={stayFrom}
                toValue={stayTo}
                onChange={(f, t) => {
                  setStayFrom(f);
                  setStayTo(t);
                }}
                showNightsAndQuick={false}
                nameFrom="stayFrom"
                nameTo="stayTo"
                className={inputClass}
              />
            </Field>
            <Field label="Odlazak od/do">
              <DateRangeField
                fromValue={returnFrom}
                toValue={returnTo}
                onChange={(f, t) => {
                  setReturnFrom(f);
                  setReturnTo(t);
                }}
                showNightsAndQuick={false}
                nameFrom="returnFrom"
                nameTo="returnTo"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <button type="submit" className="rounded bg-brand px-3 py-1.5 font-medium text-brand-ink hover:brightness-90">
              pretraži
            </button>
            {hasAnyFilter && (
              <Link href={`/rezervacije/kalendar?view=${view}&date=${date}`} className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
                obriši filter
              </Link>
            )}
            <button type="button" onClick={onClose} className="ml-auto rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              otkaži
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 min-w-[140px] flex-col gap-0.5">
      <span className="text-xs text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
