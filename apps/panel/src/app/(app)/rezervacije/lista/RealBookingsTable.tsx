'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import AddToAiContextButton from '@/components/AddToAiContextButton';
import { useRowSummary } from '@/components/RowSummaryContext';
import { useTabs } from '@/components/TabsContext';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deriveEmail, derivePhoneFromSeed } from './mock-data';
import UrgentModal from './UrgentModal';

export interface RealBookingItem {
  id: string;
  stayFrom: string;
  stayTo: string;
  itemStatus: string;
  finalPrice: number;
  finalPriceCurrency: string;
  product: { destinationCountry: string; destinationCity: string; type: string } | null;
}

export interface RealBooking {
  id: string;
  bookingNumber: string;
  buyerName: string;
  buyerType: 'FIZICKO_LICE' | 'PRAVNO_LICE';
  channel: string;
  tipNastupanja: string;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  currency: string;
  createdAt: string;
  items: RealBookingItem[];
}

const BRANCHES = ['Beograd — centrala', 'Novi Sad', 'Niš'];
const USERS = ['Marija Nikolić', 'Petar Stevanović', 'Ana Radulović'];

function hashSeed(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 100_000;
  return h;
}

// M5 spec v1.54 (24.8.2026) — polja koja NEMAJU pravi izvor u bazi (poslovnica/dodeljeni
// korisnik/naziv hotela/"Hitno") se deterministički izvode isto kao ranije na mock listi, ali
// SVA su vizuelno obeležena kao demo (siva zvona, tekst "(demo)") — nikad crveno/hitno kao da je
// stvaran signal, jer bi to na PRAVOJ rezervaciji moglo da zavara nekoga da postoji stvaran
// problem koji ne postoji. Ovo je namerna razlika u odnosu na doslovno "isto kao mock lista"
// (vlasnikova odluka 24.8.2026 je bila "vizuelno bez funkcije" — primenjeno ovde i na TON, ne
// samo na klik-akciju).
function decorate(b: RealBooking) {
  const h = hashSeed(b.bookingNumber);
  const firstItem = b.items[0];
  const destinationCity = firstItem?.product?.destinationCity;
  const destinationCountry = firstItem?.product?.destinationCountry;
  const stayFrom = b.items.length > 0 ? b.items.reduce((min, i) => (i.stayFrom < min ? i.stayFrom : min), b.items[0].stayFrom) : null;
  const stayTo = b.items.length > 0 ? b.items.reduce((max, i) => (i.stayTo > max ? i.stayTo : max), b.items[0].stayTo) : null;
  const productType = firstItem?.product?.type ?? null;

  return {
    ...b,
    destinationCity: destinationCity ?? null,
    destinationCountry: destinationCountry ?? null,
    stayFrom,
    stayTo,
    productType,
    // Demo (bez pravog izvora):
    buyerEmail: deriveEmail(b.buyerName),
    buyerPhone: derivePhoneFromSeed(b.bookingNumber),
    branch: BRANCHES[h % BRANCHES.length],
    assignedUser: USERS[h % USERS.length],
    hotelName: destinationCity ? `Hotel ${destinationCity} (demo naziv)` : 'Hotel (demo naziv)',
    supplierName: 'Dobavljač (demo)',
    supplierEmail: `demo.dobavljac@primer.local`,
    supplierPhone: derivePhoneFromSeed(`supplier-${b.bookingNumber}`),
    demoUrgent: h % 5 === 0 ? [{ reason: 'DEMO — ovo je izmišljen primer, ne stvaran signal (čeka pravi izvor).', target: (h % 2 === 0 ? 'BUYER' : 'SUPPLIER') as 'BUYER' | 'SUPPLIER' }] : null,
  };
}

type DecoratedRow = ReturnType<typeof decorate>;
type SortKey = 'bookingNumber' | 'buyerName' | 'channel' | 'status' | 'paymentStatus' | 'stayFrom' | 'stayTo' | 'createdAt' | 'totalPrice';

