'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import MultiSelectDropdown from '@/components/MultiSelectDropdown';
import ClearableTextField from '@/components/ClearableTextField';
import ClearableDateRange from '@/components/ClearableDateRange';
import type { CalendarFiltersShape, CalendarView } from './calendar-utils';

// Isti filter-skup kao "Lista rezervacija" (RealFilterBar.tsx), na zahtev vlasnika 27.8.2026
// ("Dodati filtere koji postoje u Listi rezervacija"), BEZ dolazak/odlazak opsega — sam prikaz
// (mesec/nedelja/dan) već zadaje taj opseg (M5 spec §7 dopuna). `view`/`date` idu kao skriveni
// input tako da se prikaz i pozicija u kalendaru ne izgube kad se filter primeni (obična
// GET forma, PRAVA navigacija preglednika — ne App Router "meko" navigiranje, isti obrazac
// kao RealFilterBar.tsx, pouzdanije od kliknjivog <Link> za ovakve promene, vidi zamku 9.2
// u docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md).
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

// "Kreirano od/do" broji se kao JEDAN kriterijum (ne dva) — to je jedan pojam za korisnika,
// makar bio upisan u dva polja.
function countActiveCriteria(f: CalendarFiltersShape): number {
  const singleFields: (keyof CalendarFiltersShape)[] = [
    'bookingNumber', 'buyerName', 'status', 'paymentStatus', 'tipNastupanja',
    'productType', 'destinationCity', 'destinationCountry', 'currency', 'hasTravelGuarantee',
  ];
  let n = singleFields.filter((k) => hasValue(f[k])).length;
  if (f.createdFrom || f.createdTo) n += 1;
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

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-xl border border-border bg-panel p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Detaljna pretraga</h2>
              <button type="button" onClick={() => setOpen(false)} title="Zatvori" className="text-ink-faint hover:text-ink">
                <Icon name="close" />
              </button>
            </div>
            {/* Bez auto-submit na promenu (5.9.2026, vlasnikov nalaz: "momentalno filtriranje...
                svaki put treba da se ponovo otvori modal") — svaka promena je do sad odmah
                slala formu (pravu GET navigaciju), što je zatvaralo modal pre nego što je
                korisnik stigao da popuni ostala polja. Sad se šalje isključivo na "pretraži". */}
            <form action="/rezervacije/kalendar" className="flex flex-col gap-2 text-xs">
              <input type="hidden" name="view" value={view} />
              <input type="hidden" name="date" value={date} />
              {/* ISPRAVKA (5.9.2026, vlasnikov nalaz uz snimak ekrana — polja Status/Uplata/Tip
                  nastupanja/Tip proizvoda su se stiskala i preklapala). Uzrok: `flex flex-wrap`
                  + `flex-1 min-w-0` po polju (obrazac preuzet iz PUNE širine stranice, gde je
                  originalni `CalendarFilterBar` namerno bio BEZ wrap-a — vidi zamenjenu napomenu
                  od 27.8.2026) ovde radi nad MODALOM koji je uvek uži od stranice, pa `flex-1`
                  polja nemaju fiksnu širinsku referencu i `flex-wrap` ih sažima nepredvidivo.
                  Rešenje: `grid` sa fiksnim brojem kolona — svako polje dobija stvarno poznatu
                  širinu kolone bez obzira na širinu modala, isti princip kao svaka druga forma
                  fiksne širine u panelu (npr. `SearchCriteriaForm.tsx` `sm:grid-cols-2`). */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                <Field label="Destinacija (grad)">
                  <ClearableTextField name="destinationCity" defaultValue={filters.destinationCity ?? ''} placeholder="npr. Budva" className={inputClass} autoSubmit={false} />
                </Field>
                <Field label="Destinacija (država)">
                  <ClearableTextField name="destinationCountry" defaultValue={filters.destinationCountry ?? ''} placeholder="npr. Grčka" className={inputClass} autoSubmit={false} />
                </Field>
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

              <div className="flex items-end gap-2">
                <Field label="Kreirano od/do">
                  <ClearableDateRange nameFrom="createdFrom" nameTo="createdTo" defaultFrom={filters.createdFrom ?? ''} defaultTo={filters.createdTo ?? ''} className={inputClass} autoSubmit={false} />
                </Field>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <button type="submit" className="rounded bg-accent px-3 py-1.5 font-medium text-accent-ink hover:opacity-90">
                  pretraži
                </button>
                {hasAnyFilter && (
                  <Link href={`/rezervacije/kalendar?view=${view}&date=${date}`} className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
                    obriši filter
                  </Link>
                )}
                <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
                  otkaži
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
