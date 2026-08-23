'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import BookingTimelineModal, { type TimelineEntry } from '@/components/BookingTimelineModal';
import type { MockBookingRow } from './mock-data';

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

function formatMoney(amount: number, currency: string): string {
  return `${(amount / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sr-RS');
}

// Izmišljen (ali realan-oblik) tok, samo za MOCK prikaz (23.8.2026) — pravi tok ide preko
// stvarnog GET /sales/bookings/:id/history (M5 spec §11 dopuna, isti dan) čim ova lista dobije
// stvarne ID-jeve iz baze umesto izmišljenih brojeva rezervacija.
function buildMockTimeline(b: MockBookingRow): TimelineEntry[] {
  const created = new Date(b.createdAt);
  const plusDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
  const entries: TimelineEntry[] = [
    { timestamp: created.toISOString(), action: 'booking.pending_supplier_confirmation', actorType: 'HUMAN', actorName: 'Marija Nikolić (prodaja)' },
  ];
  if (b.status !== 'PENDING_SUPPLIER_CONFIRMATION') {
    entries.push({ timestamp: plusDays(created, 1).toISOString(), action: 'booking.confirmed', actorType: 'AI_AGENT', actorName: 'SupplierConfirmationAgent' });
  }
  if (b.status === 'MODIFIED') {
    entries.push({ timestamp: plusDays(created, 3).toISOString(), action: 'booking.modified', actorType: 'HUMAN', actorName: 'Marija Nikolić (prodaja)' });
  }
  if (b.status === 'CANCELLED') {
    entries.push({ timestamp: plusDays(created, 2).toISOString(), action: 'booking.cancelled', actorType: 'HUMAN', actorName: 'Nenad Tomić (vlasnik)' });
  }
  if (b.paymentStatus === 'PAID' || b.paymentStatus === 'PARTIALLY_PAID') {
    entries.push({ timestamp: plusDays(created, 4).toISOString(), action: 'payment.recorded', actorType: 'SYSTEM', actorName: 'sistem (uplata evidentirana)' });
  }
  if (b.status === 'COMPLETED') {
    entries.push({ timestamp: b.stayTo, action: 'booking.completed', actorType: 'SYSTEM', actorName: 'sistem (datum povratka prošao)' });
  }
  return entries;
}

type TextColumnKey = 'bookingNumber' | 'buyerName' | 'channel' | 'status' | 'paymentStatus';
type DateColumnKey = 'stayFrom' | 'stayTo' | 'createdAt';
type ColumnKey = TextColumnKey | DateColumnKey;

const DATE_COLUMNS: DateColumnKey[] = ['stayFrom', 'stayTo', 'createdAt'];

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

  const filtered = useMemo(() => {
    return bookings.filter((b) =>
      (Object.keys(filters) as ColumnKey[]).every((key) => {
        const value = filters[key];
        if (!value.trim()) return true;
        if ((DATE_COLUMNS as string[]).includes(key)) return matchesDateRange(b[key as DateColumnKey], value);
        return String(b[key as TextColumnKey]).toLowerCase().includes(value.trim().toLowerCase());
      }),
    );
  }, [bookings, filters]);

  function setFilter(key: ColumnKey, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const filterInputClass =
    'w-full rounded border border-ink-faint bg-panel px-1.5 py-0.5 text-[11px] font-normal text-ink outline-none placeholder:text-ink-faint focus:border-accent';

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-panel2 text-ink-faint">
              <th className="w-8 px-3 py-2 font-medium" />
              <th className="px-3 py-2 font-medium">
                Broj
                <input value={filters.bookingNumber} onChange={(e) => setFilter('bookingNumber', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              {/* "Kreirano" premešteno između "Broj" i "Nosilac rezervacije" (23.8.2026, na
                  zahtev vlasnika) — poništava raniji redosled (bilo je poslednja kolona). */}
              <th className="px-3 py-2 font-medium">
                Kreirano
                <input value={filters.createdAt} onChange={(e) => setFilter('createdAt', e.target.value)} placeholder="dd/mm/gggg...dd/mm/gggg" className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                Nosilac rezervacije
                <input value={filters.buyerName} onChange={(e) => setFilter('buyerName', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                Kanal
                <input value={filters.channel} onChange={(e) => setFilter('channel', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                Status
                <input value={filters.status} onChange={(e) => setFilter('status', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                Uplata
                <input value={filters.paymentStatus} onChange={(e) => setFilter('paymentStatus', e.target.value)} placeholder="pretraži..." className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                Dolazak
                <input value={filters.stayFrom} onChange={(e) => setFilter('stayFrom', e.target.value)} placeholder="dd/mm/gggg...dd/mm/gggg" className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 font-medium">
                Odlazak
                <input value={filters.stayTo} onChange={(e) => setFilter('stayTo', e.target.value)} placeholder="dd/mm/gggg...dd/mm/gggg" className={`mt-1 ${filterInputClass}`} />
              </th>
              <th className="px-3 py-2 text-right font-medium">Iznos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.bookingNumber} className="border-b border-border last:border-0 hover:bg-panel2">
                <td className="px-3 py-2">
                  <button
                    onClick={() => setTimelineFor(b)}
                    title="Tok rezervacije — ceo workflow, ko je i kada radio promenu"
                    className="flex h-[22px] w-[22px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-accent"
                  >
                    <Icon name="three-bars" />
                  </button>
                </td>
                <td className="px-3 py-2 font-mono text-ink">{b.bookingNumber}</td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.createdAt)}</td>
                <td className="px-3 py-2 text-ink-dim">{b.buyerName}</td>
                <td className="px-3 py-2 text-ink-faint">{b.channel}</td>
                <td className="px-3 py-2">
                  <StatusBadge label={b.status} />
                </td>
                <td className="px-3 py-2">
                  <PaymentBadge label={b.paymentStatus} />
                </td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.stayFrom)}</td>
                <td className="px-3 py-2 text-ink-faint">{formatDate(b.stayTo)}</td>
                <td className="px-3 py-2 text-right font-mono text-ink">{formatMoney(b.totalPrice, b.currency)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
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
        {filtered.length} / {bookings.length} rezervacija (mock)
      </p>
      {timelineFor && <BookingTimelineModal mockEntries={buildMockTimeline(timelineFor)} onClose={() => setTimelineFor(null)} />}
    </>
  );
}
