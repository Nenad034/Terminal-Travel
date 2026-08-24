'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useRowSummary } from '@/components/RowSummaryContext';
import { useTabs } from '@/components/TabsContext';
import { PRODUCT_ICONS } from '@/lib/search-product-types';
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

function formatAmount(amount: number): string {
  return (amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sr-RS');
}

function StatusBadge({ label }: { label: string }) {
  const tone = ['CONFIRMED', 'COMPLETED'].includes(label) ? 'text-ok bg-ok-bg' : label === 'CANCELLED' ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}
function PaymentBadge({ label }: { label: string }) {
  const tone = label === 'PAID' ? 'text-ok bg-ok-bg' : label === 'UNPAID' ? 'text-danger bg-danger-bg' : 'text-ink-faint bg-panel2';
  return <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

export default function RealBookingsTable({ bookings }: { bookings: RealBooking[] }) {
  const decorated = useMemo(() => bookings.map(decorate), [bookings]);
  const [productTypeFilter, setProductTypeFilter] = useState<string | null>(null);
  const [demoOnly, setDemoOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [urgentFor, setUrgentFor] = useState<DecoratedRow | null>(null);

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
    return decorated.filter((b) => {
      if (productTypeFilter && b.productType !== productTypeFilter) return false;
      if (demoOnly && !b.demoUrgent) return false;
      return true;
    });
  }, [decorated, productTypeFilter, demoOnly]);

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
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-panel p-2">
        {PRODUCT_ICONS.filter((p) => p.types.length > 0).map((p) => {
          const active = productTypeFilter !== null && p.types.includes(productTypeFilter);
          return (
            <button
              key={p.label}
              onClick={() => setProductTypeFilter((cur) => (cur && p.types.includes(cur) ? null : p.types[0]))}
              title={`Filtriraj: ${p.label}`}
              className={`flex h-[26px] w-[26px] items-center justify-center rounded ${active ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel2 hover:text-ink'}`}
            >
              <Icon name={p.icon} />
            </button>
          );
        })}
        <div className="mx-1 h-5 w-px bg-ink-faint/40" />
        <button
          onClick={() => setDemoOnly((v) => !v)}
          title={demoOnly ? 'Ukloni filter "samo demo zvona"' : 'Prikaži samo redove sa demo zvonom (nije stvaran signal)'}
          className={`flex h-[26px] items-center gap-1.5 rounded px-2 text-[11px] ${demoOnly ? 'bg-panel2 text-ink' : 'text-ink-faint hover:bg-panel2'}`}
        >
          <Icon name="bell" /> demo zvona
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-panel2 text-ink-faint">
              <th className="w-[48px] px-3 py-2 font-medium" />
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="bookingNumber">Broj</SortLabel>
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="createdAt">Kreirano</SortLabel>
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="buyerName">Nosilac rezervacije</SortLabel>
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="channel">Kanal</SortLabel>
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="status">Status</SortLabel>
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="paymentStatus">Uplata</SortLabel>
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="stayFrom">Dolazak</SortLabel>
              </th>
              <th className="px-3 py-2 font-medium">
                <SortLabel sortKeyValue="stayTo">Odlazak</SortLabel>
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
              <tr key={b.id} onClick={() => openSummary(b)} className="cursor-pointer border-b border-border last:border-0 hover:bg-panel2">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
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
                </td>
                <td className="px-3 py-2 font-mono">
                  <button onClick={(e) => openFullRecord(e, b)} title="Otvori pun zapis rezervacije" className="text-ink hover:text-accent hover:underline">
                    {b.bookingNumber}
                  </button>
                </td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="text-ink-dim">{b.buyerName}</div>
                  <div className="text-[10px] text-ink-faint">
                    {b.destinationCity && b.destinationCountry ? (
                      <>
                        {b.destinationCity}, {b.destinationCountry}
                      </>
                    ) : (
                      '—'
                    )}
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
                <td className="px-3 py-2 text-right">
                  <div className="font-mono text-ink">{formatAmount(b.totalPrice)}</div>
                  <div className="text-[10px] text-ink-faint">{b.currency}</div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-ink-faint">
                  Nijedna rezervacija ne odgovara filterima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
