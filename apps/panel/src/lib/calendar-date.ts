// Čista datumska aritmetika deljena između "Kalendar rezervacija"
// (`rezervacije/kalendar/calendar-utils.ts`) i brzog filtera perioda na "Lista rezervacija"
// (`rezervacije/lista/PeriodQuickFilter.tsx`, 27.8.2026, na zahtev vlasnika: "pregled na
// dnevnom mesečnom i nedeljnom nivou staviti i u listu rezervacija") — izdvojeno ovde da se
// ista logika (mesec/nedelja/dan opseg, pomeranje, oznaka perioda) ne piše dvaput.

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

// Ponedeljak = početak nedelje.
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
