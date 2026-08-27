import type { CalendarDaySummary } from '@/components/RowSummaryContext';
import { allEntries, type DayDetail } from './types';

function increment(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

// M17 spec dopuna (27.8.2026) — agregira DayDetail (već fetch-ovan za Dan prikaz) u
// CalendarDaySummary za desni panel. Broji REZERVACIJE (jedinstven bookingId — jedna
// rezervacija sa dve stavke istog dana se ne broji dvaput) odvojeno od STAVKI.
export function buildDaySummary(date: string, detail: DayDetail): CalendarDaySummary {
  const entries = allEntries(detail);
  const uniqueBookingIds = new Set(entries.map((e) => e.bookingId));

  const statusCounts: Record<string, number> = {};
  const destinationCounts: Record<string, number> = {};
  const productTypeCounts: Record<string, number> = {};
  const valueByCurrency: Record<string, number> = {};
  let totalGuests = 0;
  let totalRooms = 0;
  let supplierPendingCount = 0;
  let unpaidCount = 0;

  const seenBookingForPayment = new Set<string>();
  for (const e of entries) {
    increment(statusCounts, e.bookingStatus);
    increment(destinationCounts, `${e.destinationCity}, ${e.destinationCountry}`);
    increment(productTypeCounts, e.productType);
    increment(valueByCurrency, e.finalPriceCurrency, e.finalPrice);
    totalGuests += e.guests.length;
    totalRooms += e.unitCount;
    if (e.status === 'PENDING_SUPPLIER_CONFIRMATION') supplierPendingCount++;
    // Uplata je svojstvo REZERVACIJE, ne stavke — broji se po jedinstvenoj rezervaciji da
    // dve stavke iste neplaćene rezervacije ne udvostruče brojku.
    if (e.paymentStatus === 'UNPAID' && !seenBookingForPayment.has(e.bookingId)) {
      seenBookingForPayment.add(e.bookingId);
      unpaidCount++;
    }
  }

  return {
    kind: 'calendar-day',
    date,
    bookingCount: uniqueBookingIds.size,
    itemCount: entries.length,
    statusCounts,
    destinationCounts,
    productTypeCounts,
    totalGuests,
    totalRooms,
    valueByCurrency,
    supplierPendingCount,
    unpaidCount,
  };
}