// Brzo filtriranje po koloni (6.9.2026, vlasnikov zahtev: "ranije smo imali sada je nestalo
// brzo filtrianje po kolonama liste. vratite to.") — postojalo je na MOCK tabeli
// (`BookingsTable.tsx`/`FiltersModal.tsx`, `ColumnKey`), ali nikad nije preneto ovde kad je
// lista prešla na prave podatke (`da28ed8`) — nova tabela je napravljena bez tog dela, ne
// namerno uklonjena. Radi ISKLJUČIVO nad već učitanom stranom rezultata (kao i
// `productTypeFilters`/`demoOnly` ispod) — trenutno filtriranje bez čekanja na server, dopuna
// stvarnim server-side poljima iz `RealFilterBar.tsx`, ne zamena za njih. Datumske kolone
// (Kreirano/Dolazak/Odlazak) NAMERNO nisu ovde — `RealFilterBar`/popup već imaju prave
// opsežne kalendare za njih, dupliranje bi samo zbunjivalo koje polje šta tačno radi.
type ColumnKey = 'bookingNumber' | 'buyerName' | 'channel' | 'status' | 'paymentStatus';
const EMPTY_COLUMN_FILTERS: Record<ColumnKey, string> = { bookingNumber: '', buyerName: '', channel: '', status: '', paymentStatus: '' };

