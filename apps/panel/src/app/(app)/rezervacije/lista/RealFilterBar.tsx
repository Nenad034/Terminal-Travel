import Link from 'next/link';

export interface BookingFilters {
  status?: string;
  paymentStatus?: string;
  tipNastupanja?: string;
  buyerName?: string;
  bookingNumber?: string;
  currency?: string;
  createdFrom?: string;
  createdTo?: string;
  stayFrom?: string;
  stayTo?: string;
  returnFrom?: string;
  returnTo?: string;
  productType?: string;
  destinationCity?: string;
  destinationCountry?: string;
  hasTravelGuarantee?: string;
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
    <form action="/rezervacije/lista" className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-panel p-2 text-xs">
      <Field label="Broj">
        <input name="bookingNumber" defaultValue={filters.bookingNumber ?? ''} placeholder="TT-2026-..." className={inputClass} />
      </Field>
      <Field label="Nosilac rezervacije">
        <input name="buyerName" defaultValue={filters.buyerName ?? ''} placeholder="ime/naziv" className={inputClass} />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={filters.status ?? ''} className={inputClass}>
          <option value="">svi</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Uplata">
        <select name="paymentStatus" defaultValue={filters.paymentStatus ?? ''} className={inputClass}>
          <option value="">sve</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tip nastupanja">
        <select name="tipNastupanja" defaultValue={filters.tipNastupanja ?? ''} className={inputClass}>
          <option value="">svi</option>
          {TIP_NASTUPANJA.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tip proizvoda">
        <select name="productType" defaultValue={filters.productType ?? ''} className={inputClass}>
          <option value="">svi</option>
          {PRODUCT_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Destinacija (grad)">
        <input name="destinationCity" defaultValue={filters.destinationCity ?? ''} placeholder="npr. Budva" className={inputClass} />
      </Field>
      <Field label="Destinacija (država)">
        <input name="destinationCountry" defaultValue={filters.destinationCountry ?? ''} placeholder="npr. Grčka" className={inputClass} />
      </Field>
      <Field label="Valuta">
        <input name="currency" defaultValue={filters.currency ?? ''} placeholder="EUR" className={inputClass} />
      </Field>
      <Field label="Garancija putovanja">
        <select name="hasTravelGuarantee" defaultValue={filters.hasTravelGuarantee ?? ''} className={inputClass}>
          <option value="">svejedno</option>
          <option value="true">ima</option>
          <option value="false">nema</option>
        </select>
      </Field>
      <Field label="Kreirano od/do">
        <div className="flex gap-1">
          <input type="date" name="createdFrom" defaultValue={filters.createdFrom ?? ''} className={inputClass} />
          <input type="date" name="createdTo" defaultValue={filters.createdTo ?? ''} className={inputClass} />
        </div>
      </Field>
      <Field label="Dolazak od/do">
        <div className="flex gap-1">
          <input type="date" name="stayFrom" defaultValue={filters.stayFrom ?? ''} className={inputClass} />
          <input type="date" name="stayTo" defaultValue={filters.stayTo ?? ''} className={inputClass} />
        </div>
      </Field>
      <Field label="Odlazak od/do">
        <div className="flex gap-1">
          <input type="date" name="returnFrom" defaultValue={filters.returnFrom ?? ''} className={inputClass} />
          <input type="date" name="returnTo" defaultValue={filters.returnTo ?? ''} className={inputClass} />
        </div>
      </Field>

      <button type="submit" className="rounded bg-panel2 px-3 py-1.5 font-medium text-ink hover:bg-border">
        filtriraj
      </button>
      {hasAnyFilter && (
        <Link href="/rezervacije/lista" className="rounded px-3 py-1.5 font-medium text-ink-faint hover:text-ink">
          obriši filter
        </Link>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
