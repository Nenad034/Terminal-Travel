'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import RealFilterFields from './RealFilterFields';
import { useFilterMode } from './FilterModeContext';

// Multiselect (24.8.2026, na zahtev vlasnika: "u svakom polju filtera gde je to moguce
// multiselect opciju") — polja koja su kategorička (konačan, mali skup vrednosti) prihvataju
// niz. Next.js `searchParams` daje `string[]` kad je query parametar ponovljen (`?status=A&
// status=B`), `string` kad je prisutan jednom — oba oblika se prihvataju, normalizuju u
// `toArray()` u `RealFilterFields.tsx` pre slanja API-ju. Slobodan tekst/datumi/valuta/tri-state
// garancija NAMERNO ostaju jednostruki — "gde je to moguce" isključuje ih (videti M5 spec v1.59).
export interface BookingFilters {
  status?: string | string[];
  paymentStatus?: string | string[];
  tipNastupanja?: string | string[];
  buyerName?: string;
  bookingNumber?: string;
  currency?: string;
  createdFrom?: string;
  createdTo?: string;
  stayFrom?: string;
  stayTo?: string;
  returnFrom?: string;
  returnTo?: string;
  productType?: string | string[];
  destinationCity?: string;
  destinationCountry?: string;
  /** Naziv hotela (6.9.2026 dopuna) — isti `GET /sales/bookings` parametar koji već koristi
   * "Naziv hotela" na `rezervacije/kalendar/CalendarFilterBar.tsx`; ovde deli JEDNO polje sa
   * `destinationCountry`/`destinationCity` preko `LocationOrHotelField.tsx` (vlasnikov zahtev:
   * "Polja za filtriranje Drzave, destinacije i hotela stavite da bude jedno"). */
  productName?: string;
  hasTravelGuarantee?: string;
}

// M5 spec v1.54 — obična GET forma, isti obrazac kao `/marketing`/`/podrska`/`/b2b/rabati`
// (`?status=...`). Svako polje ovde odgovara STVARNOM `GET /sales/bookings` query parametru
// (poglavlje 11) — nema dekorativnih/mock filtera ovde, ti ostaju u `FiltersModal` unutar
// `RealBookingsTable.tsx`.
// Automatska primena filtera (24.8.2026, na zahtev vlasnika: "da li moze da se podesi da kako
// se koji filter odabira da se odmah vrsi selekcija u listi rezervacija, kako bi se ubrzale
// stvari") — forma ostaje ISTA nativna GET forma (M5 spec §11/v1.54), samo se `requestSubmit()`
// sad poziva automatski umesto da čeka klik na "filtriraj". Delegovan `onChange` na samoj
// `<form>` (React sintetički event bubbling) hvata SVAKU promenu unutar nje na jednom mestu —
// diskretni kontrolni elementi (checkbox/select/datum) primenjuju odmah, tekstualna polja
// (kucanje) čekaju kratku pauzu (debounce) da se ne pokreće cela navigacija na svaki taster.
const TEXT_DEBOUNCE_MS = 600;

// Tri izgleda (6.9.2026, vlasnikov zahtev: "omoguci dva izgleda modula kako je sada i onaj popup
// u kom bolje rasporedite polja..."; dopunjeno isti dan — "dodamo i mogucnost prikaza filtera po
// defoltu za svaki modul, u levom panelu... Ja volim da dam korisnicima izbor pa neka bude da
// dodamo to trece mesto... pa neka biraju od tri resenja") — korisnikov izbor, ne automatska
// zamena; pamti se po pregledaču. "Ladica" deli isti sadržaj/obrazac kao "prozor"
// (`FilterModal`/`FilterDrawer` ispod su skoro identični — razlikuju se samo pozicijom/oblikom
// omotača), namerno NIJE trajno prikovana uz levu ivicu. Sâmo STANJE (koje polje je aktivno) i
// prekidač koji ga menja žive u `FilterModeContext.tsx`/`FilterModeToggle.tsx` — premešteno u red
// sa naslovom stranice (6.9.2026, vlasnikov zahtev: "traka prozor levi panel staviti u liniji sa
// naslovom taba iznad brzih [ikonica] u desnom kraju"), ovaj fajl samo ČITA `mode` preko
// `useFilterMode()`, više ga ne prikazuje ni ne menja sam.
function countActiveFilters(f: BookingFilters): number {
  // "Kreirano od/do", "Dolazak od/do", "Odlazak od/do" broje se kao PO JEDAN kriterijum (ne dva)
  // — isti princip kao `CalendarFilterBar.tsx` `countActiveCriteria`.
  const singleFields: (keyof BookingFilters)[] = [
    'bookingNumber',
    'buyerName',
    'status',
    'paymentStatus',
    'tipNastupanja',
    'productType',
    'destinationCity',
    'destinationCountry',
    'productName',
    'currency',
    'hasTravelGuarantee',
  ];
  const hasValue = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : Boolean(v));
  let n = singleFields.filter((k) => hasValue(f[k] as string | string[] | undefined)).length;
  if (f.createdFrom || f.createdTo) n += 1;
  if (f.stayFrom || f.stayTo) n += 1;
  if (f.returnFrom || f.returnTo) n += 1;
  return n;
}

