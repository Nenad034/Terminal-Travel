'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import MultiSelectDropdown from '@/components/MultiSelectDropdown';
import ClearableTextField from '@/components/ClearableTextField';
import ClearableDateRange from '@/components/ClearableDateRange';

// Multiselect (24.8.2026, na zahtev vlasnika: "u svakom polju filtera gde je to moguce
// multiselect opciju") — polja koja su kategorička (konačan, mali skup vrednosti) prihvataju
// niz. Next.js `searchParams` daje `string[]` kad je query parametar ponovljen (`?status=A&
// status=B`), `string` kad je prisutan jednom — oba oblika se prihvataju, normalizuju u
// `toArray()` ispod pre slanja API-ju. Slobodan tekst/datumi/valuta/tri-state garancija
// NAMERNO ostaju jednostruki — "gde je to moguce" isključuje ih (videti M5 spec v1.59).
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
  hasTravelGuarantee?: string;
}

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

const STATUSES = ['PENDING_SUPPLIER_CONFIRMATION', 'CONFIRMED', 'MODIFIED', 'CANCELLED', 'COMPLETED'];
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'INVOICE_PENDING'];
const TIP_NASTUPANJA = ['ORGANIZATOR', 'POSREDNIK'];
const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT', 'CRUISE'];

const inputClass = 'input text-xs';

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

export default function RealFilterBar({ filters }: { filters: BookingFilters }) {
  const hasAnyFilter = Object.values(filters).some((v) => v);
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

  return (
    <form ref={formRef} action="/rezervacije/lista" onChange={handleFormChange} className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-panel p-2 text-xs">
      {/* Dva reda, sva polja u redu iste širine (24.8.2026, na zahtev vlasnika: "polja za
          pretragu datuma neka idu u drugi red, ostala polja u prvi i neka sva polja budu iste
          sirine da se rasporede celom sirinom trake filtera") — `flex-1` na svakom polju u istom
          `flex` redu (bez `flex-wrap`) deli raspoloživu širinu podjednako, umesto da svako polje
          zauzme samo prirodnu širinu svog sadržaja.
          Napomena 27.8.2026: brzi period Dan/Nedelja/Mesec (`PeriodQuickFilter.tsx`) NIJE ovde —
          vlasnik je pojasnio da je mislio na traku ikonica koja je UVEK vidljiva
          (`BookingsListClient.tsx`, sticky), ne na ovu formu koja se može sakriti dugmetom −/+. */}
      <div className="flex items-end gap-2">
        <Field label="Broj">
          <ClearableTextField name="bookingNumber" defaultValue={filters.bookingNumber ?? ''} placeholder="TT-2026-..." className={inputClass} />
        </Field>
        <Field label="Nosilac rezervacije">
          <ClearableTextField name="buyerName" defaultValue={filters.buyerName ?? ''} placeholder="ime/naziv" className={inputClass} />
        </Field>
        <MultiSelectDropdown name="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.status)} />
        <MultiSelectDropdown name="paymentStatus" label="Uplata" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.paymentStatus)} />
        <MultiSelectDropdown name="tipNastupanja" label="Tip nastupanja" options={TIP_NASTUPANJA.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.tipNastupanja)} />
        <MultiSelectDropdown name="productType" label="Tip proizvoda" options={PRODUCT_TYPES.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.productType)} />
        <Field label="Destinacija (grad)">
          <ClearableTextField name="destinationCity" defaultValue={filters.destinationCity ?? ''} placeholder="npr. Budva" className={inputClass} />
        </Field>
        <Field label="Destinacija (država)">
          <ClearableTextField name="destinationCountry" defaultValue={filters.destinationCountry ?? ''} placeholder="npr. Grčka" className={inputClass} />
        </Field>
        <Field label="Valuta">
          <ClearableTextField name="currency" defaultValue={filters.currency ?? ''} placeholder="EUR" className={inputClass} />
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
          <ClearableDateRange nameFrom="createdFrom" nameTo="createdTo" defaultFrom={filters.createdFrom ?? ''} defaultTo={filters.createdTo ?? ''} className={inputClass} />
        </Field>
        <Field label="Dolazak od/do">
          <ClearableDateRange nameFrom="stayFrom" nameTo="stayTo" defaultFrom={filters.stayFrom ?? ''} defaultTo={filters.stayTo ?? ''} className={inputClass} />
        </Field>
        <Field label="Odlazak od/do">
          <ClearableDateRange nameFrom="returnFrom" nameTo="returnTo" defaultFrom={filters.returnFrom ?? ''} defaultTo={filters.returnTo ?? ''} className={inputClass} />
        </Field>
      </div>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 min-w-0 flex-col gap-0.5">
      <span className="text-xs text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
