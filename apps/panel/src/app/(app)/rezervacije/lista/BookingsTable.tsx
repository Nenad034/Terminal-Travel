'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import BookingTimelineModal from '@/components/BookingTimelineModal';
import { useRowSummary } from '@/components/RowSummaryContext';
import { useTabs } from '@/components/TabsContext';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { buildMockTimeline, type MockBookingRow } from './mock-data';
import FiltersModal, { type ExtraFilters } from './FiltersModal';
import UrgentModal from './UrgentModal';
import ExportButton from './ExportButton';

function StatusBadge({ label }: { label: string }) {
  const tone = ['CONFIRMED', 'COMPLETED'].includes(label)
    ? 'text-ok bg-ok-bg'
    : label === 'CANCELLED'
      ? 'text-danger bg-danger-bg'
      : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function PaymentBadge({ label }: { label: string }) {
  const tone = label === 'PAID' ? 'text-ok bg-ok-bg' : label === 'UNPAID' ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function formatAmount(amount: number): string {
  return (amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sr-RS');
}

type TextColumnKey = 'bookingNumber' | 'buyerName' | 'channel' | 'status' | 'paymentStatus';
type DateColumnKey = 'stayFrom' | 'stayTo' | 'createdAt';
export type ColumnKey = TextColumnKey | DateColumnKey;
type SortKey = ColumnKey | 'totalPrice';

const DATE_COLUMNS: DateColumnKey[] = ['stayFrom', 'stayTo', 'createdAt'];

// Sortiranje po koloni (23.8.2026, na zahtev vlasnika: "uvedite sortiranje po logici stvari") —
// za Status/Uplatu NIJE azbučni redosled nego redosled po TOKU rezervacije/naplate (šta prvo
// traži pažnju), isti princip po kom UrgentModal/zvonce već ističu nerešene stavke. Ostale kolone
// imaju prirodan redosled (datum hronološki, iznos brojčano, tekst azbučno).
const STATUS_ORDER: Record<MockBookingRow['status'], number> = {
  PENDING_SUPPLIER_CONFIRMATION: 0,
  MODIFIED: 1,
  CONFIRMED: 2,
  COMPLETED: 3,
  CANCELLED: 4,
};
const PAYMENT_ORDER: Record<MockBookingRow['paymentStatus'], number> = {
  UNPAID: 0,
  INVOICE_PENDING: 1,
  PARTIALLY_PAID: 2,
  PAID: 3,
};

function compareBookings(a: MockBookingRow, b: MockBookingRow, key: SortKey): number {
  switch (key) {
    case 'stayFrom':
    case 'stayTo':
    case 'createdAt':
      return new Date(a[key]).getTime() - new Date(b[key]).getTime();
    case 'totalPrice':
      return a.totalPrice - b.totalPrice;
    case 'status':
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case 'paymentStatus':
      return PAYMENT_ORDER[a.paymentStatus] - PAYMENT_ORDER[b.paymentStatus];
    default:
      return String(a[key]).localeCompare(String(b[key]), 'sr-RS');
  }
}

// Dopuna (23.8.2026, na zahtev vlasnika: "01/06/2026...10/06/2026") — opseg datuma, DD/MM/GGGG,
// razdvojen sa "...". Nepotpun/neispravan unos (dok korisnik još kuca) NE filtrira ništa —
// bolje prikazati sve nego naglo isprazniti tabelu na svaki otkucan znak.
function parseDDMMYYYY(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesDateRange(iso: string, filterText: string): boolean {
  const raw = filterText.trim();
  if (!raw) return true;
  const [fromPart, toPart] = raw.split('...').map((p) => p.trim());
  const from = parseDDMMYYYY(fromPart);
  if (!from) return true;
  const to = toPart !== undefined ? parseDDMMYYYY(toPart) : from;
  const target = to ?? from;
  const rangeStart = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0);
  const rangeEnd = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999);
  const value = new Date(iso);
  return value >= rangeStart && value <= rangeEnd;
}

// Dopuna (23.8.2026, na zahtev vlasnika: "Omogucite pretragu po kolonama. Odmah ispod naziva
// kolone staviti filter za pretragu") — pravo, funkcionalno filtriranje NAD mock nizom (ne
// mock samo po sebi) — otud zaseban klijentski komponent umesto proširenja server komponente
// (`page.tsx`), koja ostaje čist wrapper. Tekstualne kolone: "sadrži" (case-insensitive).
// Datumske kolone (Dolazak/Odlazak/Kreirano, isti dan, dopuna): opseg DD/MM/GGGG...DD/MM/GGGG.
// Sve aktivne kolone se AND-uju.
const EMPTY_EXTRA_FILTERS: ExtraFilters = { branch: '', assignedUser: '', supplierName: '', partnerName: '' };

export default function BookingsTable({ bookings }: { bookings: MockBookingRow[] }) {
  const [filters, setFilters] = useState<Record<ColumnKey, string>>({
    bookingNumber: '',
    buyerName: '',
    channel: '',
    status: '',
    paymentStatus: '',
    stayFrom: '',
    stayTo: '',
    createdAt: '',
  });
  const [timelineFor, setTimelineFor] = useState<MockBookingRow | null>(null);
  const [urgentFor, setUrgentFor] = useState<MockBookingRow | null>(null);
  // Brzi filter po vrsti aranžmana (23.8.2026, na zahtev vlasnika: "Prva ikona ispred ove dve
  // treba da bude ikona iz pretraga koja u stvari govori o kom turistickom aranzmanu se radi.
  // Omoguciti pretragu i po tome. Staviti sve ikone oz pretrage horizontalno iznad liste") —
  // isti `PRODUCT_ICONS` katalog kao vođena pretraga (`lib/search-product-types.ts`), klik
  // bira/poništava (jedan aktivan odjednom — dovoljno za "koji tip", ne višestruki izbor ovde).
  const [productTypeFilter, setProductTypeFilter] = useState<string | null>(null);
  // Filter za zvonce (23.8.2026, na zahtev vlasnika: "Postaviti filter i za zvonce. Prvi klik
  // filtrira, drugi klik ne filtrira") — prost toggle, ne treći/četvrti stepen.
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [extraFilters, setExtraFilters] = useState<ExtraFilters>(EMPTY_EXTRA_FILTERS);
  // Sortiranje (23.8.2026) — klik na zaglavlje: prvi klik rastuće, drugi opadajuće, treći
  // isključuje sortiranje. Podrazumevano bez sortiranja (redosled iz mock-data.ts, kasnije API).
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortKey(null);
  }

  const { showSummary } = useRowSummary();
  const { openTab } = useTabs();

  // "Pun zapis" (23.8.2026, na zahtev vlasnika, dizajn dok. §5b) — klik na broj rezervacije
  // otvara nov app-tab sa punim zapisom (ne samo sažetak u desnom panelu, koji ostaje na klik
  // bilo gde drugde na redu). `e.stopPropagation()` sprečava da isti klik i otvori sažetak.
  function openFullRecord(e: React.MouseEvent, b: MockBookingRow) {
    e.stopPropagation();
    openTab(`/rezervacije/lista/${b.bookingNumber}`, b.bookingNumber);
  }

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (urgentOnly && !b.urgent) return false;
      if (productTypeFilter && b.productType !== productTypeFilter) return false;
      if (extraFilters.branch.trim() && !b.branch.toLowerCase().includes(extraFilters.branch.trim().toLowerCase())) return false;
      if (extraFilters.assignedUser.trim() && !b.assignedUser.toLowerCase().includes(extraFilters.assignedUser.trim().toLowerCase())) return false;
      if (extraFilters.supplierName.trim() && !b.supplierName.toLowerCase().includes(extraFilters.supplierName.trim().toLowerCase())) return false;
      if (extraFilters.partnerName.trim() && !(b.partnerName ?? '').toLowerCase().includes(extraFilters.partnerName.trim().toLowerCase())) return false;
      return (Object.keys(filters) as ColumnKey[]).every((key) => {
        const value = filters[key];
        if (!value.trim()) return true;
        if ((DATE_COLUMNS as string[]).includes(key)) return matchesDateRange(b[key as DateColumnKey], value);
        const needle = value.trim().toLowerCase();
        // "Nosilac rezervacije" pretraga sad TAKOĐE pokriva državu/destinaciju/hotel (23.8.2026,
        // na zahtev vlasnika: "Omogucite u pretrazi po kolonama da se i po ovim pojmovima
        // pretrazuje") — prikazani su kao pod-red ispod naziva nosioca, ne kao sopstvena kolona,
        // pa isti filter obuhvata sve što se tu vidi umesto da se doda još jedno polje.
        if (key === 'buyerName') {
          return [b.buyerName, b.country, b.destinationCity, b.hotelName].some((v) => v.toLowerCase().includes(needle));
        }
        return String(b[key as TextColumnKey]).toLowerCase().includes(needle);
      });
    });
  }, [bookings, filters, urgentOnly, productTypeFilter, extraFilters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => dir * compareBookings(a, b, sortKey));
  }, [filtered, sortKey, sortDir]);

  function setFilter(key: ColumnKey, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function openSummary(b: MockBookingRow) {
    showSummary({
      kind: 'booking',
      bookingNumber: b.bookingNumber,
      buyerName: b.buyerName,
      status: b.status,
      paymentStatus: b.paymentStatus,
      stayFrom: b.stayFrom,
      stayTo: b.stayTo,
      totalPrice: b.totalPrice,
      currency: b.currency,
      country: b.country,
      destinationCity: b.destinationCity,
      hotelName: b.hotelName,
      accommodationType: b.accommodationType,
      travelers: b.travelers,
      paidAmount: b.paidAmount,
      owedAmount: b.totalPrice - b.paidAmount,
      branch: b.branch,
      assignedUser: b.assignedUser,
    });
  }

  function SortLabel({ sortKeyValue, children }: { sortKeyValue: SortKey; children: React.ReactNode }) {
    const active = sortKey === sortKeyValue;
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortKeyValue)}
        title="Sortiraj"
        className={`flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`}
      >
        {children}
        <span className="w-[10px]">{active && <Icon name={sortDir === 'asc' ? 'triangle-up' : 'triangle-down'} />}</span>
      </button>
    );
  }

  const filterInputClass =
    'w-full rounded border border-ink-faint bg-panel px-1.5 py-0.5 text-[11px] font-normal text-ink outline-none placeholder:text-ink-faint focus:border-accent';

  return (
    <>
      {/* Traka iznad liste (23.8.2026, na zahtev vlasnika) — devet ikona pretrage (klik bira/
          poništava vrstu aranžmana kao filter), crveno zvonce (filter "samo hitno"), dugme
          "Filteri" (otvara FiltersModal — brzi filteri po koloni + Poslovnica/User/Dobavljač/
          Partner) i izvoz. */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-panel p-2">
        {PRODUCT_ICONS.filter((p) => p.types.length > 0).map((p) => {
          const active = productTypeFilter !== null && p.types.includes(productTypeFilter);
          return (
            <button
              key={p.label}
              onClick={() => setProductTypeFilter((cur) => (cur && p.types.includes(cur) ? null : p.types[0]))}
              title={`Filtriraj: ${p.label}`}
              className={`flex h-[26px] w-[26px] items-center justify-center rounded ${
                active ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel2 hover:text-ink'
              }`}
            >
              <Icon name={p.icon} />
            </button>
          );
        })}
        <div className="mx-1 h-5 w-px bg-ink-faint/40" />
        <button
          onClick={() => setUrgentOnly((v) => !v)}
          title={urgentOnly ? 'Ukloni filter "samo hitno"' : 'Filtriraj samo hitne rezervacije'}
          className={`flex h-[26px] w-[26px] items-center justify-center rounded ${urgentOnly ? 'bg-danger-bg text-danger' : 'text-danger hover:bg-panel2'}`}
        >
          <Icon name="bell" />
        </button>
        <button
          onClick={() => setFiltersModalOpen(true)}
          title="Svi filteri"
          className="flex h-[26px] items-center gap-1.5 rounded px-2 text-ink-faint hover:bg-panel2 hover:text-ink"
        >
          <Icon name="filter" /> Filteri
        </button>
        <div className="ml-auto">
          <ExportButton rows={sorted} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-panel2 text-ink-faint">
              <th className="w-[64px] px-3 py-2 font-medium" />
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="bookingNumber">Broj</SortLabel>
                <input value={filters.bookingNumber} onChange={(e) => setFilter('bookingNumber', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              {/* "Kreirano" premešteno između "Broj" i "Nosilac rezervacije" (23.8.2026, na
                  zahtev vlasnika) — poništava raniji redosled (bilo je poslednja kolona). */}
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="createdAt">Kreirano</SortLabel>
                <input value={filters.createdAt} onChange={(e) => setFilter('createdAt', e.target.value)} placeholder="dd/mm/gggg...dd/mm/gggg" className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="buyerName">Nosilac rezervacije</SortLabel>
                <input
                  value={filters.buyerName}
                  onChange={(e) => setFilter('buyerName', e.target.value)}
                  placeholder="nosilac, država, destinacija, hotel..."
                  className={`mt-1 ${filterInputClass}`}
                />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="channel">Kanal</SortLabel>
                <input value={filters.channel} onChange={(e) => setFilter('channel', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="status">Status</SortLabel>
                <input value={filters.status} onChange={(e) => setFilter('status', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="paymentStatus">Uplata</SortLabel>
                <input value={filters.paymentStatus} onChange={(e) => setFilter('paymentStatus', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="stayFrom">Dolazak</SortLabel>
                <input value={filters.stayFrom} onChange={(e) => setFilter('stayFrom', e.target.value)} placeholder="dd/mm/gggg...dd/mm/gggg" className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="stayTo">Odlazak</SortLabel>
                <input value={filters.stayTo} onChange={(e) => setFilter('stayTo', e.target.value)} placeholder="dd/mm/gggg...dd/mm/gggg" className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <div className="flex justify-end">
                  <SortLabel sortKeyValue="totalPrice">Iznos</SortLabel>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              // Klik na red (23.8.2026, na zahtev vlasnika: "Kada otvorimo desni panel i
              // kliknemo na neki red iz liste rezervacija u desnom panelu treba da se prikazu
              // sve najvaznije informacije") — dizajn dok. §5b "sažetak reda", prvi stvaran
              // izvor (RowSummaryContext.tsx). Ikonica toka rezervacije ostaje sopstvena radnja
              // (`e.stopPropagation()`), ne otvara i sažetak.
              <tr
                key={b.bookingNumber}
                onClick={() => openSummary(b)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-panel2"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {/* Prva ikona = vrsta aranžmana (23.8.2026, na zahtev vlasnika) — isti
                        katalog kao traka iznad liste, samo prikaz (ne klikabilna po redu, klik
                        za filter ide preko trake iznad). */}
                    <span title={PRODUCT_ICONS.find((p) => p.types.includes(b.productType))?.label ?? b.productType} className="flex h-[22px] w-[22px] items-center justify-center text-ink-faint">
                      <Icon name={PRODUCT_ICONS.find((p) => p.types.includes(b.productType))?.icon ?? 'question'} />
                    </span>
                    {b.urgent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUrgentFor(b);
                        }}
                        title="Hitno — klikni za detalje"
                        className="flex h-[22px] w-[22px] items-center justify-center rounded text-danger hover:bg-danger-bg"
                      >
                        <Icon name="bell" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTimelineFor(b);
                      }}
                      title="Tok rezervacije — ceo workflow, ko je i kada radio promenu"
                      className="flex h-[22px] w-[22px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-accent"
                    >
                      <Icon name="three-bars" />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono">
                  <button onClick={(e) => openFullRecord(e, b)} title="Otvori pun zapis rezervacije" className="text-ink hover:text-accent hover:underline">
                    {b.bookingNumber}
                  </button>
                </td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="text-ink-dim">{b.buyerName}</div>
                  {/* Država/destinacija/hotel ispod naziva nosioca (23.8.2026, na zahtev
                      vlasnika: "Ispod naziva nosioca, stavite naiv drzave, destinacije, hotela"). */}
                  <div className="text-[10px] text-ink-faint">
                    {b.destinationCity}, {b.country} · {b.hotelName}
                  </div>
                </td>
                <td className="px-3 py-2 text-ink-faint">{b.channel}</td>
                <td className="px-3 py-2">
                  <StatusBadge label={b.status} />
                </td>
                <td className="px-3 py-2">
                  <PaymentBadge label={b.paymentStatus} />
                </td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.stayFrom)}</td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.stayTo)}</td>
                {/* Valuta ispod iznosa (23.8.2026, na zahtev vlasnika) — poništava raniji
                    prikaz "iznos valuta" u jednom redu. */}
                <td className="px-3 py-2 text-right">
                  <div className="font-mono text-ink">{formatAmount(b.totalPrice)}</div>
                  <div className="text-[10px] text-ink-faint">{b.currency}</div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-ink-faint">
                  Nijedna rezervacija ne odgovara filterima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        {sorted.length} / {bookings.length} rezervacija (mock)
      </p>
      {timelineFor && <BookingTimelineModal mockEntries={buildMockTimeline(timelineFor)} onClose={() => setTimelineFor(null)} />}
      {urgentFor?.urgent && <UrgentModal bookingNumber={urgentFor.bookingNumber} reason={urgentFor.urgent.reason} onClose={() => setUrgentFor(null)} />}
      {filtersModalOpen && (
        <FiltersModal
          columnFilters={filters}
          onColumnFilterChange={setFilter}
          extraFilters={extraFilters}
          onExtraFiltersChange={setExtraFilters}
          onClose={() => setFiltersModalOpen(false)}
        />
      )}
    </>
  );
}
