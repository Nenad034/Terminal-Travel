import Link from 'next/link';
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
export default function RealFilterBar({ filters }: { filters: BookingFilters }) {
  const hasAnyFilter = Object.values(filters).some((v) => v);

  return (
    <form action="/rezervacije/lista" className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-panel p-2 text-xs">
      {/* Dva reda, sva polja u redu iste širine (24.8.2026, na zahtev vlasnika: "polja za
          pretragu datuma neka idu u drugi red, ostala polja u prvi i neka sva polja budu iste
          sirine da se rasporede celom sirinom trake filtera") — `flex-1` na svakom polju u istom
          `flex` redu (bez `flex-wrap`) deli raspoloživu širinu podjednako, umesto da svako polje
          zauzme samo prirodnu širinu svog sadržaja. */}
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
        <button type="submit" className="rounded bg-panel2 px-3 py-1.5 font-medium text-ink hover:bg-border">
          filtriraj
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
      <span className="text-[10px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
