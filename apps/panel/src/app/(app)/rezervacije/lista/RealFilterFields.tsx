'use client';

import ClearableTextField from '@/components/ClearableTextField';
import ClearableDateRange from '@/components/ClearableDateRange';
import MultiSelectDropdown from '@/components/MultiSelectDropdown';
import LocationOrHotelField from './LocationOrHotelField';
import type { BookingFilters } from './RealFilterBar';

// Deljen skup polja između DVA prikaza filtera (6.9.2026, vlasnikov zahtev: "omoguci dva izgleda
// modula kako je sada i onaj popup u kom bolje rasporedite polja... posebno na laptopovima i
// tabletima") — `RealFilterBar.tsx` renderuje ovo ILI direktno u traci (`layout="bar"`, `flex`
// red, nepromenjeno ponašanje) ILI unutar modala (`layout="grid"`, CSS grid koji se lomi u više
// kolona kad ima mesta — bolje iskorišćava širinu na laptopu/tabletu nego jedan dugačak red).
// `autoSubmit` prosleđen do svakog polja — modal NAMERNO ne šalje formu na svaku promenu (isti
// razlog kao `CalendarFilterBar.tsx`: "momentalno filtriranje... svaki put treba da se ponovo
// otvori modal"), traka i dalje šalje odmah (RealFilterBar.tsx forma nosi `onChange`).
const STATUSES = ['PENDING_SUPPLIER_CONFIRMATION', 'CONFIRMED', 'MODIFIED', 'CANCELLED', 'COMPLETED'];
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'INVOICE_PENDING'];
const TIP_NASTUPANJA = ['ORGANIZATOR', 'POSREDNIK'];
const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT', 'CRUISE'];

const inputClass = 'input text-xs';

export default function RealFilterFields({
  filters,
  autoSubmit,
  layout,
}: {
  filters: BookingFilters;
  autoSubmit: boolean;
  layout: 'bar' | 'grid';
}) {
  const rowClass = layout === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' : 'flex items-end gap-2';
  const dateRowClass = layout === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-3' : 'flex items-end gap-2';

  return (
    <>
      <div className={rowClass}>
        <Field label="Broj">
          <ClearableTextField name="bookingNumber" defaultValue={filters.bookingNumber ?? ''} placeholder="TT-2026-..." className={inputClass} autoSubmit={autoSubmit} />
        </Field>
        <Field label="Nosilac rezervacije">
          <ClearableTextField name="buyerName" defaultValue={filters.buyerName ?? ''} placeholder="ime/naziv" className={inputClass} autoSubmit={autoSubmit} />
        </Field>
        <MultiSelectDropdown name="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.status)} autoSubmit={autoSubmit} />
        <MultiSelectDropdown
          name="paymentStatus"
          label="Uplata"
          options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))}
          defaultValues={toArray(filters.paymentStatus)}
          autoSubmit={autoSubmit}
        />
        <MultiSelectDropdown
          name="tipNastupanja"
          label="Tip nastupanja"
          options={TIP_NASTUPANJA.map((s) => ({ value: s, label: s }))}
          defaultValues={toArray(filters.tipNastupanja)}
          autoSubmit={autoSubmit}
        />
        <MultiSelectDropdown
          name="productType"
          label="Tip proizvoda"
          options={PRODUCT_TYPES.map((s) => ({ value: s, label: s }))}
          defaultValues={toArray(filters.productType)}
          autoSubmit={autoSubmit}
        />
        <LocationOrHotelField filters={filters} autoSubmit={autoSubmit} />
        <Field label="Valuta">
          <ClearableTextField name="currency" defaultValue={filters.currency ?? ''} placeholder="EUR" className={inputClass} autoSubmit={autoSubmit} />
        </Field>
        <Field label="Garancija putovanja">
          <select name="hasTravelGuarantee" defaultValue={filters.hasTravelGuarantee ?? ''} className={inputClass}>
            <option value="">svejedno</option>
            <option value="true">ima</option>
            <option value="false">nema</option>
          </select>
        </Field>
      </div>

      <div className={dateRowClass}>
        <Field label="Kreirano od/do">
          <ClearableDateRange
            nameFrom="createdFrom"
            nameTo="createdTo"
            defaultFrom={filters.createdFrom ?? ''}
            defaultTo={filters.createdTo ?? ''}
            className={inputClass}
            autoSubmit={autoSubmit}
          />
        </Field>
        <Field label="Dolazak od/do">
          <ClearableDateRange
            nameFrom="stayFrom"
            nameTo="stayTo"
            defaultFrom={filters.stayFrom ?? ''}
            defaultTo={filters.stayTo ?? ''}
            className={inputClass}
            autoSubmit={autoSubmit}
          />
        </Field>
        <Field label="Odlazak od/do">
          <ClearableDateRange
            nameFrom="returnFrom"
            nameTo="returnTo"
            defaultFrom={filters.returnFrom ?? ''}
            defaultTo={filters.returnTo ?? ''}
            className={inputClass}
            autoSubmit={autoSubmit}
          />
        </Field>
      </div>
    </>
  );
}

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 min-w-0 flex-col gap-0.5">
      <span className="text-xs text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