export default function RealFilterBar({ filters }: { filters: BookingFilters }) {
  const hasAnyFilter = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  const { mode } = useFilterMode();
  const [modalOpen, setModalOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleFormChange(e: React.ChangeEvent<HTMLFormElement>) {
    const target = e.target as unknown as HTMLInputElement;
    const isTypedText = target.tagName === 'INPUT' && target.type === 'text';
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isTypedText) {
      debounceRef.current = setTimeout(() => formRef.current?.requestSubmit(), TEXT_DEBOUNCE_MS);
    } else {
      formRef.current?.requestSubmit();
    }
  }

  const activeCount = countActiveFilters(filters);

  if (mode === 'prozor' || mode === 'ladica') {
    return (
      <div className="mb-3 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${
            hasAnyFilter ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-ink-dim hover:border-accent hover:text-ink'
          }`}
        >
          <Icon name="filter" className="!text-[13px]" />
          Filteri{hasAnyFilter ? ` · ${activeCount} ${activeCount === 1 ? 'kriterijum' : 'kriterijuma'}` : ''}
        </button>
        {hasAnyFilter && (
          <Link href="/rezervacije/lista" className="font-medium text-ink-faint hover:text-danger">
            obriši filter
          </Link>
        )}
        {modalOpen && mode === 'prozor' && <FilterModal filters={filters} onClose={() => setModalOpen(false)} />}
        {modalOpen && mode === 'ladica' && <FilterDrawer filters={filters} onClose={() => setModalOpen(false)} />}
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action="/rezervacije/lista"
      onChange={handleFormChange}
      className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-panel p-2 text-xs"
    >
      {/* Dva reda, sva polja u redu iste širine (24.8.2026, na zahtev vlasnika: "polja za
          pretragu datuma neka idu u drugi red, ostala polja u prvi i neka sva polja budu iste
          sirine da se rasporede celom sirinom trake filtera") — `flex-1` na svakom polju u istom
          `flex` redu (bez `flex-wrap`) deli raspoloživu širinu podjednako, umesto da svako polje
          zauzme samo prirodnu širinu svog sadržaja.
          Napomena 27.8.2026: brzi period Dan/Nedelja/Mesec (`PeriodQuickFilter.tsx`) NIJE ovde —
          vlasnik je pojasnio da je mislio na traku ikonica koja je UVEK vidljiva
          (`BookingsListClient.tsx`, sticky), ne na ovu formu koja se može sakriti dugmetom −/+. */}
      <RealFilterFields filters={filters} autoSubmit layout="bar" />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          title="Filtriraj"
          className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded bg-brand text-brand-ink hover:brightness-90"
        >
          <Icon name="play" />
        </button>
        {hasAnyFilter && (
          <Link href="/rezervacije/lista" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
            obriši filter
          </Link>
        )}
      </div>
    </form>
  );
}

// Popup raspored (6.9.2026, vlasnikov zahtev) — isti obrazac kao `CalendarFilterBar.tsx`
// "Detaljna pretraga": SOPSTVENA forma, BEZ auto-submit na promenu (namerno — isti razlog kao
// tamo: momentalno filtriranje bi zatvorilo/prekinulo popunjavanje pre nego što korisnik završi
// sva polja), primenjuje se isključivo na "pretraži"/submit. `layout="grid"` u
// `RealFilterFields.tsx` raspoređuje polja u više kolona (2→3→4 zavisno od širine), umesto
// jednog dugačkog reda koji se na laptopu/tabletu gužva ili vodoravno skroluje.
function FilterModal({ filters, onClose }: { filters: BookingFilters; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[6vh]" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-panel p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Filteri — Lista rezervacija</h2>
          <button type="button" onClick={onClose} title="Zatvori" className="text-ink-faint hover:text-ink">
            <Icon name="close" />
          </button>
        </div>
        <form action="/rezervacije/lista" className="flex flex-col gap-3 text-xs">
          <RealFilterFields filters={filters} autoSubmit={false} layout="grid" />
          <div className="mt-1 flex items-center gap-2 border-t border-border pt-3">
            <button
              type="submit"
              title="Pretraži"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-brand text-brand-ink hover:brightness-90"
            >
              <Icon name="play" />
            </button>
            <Link href="/rezervacije/lista" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              obriši filter
            </Link>
            <button type="button" onClick={onClose} className="ml-auto rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              otkaži
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Levi panel (6.9.2026, vlasnikov zahtev: "dodamo i mogucnost prikaza filtera... u levom
// panelu... da ne bude kako udjemo u neki modul da pretraga bude na drugom mestu") — isti sadržaj
// i obrazac kao `FilterModal` iznad (sopstvena forma, `autoSubmit={false}`, `layout="drawer"` —
// JEDNA kolona jer je ladica uža od centriranog modala), samo omotač otvara sa LEVE ivice ekrana
// umesto centriranog preklopa — dosledno mesto na svakom modulu koji ovaj obrazac usvoji, bez
// obzira na širinu ekrana na kom se radi (vlasnikov razlog za treću opciju).
function FilterDrawer({ filters, onClose }: { filters: BookingFilters; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-[340px] flex-col overflow-y-auto border-r border-border bg-panel p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Filteri — Lista rezervacija</h2>
          <button type="button" onClick={onClose} title="Zatvori" className="text-ink-faint hover:text-ink">
            <Icon name="close" />
          </button>
        </div>
        <form action="/rezervacije/lista" className="flex flex-1 flex-col gap-3 text-xs">
          <RealFilterFields filters={filters} autoSubmit={false} layout="drawer" />
          <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
            <button
              type="submit"
              title="Pretraži"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-brand text-brand-ink hover:brightness-90"
            >
              <Icon name="play" />
            </button>
            <Link href="/rezervacije/lista" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              obriši filter
            </Link>
            <button type="button" onClick={onClose} className="ml-auto rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
              otkaži
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
