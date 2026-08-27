import TabLink from '@/components/TabLink';
import { buildHref, WEEKDAYS_SHORT_SR, enumerateDates, type CalendarFiltersShape, type DateRange } from './calendar-utils';
import DayAgenda from './DayAgenda';
import { EMPTY_DAY_DETAIL, dayDetailCount, type DayDetail } from './types';

// Nedeljni prikaz — 7 kolona (pon-ned), svaka sa spiskom termina tog dana (bez satnice — vidi
// napomena u calendar-utils.ts, BookingItem nema vreme dolaska/odlaska, samo datum).
export default function WeekGrid({
  range,
  filters,
  todayIso,
  byDate,
}: {
  range: DateRange;
  filters: CalendarFiltersShape;
  todayIso: string;
  byDate: Map<string, DayDetail>;
}) {
  const dates = enumerateDates(range);
  return (
    <div className="grid grid-cols-7 gap-2">
      {dates.map((dateStr, i) => {
        const detail = byDate.get(dateStr) ?? EMPTY_DAY_DETAIL;
        const isToday = dateStr === todayIso;
        const count = dayDetailCount(detail);
        return (
          <div key={dateStr} className={`flex min-h-[220px] flex-col gap-2 rounded-lg border p-2 ${isToday ? 'border-accent bg-accent-soft/30' : 'border-border bg-panel'}`}>
            <TabLink href={buildHref('day', dateStr, filters)} label="Kalendar rezervacija" className="flex items-center justify-between text-xs hover:text-accent-strong">
              <span className="text-ink-faint">{WEEKDAYS_SHORT_SR[i]}</span>
              <span className={`font-mono ${isToday ? 'font-semibold text-accent-strong' : 'text-ink'}`}>{Number(dateStr.slice(8, 10))}</span>
            </TabLink>
            {count === 0 ? <p className="text-[11px] text-ink-faint">—</p> : <DayAgenda detail={detail} compact />}
          </div>
        );
      })}
    </div>
  );
}
