import TabLink from '@/components/TabLink';
import { buildHref, WEEKDAYS_SHORT_SR, addDays, isoOf, startOfWeekMonday, startOfMonth, endOfMonth, parseIso, type CalendarFiltersShape } from './calendar-utils';
import type { DaySummary } from './types';

// Mesečni grid, doteran (27.8.2026, na zahtev vlasnika — Google Calendar stil): puna 6×7
// nedeljna mreža (uključuje krajeve prethodnog/narednog meseca, sivo obojene, da se raspored
// dana-u-nedelji nikad ne pomera), klik na dan otvara Dan prikaz za taj datum (umesto ranijeg
// panela ispod grida).
export default function MonthGrid({ anchor, filters, byDate, todayIso }: { anchor: string; filters: CalendarFiltersShape; byDate: Map<string, DaySummary>; todayIso: string }) {
  const monthStart = startOfMonth(parseIso(anchor));
  const monthEnd = endOfMonth(parseIso(anchor));
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = addDays(startOfWeekMonday(monthEnd), 6);

  const cells: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) cells.push(isoOf(d));

  return (
    <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
      {WEEKDAYS_SHORT_SR.map((d) => (
        <div key={d} className="pb-1 text-ink-faint">
          {d}
        </div>
      ))}
      {cells.map((dateStr) => {
        const inMonth = dateStr >= isoOf(monthStart) && dateStr <= isoOf(monthEnd);
        const d = byDate.get(dateStr);
        const isToday = dateStr === todayIso;
        const total = d ? d.arrivalsCount + d.departuresCount + d.stayoversCount + d.singleDayCount : 0;
        return (
          <TabLink
            key={dateStr}
            href={buildHref('day', dateStr, filters)}
            label="Kalendar rezervacija"
            className={`flex min-h-[64px] flex-col items-center gap-0.5 rounded border p-1.5 hover:border-accent ${
              isToday ? 'border-accent bg-accent-soft' : 'border-border bg-panel'
            } ${inMonth ? '' : 'opacity-40'}`}
          >
            <span className="text-ink">{Number(dateStr.slice(8, 10))}</span>
            {total > 0 && (
              <>
                <span className="flex gap-0.5">
                  {d!.arrivalsCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-ok" title={`${d!.arrivalsCount} dolazak`} />}
                  {d!.departuresCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-warn" title={`${d!.departuresCount} odlazak`} />}
                  {d!.stayoversCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent2" title={`${d!.stayoversCount} u toku`} />}
                </span>
                <span className="text-[10px] text-ink-faint">{total}</span>
              </>
            )}
          </TabLink>
        );
      })}
    </div>
  );
}
