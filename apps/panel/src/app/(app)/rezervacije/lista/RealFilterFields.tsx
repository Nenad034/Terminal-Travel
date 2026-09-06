'use client';

import { useState } from 'react';
import ClearableTextField from '@/components/ClearableTextField';
import ClearableDateRange from '@/components/ClearableDateRange';
import MultiSelectDropdown from '@/components/MultiSelectDropdown';
import type { BookingFilters } from './RealFilterBar';

// M5 spec dopuna (6.9.2026, vlasnikov zahtev uz snimak ekrana: "ukinite one tabove za kreirano
// od...do... i kod pretrage drzava mesto objekat i koristite ovo") — PONIŠTAVA v2.40/v2.41
// (K/D/O i Država/Mesto/Objekat kao toggle-pločice, `PeriodTogglePicker.tsx`/
// `LocationOrHotelField.tsx`, oba obrisana ovim prolazom): sva polja se vraćaju na OBIČNA,
// STALNO VIDLJIVA, ODVOJENA polja, raspoređena u kolone razdvojene tankom vertikalnom linijom
// (vlasnikov zahtev: "grupisanje polja... malo razdvojite nekom tankom vertikalnom linijom"),
// kolone popunjavaju CELU širinu prikaza (trake ili prozora — ISTI raspored u oba, "prozor" se
// samo uvećava da stane, ne dobija drugačiji layout).
//
// Dodatni filteri (Poslovnica/Zaposleni/Dobavljač/Vrsta dobavljača/Vrsta objekta — "Grupa
// objekta" NAMERNO izostavljena, vlasnikova odluka: "to vec imamo kao tip proizvoda") su
// STVARNI radni filteri (ne samo vizuelni) — vidi `BookingsService.findAll` dopunu istog dana:
// Poslovnica → `Booking.branchId` (M1 spec dopuna, snapshot iz zaposlenog), Zaposleni →
// `Booking.ownerId`, Dobavljač/Vrsta dobavljača → `BookingItem.product.(sourceContract.)supplier`,
// Vrsta objekta → `Product.attributes.accommodation_type` (M2 §2.3). Sakriveni iza linka da ne
// zagušuju uvek-vidljiv skup — retko se koriste u odnosu na gornjih pet grupa.
const STATUSES = ['PENDING_SUPPLIER_CONFIRMATION', 'CONFIRMED', 'MODIFIED', 'CANCELLED', 'COMPLETED'];
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'INVOICE_PENDING'];
const TIP_NASTUPANJA = ['ORGANIZATOR', 'POSREDNIK'];
const PRODUCT_TYPES = ['ACCOMMODATION', 'PACKAGE', 'TRANSFER', 'EXCURSION', 'FLIGHT', 'INSURANCE', 'TRANSPORT', 'TICKET', 'EVENT', 'CRUISE'];
const SUPPLIER_TYPES = ['HOTEL', 'PREVOZNIK', 'OSIGURAVAC', 'DRUGO'];
const ACCOMMODATION_TYPES = ['HOTEL', 'VILA', 'APARTMAN', 'HOSTEL', 'KAMP', 'KABINA_NA_BRODU', 'DRUGO'];

const inputClass = 'input text-xs w-full';

export interface FilterOption {
  id: string;
  name: string;
}

