// M17/M5 spec — "Kalendar rezervacija" kao Google Calendar (27.8.2026, na zahtev vlasnika).
// Čisto datumska aritmetika (bez vremena — BookingItem.stayFrom/stayTo su datumi, ne
// trenuci, poglavlje 7 M5 spec — dan/nedelja prikaz zato grupiše PO DANU, ne po satu kao pravi
// Google Calendar sastanci, jer sat dolaska/odlaska ne postoji u modelu podataka).

export type CalendarView = 'month' | 'week' | 'day';

export const MONTHS_SR = [
  'januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar',
];
export const WEEKDAYS_SHORT_SR = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned'];
export const WEEKDAYS_LONG_SR = ['ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota', 'nedelja'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  return isoOf(new Date());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// Ponedeljak = početak nedelje (isti izbor kao postojeći mesečni grid).
export function startOfWeekMonday(d: Date): Date {
  const dow = (d.getDay() + 6) % 7;
  return addDays(d, -dow);
}

export interface DateRange {
  from: string;
  to: string;
}

export function computeRange(view: CalendarView, anchorIso: string): DateRange {
  const anchor = parseIso(anchorIso);
  if (view === 'day') return { from: anchorIso, to: anchorIso };
  if (view === 'week') {
    const start = startOfWeekMonday(anchor);
    return { from: isoOf(start), to: isoOf(addDays(start, 6)) };
  }
  return { from: isoOf(startOfMonth(anchor)), to: isoOf(endOfMonth(anchor)) };
}

export function shiftAnchor(view: CalendarView, anchorIso: string, dir: 1 | -1): string {
  const anchor = parseIso(anchorIso);
  if (view === 'day') return isoOf(addDays(anchor, dir));
  if (view === 'week') return isoOf(addDays(anchor, dir * 7));
  return isoOf(addMonths(anchor, dir));
}

export function enumerateDates(range: DateRange): string[] {
  const out: string[] = [];
  let d = parseIso(range.from);
  const end = parseIso(range.to);
  while (d <= end) {
    out.push(isoOf(d));
    d = addDays(d, 1);
  }
  return out;
}

export function rangeLabel(view: CalendarView, anchorIso: string): string {
  const anchor = parseIso(anchorIso);
  if (view === 'day') {
    return `${WEEKDAYS_LONG_SR[(anchor.getDay() + 6) % 7]}, ${anchor.getDate()}. ${MONTHS_SR[anchor.getMonth()]} ${anchor.getFullYear()}.`;
  }
  if (view === 'week') {
    const start = startOfWeekMonday(anchor);
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()}. ${MONTHS_SR[start.getMonth()]} ${start.getFullYear()}.`;
    }
    return `${start.getDate()}. ${MONTHS_SR[start.getMonth()]} – ${end.getDate()}. ${MONTHS_SR[end.getMonth()]} ${end.getFullYear()}.`;
  }
  return `${MONTHS_SR[anchor.getMonth()]} ${anchor.getFullYear()}.`;
}

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
