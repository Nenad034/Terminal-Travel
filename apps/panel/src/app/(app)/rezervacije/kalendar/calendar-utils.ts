// M17/M5 spec — "Kalendar rezervacija" kao Google Calendar (27.8.2026, na zahtev vlasnika).
// Čista datumska aritmetika premeštena u `@/lib/calendar-date.ts` (27.8.2026, dopuna — ista
// logika je zatrebala i "Listi rezervacija" preko `PeriodQuickFilter.tsx`, deljeno umesto
// duplirano) — ovaj fajl re-eksportuje to za postojeće uvoze unutar kalendar foldera, i
// zadržava filter-specifičan deo (`CalendarFiltersShape`) koji je ISKLJUČIVO ovde relevantan
// (M5 spec §7.4 filter-skup, drugačiji oblik od `BookingFilters` na Listi).
export {
  type CalendarView,
  MONTHS_SR,
  WEEKDAYS_SHORT_SR,
  WEEKDAYS_LONG_SR,
  isoOf,
  parseIso,
  todayIso,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeekMonday,
  type DateRange,
  computeRange,
  shiftAnchor,
  enumerateDates,
  rangeLabel,
} from '@/lib/calendar-date';
import type { CalendarView } from '@/lib/calendar-date';

// Filteri deljeni sa "Lista rezervacija" (RealFilterBar.tsx), BEZ datumskih opsega dolaska/
// odlaska — sam prikaz (mesec/nedelja/dan) već zadaje taj opseg (vidi M5 spec §7 dopuna).
export interface CalendarFiltersShape {
  status?: string | string[];
  paymentStatus?: string | string[];
  tipNastupanja?: string | string[];
  buyerName?: string;
  bookingNumber?: string;
  currency?: string;
  createdFrom?: string;
  createdTo?: string;
  productType?: string | string[];
  productId?: string;
  destinationCity?: string;
  destinationCountry?: string;
  hasTravelGuarantee?: string;
}

const FILTER_KEYS: (keyof CalendarFiltersShape)[] = [
  'status', 'paymentStatus', 'tipNastupanja', 'buyerName', 'bookingNumber', 'currency',
  'createdFrom', 'createdTo', 'productType', 'productId', 'destinationCity', 'destinationCountry', 'hasTravelGuarantee',
];

export function extractFilters(searchParams: Record<string, string | string[] | undefined>): CalendarFiltersShape {
  const out: CalendarFiltersShape = {};
  for (const key of FILTER_KEYS) {
    const v = searchParams[key];
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

export function filtersToQueryParams(filters: CalendarFiltersShape): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) if (v) params.append(key, v);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}

// Gradi href ka istoj `/rezervacije/kalendar` ruti sa view/date + svi trenutni filteri, uz
// eventualne izmene (npr. samo `date` menja prev/next, samo `view` menja prekidač prikaza).
export function buildHref(view: CalendarView, date: string, filters: CalendarFiltersShape, overrides: Partial<{ view: CalendarView; date: string }> = {}): string {
  const params = filtersToQueryParams(filters);
  params.set('view', overrides.view ?? view);
  params.set('date', overrides.date ?? date);
  return `/rezervacije/kalendar?${params.toString()}`;
}