export default function RealFilterFields({
  filters,
  autoSubmit,
  branches,
  employees,
  suppliers,
}: {
  filters: BookingFilters;
  autoSubmit: boolean;
  branches: FilterOption[];
  employees: FilterOption[];
  suppliers: FilterOption[];
}) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Columns>
        <Column>
          <Field label="Broj">
            <ClearableTextField name="bookingNumber" defaultValue={filters.bookingNumber ?? ''} placeholder="TT-2026-..." className={inputClass} autoSubmit={autoSubmit} />
          </Field>
          <Field label="Nosilac rezervacije">
            <ClearableTextField name="buyerName" defaultValue={filters.buyerName ?? ''} placeholder="ime/naziv" className={inputClass} autoSubmit={autoSubmit} />
          </Field>
          <MultiSelectDropdown name="status" label="Status" options={STATUSES.map((s) => ({ value: s, label: s }))} defaultValues={toArray(filters.status)} autoSubmit={autoSubmit} />
        </Column>
        <Column>
          <Field label="Država">
            <ClearableTextField name="destinationCountry" defaultValue={filters.destinationCountry ?? ''} placeholder="npr. Grčka" className={inputClass} autoSubmit={autoSubmit} />
          </Field>
          <Field label="Mesto">
            <ClearableTextField name="destinationCity" defaultValue={filters.destinationCity ?? ''} placeholder="npr. Budva" className={inputClass} autoSubmit={autoSubmit} />
          </Field>
          <Field label="Hotel">
            <ClearableTextField name="productName" defaultValue={filters.productName ?? ''} placeholder="naziv hotela" className={inputClass} autoSubmit={autoSubmit} />
          </Field>
        </Column>
        <Column>
          <Field label="Kreirano od...do">
            <ClearableDateRange nameFrom="createdFrom" nameTo="createdTo" defaultFrom={filters.createdFrom ?? ''} defaultTo={filters.createdTo ?? ''} className={inputClass} autoSubmit={autoSubmit} />
          </Field>
          <Field label="Dolazak od...do">
            <ClearableDateRange nameFrom="stayFrom" nameTo="stayTo" defaultFrom={filters.stayFrom ?? ''} defaultTo={filters.stayTo ?? ''} className={inputClass} autoSubmit={autoSubmit} />
          </Field>
          <Field label="Odlazak od...do">
            <ClearableDateRange nameFrom="returnFrom" nameTo="returnTo" defaultFrom={filters.returnFrom ?? ''} defaultTo={filters.returnTo ?? ''} className={inputClass} autoSubmit={autoSubmit} />
          </Field>
        </Column>
        <Column>
          <MultiSelectDropdown
            name="paymentStatus"
            label="Uplata"
            options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))}
            defaultValues={toArray(filters.paymentStatus)}
            autoSubmit={autoSubmit}
          />
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
        </Column>
        <Column>
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
        </Column>
      </Columns>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="self-start text-[11px] font-medium text-accent-strong hover:underline"
      >
        {showMore ? 'sakrij dodatne filtere' : 'dodatni filteri'}
      </button>

      {showMore && (
        <Columns>
          <Column>
            <Field label="Poslovnica">
              <select name="branchId" defaultValue={filters.branchId ?? ''} className={inputClass}>
                <option value="">sve</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Zaposleni">
              <select name="ownerId" defaultValue={filters.ownerId ?? ''} className={inputClass}>
                <option value="">svi</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
          </Column>
          <Column>
            <Field label="Vrsta objekta">
              <select name="accommodationType" defaultValue={filters.accommodationType ?? ''} className={inputClass}>
                <option value="">sve</option>
                {ACCOMMODATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </Column>
          <Column>
            <Field label="Dobavljač">
              <select name="supplierId" defaultValue={filters.supplierId ?? ''} className={inputClass}>
                <option value="">svi</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vrsta dobavljača">
              <select name="supplierType" defaultValue={filters.supplierType ?? ''} className={inputClass}>
                <option value="">sve</option>
                {SUPPLIER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </Column>
        </Columns>
      )}
    </div>
  );
}

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// Kolone razdvojene tankom vertikalnom linijom, popunjavaju celu širinu (6.9.2026, vlasnikov
// zahtev) — `divide-x` iscrtava liniju IZMEĐU dece bez posebne logike za prvu/poslednju kolonu.
function Columns({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full items-start divide-x divide-border">{children}</div>;
}

function Column({ children }: { children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 first:pl-0 last:pr-0">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
