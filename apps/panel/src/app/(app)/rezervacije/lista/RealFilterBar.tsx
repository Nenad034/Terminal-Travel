'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import RealFilterFields, { type FilterOption } from './RealFilterFields';
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
   * "Naziv hotela" na `rezervacije/kalendar/CalendarFilterBar.tsx`. */
  productName?: string;
  hasTravelGuarantee?: string;
  // Dopuna 6.9.2026 (vlasnikov zahtev — dodatni, sakriveni filteri) — vidi
  // `BookingsService.findAll` za tačan oslonac svakog u modelu podataka.
  branchId?: string;
  ownerId?: string;
  supplierId?: string;
  supplierType?: string;
  accommodationType?: string;
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
// Dopuna 6.9.2026 (vlasnikov zahtev: "neka ide brzo filtriranje kako se koje polje popunjava da
// se odmah filtrira po tome i na kraju ako bas treba da se klikne na dugme za iniciranje
// pretrage") — VAŽI SAD I ZA "prozor" (do sada je modal NAMERNO čekao ručni submit, isto
// obrazloženje kao `CalendarFilterBar.tsx`; vlasnik je eksplicitno tražio suprotno). Dugme
// "pretraži" ostaje kao dodatna, eksplicitna opcija ("na kraju ako baš treba"), ne zamenjuje
// auto-submit — ista `useAutoSubmitForm()` logika se sad koristi na OBA mesta (traka i prozor).
const TEXT_DEBOUNCE_MS = 600;

function useAutoSubmitForm() {
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

  return { formRef, handleFormChange };
}

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
    'branchId',
    'ownerId',
    'supplierId',
    'supplierType',
    'accommodationType',
  ];
  const hasValue = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : Boolean(v));
  let n = singleFields.filter((k) => hasValue(f[k] as string | string[] | undefined)).length;
  if (f.createdFrom || f.createdTo) n += 1;
  if (f.stayFrom || f.stayTo) n += 1;
  if (f.returnFrom || f.returnTo) n += 1;
  return n;
}

export default function RealFilterBar({
  filters,
  branches,
  employees,
  suppliers,
}: {
  filters: BookingFilters;
  branches: FilterOption[];
  employees: FilterOption[];
  suppliers: FilterOption[];
}) {
  const hasAnyFilter = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  const { mode } = useFilterMode();
  const [modalOpen, setModalOpen] = useState(false);
  const { formRef, handleFormChange } = useAutoSubmitForm();

  const activeCount = countActiveFilters(filters);

  if (mode === 'prozor') {
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
        {modalOpen && (
          <FilterModal filters={filters} branches={branches} employees={employees} suppliers={suppliers} onClose={() => setModalOpen(false)} />
        )}
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
      <RealFilterFields filters={filters} autoSubmit branches={branches} employees={employees} suppliers={suppliers} />
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

// Popup raspored (6.9.2026, vlasnikov zahtev, proširen istog dana: "prozor potrebi prosirite i
// povecajte visinu kako bi se sve videlo") — `max-w-3xl`/`max-h-[88vh]` zamenjeni širim/višim
// okvirom (`max-w-6xl`/`max-h-[92vh]`) da stane pun raspored kolona iz `RealFilterFields.tsx`
// (isti raspored kao traka, ne poseban grid). Auto-submit sad AKTIVAN i ovde (vidi napomenu
// uz `TEXT_DEBOUNCE_MS` iznad) — ista `useAutoSubmitForm()` logika kao traka.
function FilterModal({
  filters,
  branches,
  employees,
  suppliers,
  onClose,
}: {
  filters: BookingFilters;
  branches: FilterOption[];
  employees: FilterOption[];
  suppliers: FilterOption[];
  onClose: () => void;
}) {
  const { formRef, handleFormChange } = useAutoSubmitForm();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[4vh]" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-border bg-panel p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Filteri — Lista rezervacija</h2>
          <button type="button" onClick={onClose} title="Zatvori" className="text-ink-faint hover:text-ink">
            <Icon name="close" />
          </button>
        </div>
        <form ref={formRef} action="/rezervacije/lista" onChange={handleFormChange} className="flex flex-col gap-3 text-xs">
          <RealFilterFields filters={filters} autoSubmit branches={branches} employees={employees} suppliers={suppliers} />
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
