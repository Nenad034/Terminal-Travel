import { apiFetch } from '@/lib/api-client';
import RegisterTab from '@/components/RegisterTab';
import CalendarHeader from './CalendarHeader';
import CalendarFilterBar from './CalendarFilterBar';
import MonthGrid from './MonthGrid';
import WeekGrid from './WeekGrid';
import DayAgenda from './DayAgenda';
import RegisterDaySummary from './RegisterDaySummary';
import { computeRange, enumerateDates, extractFilters, filtersToQueryParams, todayIso, type CalendarView } from './calendar-utils';
import { EMPTY_DAY_DETAIL, type DayDetail, type DaySummary } from './types';


// M17 spec §4 (Faza 1) — "Kalendar rezervacija", M5 §7 calendar-summary/calendar/:date.
// Rebuild 27.8.2026 (na zahtev vlasnika: "napraviti kao Google Calendar sa svim funkcijama
// prilagođenim potrebama TT-a, dodati filtere koji postoje u Listi rezervacija") — tri prikaza
// (mesec/nedelja/dan) + prekidač + "danas" + isti v1 filter-skup kao "Lista rezervacija" (M5
// spec §11), primenjen preko `GET /sales/bookings/calendar-summary`/`calendar/:date` (§7
// dopuna). NAMERNO bez prevlačenja termina (potvrđeno preko `AskUserQuestion` sa vlasnikom,
// 27.8.2026) — ovaj prolaz je čist pregled, promena datuma rezervacije i dalje ide kroz
// postojeći tok izmene rezervacije, ne prevlačenjem u kalendaru (izmena datuma zahteva
// ponovnu proveru kapaciteta/cene, veći, zaseban poduhvat).
export default async function CalendarPage(
  props: { searchParams: Promise<Record<string, string | string[] | undefined>> }
) {
  const searchParams = await props.searchParams;
  const view = (typeof searchParams.view === 'string' && ['month', 'week', 'day'].includes(searchParams.view) ? searchParams.view : 'month') as CalendarView;
  const anchor = typeof searchParams.date === 'string' ? searchParams.date : todayIso();
  const filters = extractFilters(searchParams);
  const range = computeRange(view, anchor);
  const filterQuery = filtersToQueryParams(filters).toString();

  let error: string | null = null;
  let monthByDate = new Map<string, DaySummary>();
  let daysByDate = new Map<string, DayDetail>();

  try {
    if (view === 'month') {
      const days = await apiFetch<DaySummary[]>(`/sales/bookings/calendar-summary?from=${range.from}&to=${range.to}${filterQuery ? `&${filterQuery}` : ''}`);
      monthByDate = new Map(days.map((d) => [d.date, d]));
    } else {
      const dates = enumerateDates(range);
      const results = await Promise.all(
        dates.map((d) =>
          apiFetch<DayDetail>(`/sales/bookings/calendar/${d}${filterQuery ? `?${filterQuery}` : ''}`).catch(() => EMPTY_DAY_DETAIL),
        ),
      );
      daysByDate = new Map(dates.map((d, i) => [d, results[i]]));
    }
  } catch {
    error = 'Kalendar trenutno nije dostupan (M5/booking/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Kalendar rezervacija" />
      <CalendarHeader view={view} date={anchor} filters={filters} />
      <CalendarFilterBar view={view} date={anchor} filters={filters} />

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && view === 'month' && <MonthGrid anchor={anchor} filters={filters} byDate={monthByDate} todayIso={todayIso()} />}
      {!error && view === 'week' && <WeekGrid range={range} filters={filters} todayIso={todayIso()} byDate={daysByDate} />}
      {!error && view === 'day' && (
        <div className="rounded-lg border border-border bg-panel p-4">
          <RegisterDaySummary date={anchor} detail={daysByDate.get(anchor) ?? EMPTY_DAY_DETAIL} />
          <DayAgenda detail={daysByDate.get(anchor) ?? EMPTY_DAY_DETAIL} />
        </div>
      )}
    </div>
  );
}
