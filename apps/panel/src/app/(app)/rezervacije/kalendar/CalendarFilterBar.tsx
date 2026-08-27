'use client';

import { useRef } from 'react';
import Link from 'next/link';
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
const STATUSES = ['PENDING_SUPPLIER_CONFIRMATION', 'CONFIRMED', 'MODIFIED', 'CANCELLED', 'COMPLETED'];
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'INVOICE_PENDING'];
const TIP_NASTUPANJA = ['ORGANIZATOR', 'POSREDNIK'];
const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT', 'CRUISE'];

const inputClass = 'input text-xs';
const TEXT_DEBOUNCE_MS = 600;

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export default function CalendarFilterBar({ view, date, filters }: { view: CalendarView; date: string; filters: CalendarFiltersShape }) {
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
    <form ref={formRef} action="/rezervacije/kalendar" onChange={handleFormChange} className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-panel p-2 text-xs">
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="date" value={date} />
      <div className="flex flex-wrap items-end gap-2">
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
        <Field label="Kreirano od/do">
          <ClearableDateRange nameFrom="createdFrom" nameTo="createdTo" defaultFrom={filters.createdFrom ?? ''} defaultTo={filters.createdTo ?? ''} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="rounded bg-panel2 px-3 py-1.5 font-medium text-ink hover:bg-border">
          filtriraj
        </button>
        {hasAnyFilter && (
          <Link href={`/rezervacije/kalendar?view=${view}&date=${date}`} className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
            obriši filter
          </Link>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-0.5">
      <span className="text-xs text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