function formatAmount(amount: number): string {
  return (amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sr-RS');
}

// shadcn/ui Badge (29.8.2026, tt-shadcn-redesign) — isti semantički raspored boja kao pre
// (ok/danger/neutralno), samo preko zajedničke komponente umesto ručnog <span> na svakom mestu.
function StatusBadge({ label }: { label: string }) {
  if (['CONFIRMED', 'COMPLETED'].includes(label)) return <Badge variant="ok">{label}</Badge>;
  if (label === 'CANCELLED') return <Badge variant="danger">{label}</Badge>;
  return (
    <Badge variant="secondary" className="text-ink-faint">
      {label}
    </Badge>
  );
}
function PaymentBadge({ label }: { label: string }) {
  if (label === 'PAID') return <Badge variant="ok">{label}</Badge>;
  if (label === 'UNPAID') return <Badge variant="danger">{label}</Badge>;
  return (
    <Badge variant="secondary" className="text-ink-faint">
      {label}
    </Badge>
  );
}

// Filter po tipu proizvoda i "demo zvona" (24.8.2026, dopuna: "Filtere u listi rezervacija
// fixirajte da budu vidljivi prilikom scrolovanja") — državа premeštena u `BookingsListClient.tsx`
// (novi zajednički sticky omotač sa `RealFilterBar`, poglavlje 5a/5b dizajn dok. princip da
// filteri ostaju vidljivi) da bi traka ikonica i forma filtera mogle da se lepe za vrh ZAJEDNO,
// kao jedan sticky blok — dva odvojena `position: sticky` elementa bez zajedničkog
// omotača bi se preklapala (oba teže istom `top: 0`), umesto da se slažu jedan ispod drugog.
export default function RealBookingsTable({
  bookings,
  productTypeFilters,
  demoOnly,
}: {
  bookings: RealBooking[];
  /** Dopuna 25.8.2026 — višestruki izbor (BookingsListClient.tsx), prazan niz = bez filtera. */
  productTypeFilters: string[];
  demoOnly: boolean;
}) {
  const decorated = useMemo(() => bookings.map(decorate), [bookings]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [urgentFor, setUrgentFor] = useState<DecoratedRow | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<ColumnKey, string>>(EMPTY_COLUMN_FILTERS);
  const hasColumnFilters = Object.values(columnFilters).some(Boolean);

  function setColumnFilter(key: ColumnKey, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  const { showSummary } = useRowSummary();
  const { openTab } = useTabs();

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

  const filtered = useMemo(() => {
    const needle = (key: ColumnKey) => columnFilters[key].trim().toLowerCase();
    return decorated.filter((b) => {
      if (productTypeFilters.length > 0 && !productTypeFilters.includes(b.productType ?? '')) return false;
      if (demoOnly && !b.demoUrgent) return false;
      if (needle('bookingNumber') && !b.bookingNumber.toLowerCase().includes(needle('bookingNumber'))) return false;
      if (needle('buyerName') && !b.buyerName.toLowerCase().includes(needle('buyerName'))) return false;
      if (needle('channel') && !b.channel.toLowerCase().includes(needle('channel'))) return false;
      if (needle('status') && !b.status.toLowerCase().includes(needle('status'))) return false;
      if (needle('paymentStatus') && !b.paymentStatus.toLowerCase().includes(needle('paymentStatus'))) return false;
      return true;
    });
  }, [decorated, productTypeFilters, demoOnly, columnFilters]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv), 'sr-RS');
    });
  }, [filtered, sortKey, sortDir]);

  function openFullRecord(e: React.MouseEvent, b: RealBooking) {
    e.stopPropagation();
    // Pravi detalj (poglavlje 6 M5 spec), NE mock pod-ruta — lista je od v1.54 stvarna.
    openTab(`/rezervacije/${b.id}`, b.bookingNumber);
  }

  function openSummary(b: DecoratedRow) {
    showSummary({
      kind: 'booking',
      bookingId: b.id,
      bookingNumber: b.bookingNumber,
      buyerName: b.buyerName,
      status: b.status,
      paymentStatus: b.paymentStatus,
      stayFrom: b.stayFrom ?? '',
      stayTo: b.stayTo ?? '',
      totalPrice: b.totalPrice,
      currency: b.currency,
      country: b.destinationCountry ?? '—',
      destinationCity: b.destinationCity ?? '—',
      hotelName: b.hotelName,
      accommodationType: '—',
      travelers: [],
      paidAmount: 0,
      owedAmount: b.totalPrice,
      branch: b.branch,
      assignedUser: b.assignedUser,
    });
  }

  function SortLabel({ sortKeyValue, children }: { sortKeyValue: SortKey; children: React.ReactNode }) {
    const active = sortKey === sortKeyValue;
    return (
      <button type="button" onClick={() => toggleSort(sortKeyValue)} title="Sortiraj" className={`flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`}>
        {children}
        <span className="w-[10px]">{active && <Icon name={sortDir === 'asc' ? 'triangle-up' : 'triangle-down'} />}</span>
      </button>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-panel">
        <Table className="min-w-[980px] text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[70px]" />
              <TableHead>
                <SortLabel sortKeyValue="bookingNumber">Broj</SortLabel>
              </TableHead>
              <TableHead>
                <SortLabel sortKeyValue="createdAt">Kreirano</SortLabel>
              </TableHead>
              <TableHead>
                <SortLabel sortKeyValue="buyerName">Nosilac rezervacije</SortLabel>
              </TableHead>
              <TableHead>
                <SortLabel sortKeyValue="channel">Kanal</SortLabel>
              </TableHead>
              <TableHead>
                <SortLabel sortKeyValue="status">Status</SortLabel>
              </TableHead>
              <TableHead>
                <SortLabel sortKeyValue="paymentStatus">Uplata</SortLabel>
              </TableHead>
              <TableHead>
                <SortLabel sortKeyValue="stayFrom">Dolazak</SortLabel>
              </TableHead>
              <TableHead>
                <SortLabel sortKeyValue="stayTo">Odlazak</SortLabel>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex justify-end">
                  <SortLabel sortKeyValue="totalPrice">Iznos</SortLabel>
                </div>
              </TableHead>
            </TableRow>
            {/* Brzo filtriranje po koloni (6.9.2026, vlasnikov zahtev: "vratite to") — trenutno,
                bez čekanja na server, nad već učitanom stranom rezultata. */}
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[70px]" />
              <TableHead>
                <ColumnFilterInput value={columnFilters.bookingNumber} onChange={(v) => setColumnFilter('bookingNumber', v)} />
              </TableHead>
              <TableHead />
              <TableHead>
                <ColumnFilterInput value={columnFilters.buyerName} onChange={(v) => setColumnFilter('buyerName', v)} />
              </TableHead>
              <TableHead>
                <ColumnFilterInput value={columnFilters.channel} onChange={(v) => setColumnFilter('channel', v)} />
              </TableHead>
              <TableHead>
                <ColumnFilterInput value={columnFilters.status} onChange={(v) => setColumnFilter('status', v)} />
              </TableHead>
              <TableHead>
                <ColumnFilterInput value={columnFilters.paymentStatus} onChange={(v) => setColumnFilter('paymentStatus', v)} />
              </TableHead>
              <TableHead />
              <TableHead />
              <TableHead className="text-right">
                {hasColumnFilters && (
                  <button
                    type="button"
                    onClick={() => setColumnFilters(EMPTY_COLUMN_FILTERS)}
                    title="Obriši brze filtere po koloni"
                    className="text-ink-faint hover:text-danger"
                  >
                    <Icon name="close" />
                  </button>
                )}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((b) => (
              <TableRow key={b.id} onClick={() => openSummary(b)} className="group cursor-pointer last:border-0">
                <TableCell>
                  <div className="flex items-center gap-1">
                    <AddToAiContextButton refLabel={`Rezervacija ${b.bookingNumber}`} />
                    <span
                      title={PRODUCT_ICONS.find((p) => p.types.includes(b.productType ?? ''))?.label ?? b.productType ?? '—'}
                      className="flex h-[22px] w-[22px] items-center justify-center text-ink-faint"
                    >
                      <Icon name={PRODUCT_ICONS.find((p) => p.types.includes(b.productType ?? ''))?.icon ?? 'question'} />
                    </span>
                    {b.demoUrgent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUrgentFor(b);
                        }}
                        title="DEMO zvono — nije stvaran signal, klikni za detalje"
                        className="flex h-[22px] w-[22px] items-center justify-center rounded text-ink-faint hover:bg-panel2 hover:text-ink"
                      >
                        <Icon name="bell" />
                      </button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono">
                  <button onClick={(e) => openFullRecord(e, b)} title="Otvori pun zapis rezervacije" className="text-ink hover:text-accent hover:underline">
                    {b.bookingNumber}
                  </button>
                </TableCell>
                <TableCell className="text-ink-faint">{formatDate(b.createdAt)}</TableCell>
                <TableCell>
                  <div className="text-ink-dim">{b.buyerName}</div>
                  <div className="text-xs text-ink-faint">
                    {b.destinationCity && b.destinationCountry ? (
                      <>
                        {b.destinationCity}, {b.destinationCountry}
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-ink-faint">{b.channel}</TableCell>
                <TableCell>
                  <StatusBadge label={b.status} />
                </TableCell>
                <TableCell>
                  <PaymentBadge label={b.paymentStatus} />
                </TableCell>
                <TableCell className="text-ink-faint">{formatDate(b.stayFrom)}</TableCell>
                <TableCell className="text-ink-faint">{formatDate(b.stayTo)}</TableCell>
                <TableCell className="text-right">
                  <div className="font-mono text-ink">{formatAmount(b.totalPrice)}</div>
                  <div className="text-[11px] text-ink-faint">{b.currency}</div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-6 text-center text-ink-faint">
                  Nijedna rezervacija ne odgovara filterima.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">{sorted.length} / {bookings.length} rezervacija</p>

      {urgentFor?.demoUrgent && (
        <UrgentModal
          bookingNumber={urgentFor.bookingNumber}
          notifications={urgentFor.demoUrgent}
          buyerName={urgentFor.buyerName}
          buyerEmail={urgentFor.buyerEmail}
          buyerPhone={urgentFor.buyerPhone}
          supplierName={urgentFor.supplierName}
          supplierEmail={urgentFor.supplierEmail}
          supplierPhone={urgentFor.supplierPhone}
          onClose={() => setUrgentFor(null)}
        />
      )}
    </>
  );
}

function ColumnFilterInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="filtriraj…"
      className="w-full rounded border border-transparent bg-panel2 px-1.5 py-1 text-[11px] font-normal text-ink outline-none placeholder:text-ink-faint focus:border-accent"
    />
  );
}
