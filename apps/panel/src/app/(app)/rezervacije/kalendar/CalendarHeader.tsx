'use client';

import TabLink from '@/components/TabLink';
import Icon from '@/components/Icon';
import { buildHref, rangeLabel, shiftAnchor, todayIso, type CalendarFiltersShape, type CalendarView } from './calendar-utils';

const VIEW_LABELS: Record<CalendarView, string> = { month: 'Mesec', week: 'Nedelja', day: 'Dan' };

// Prekidač Mesec/Nedelja/Dan + strelice + "Danas", isti obrazac kao Google Calendar traka
// (27.8.2026, na zahtev vlasnika: "napraviti kao Google kalendar sa svim funkcijama"). Svi
// linkovi idu preko `TabLink` (navigateInTab), ne golog `<Link>` — isti razlog kao zamka 9.2
// (docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md): pouzdanija navigacija unutar istog taba.
export default function CalendarHeader({ view, date, filters }: { view: CalendarView; date: string; filters: CalendarFiltersShape }) {
  const prevHref = buildHref(view, shiftAnchor(view, date, -1), filters);
  const nextHref = buildHref(view, shiftAnchor(view, date, 1), filters);
  const todayHref = buildHref(view, todayIso(), filters);

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <TabLink href={todayHref} label="Kalendar rezervacija" className="rounded border border-border px-2 py-1 text-xs hover:border-accent">
          danas
        </TabLink>
        <div className="flex items-center gap-1">
          <TabLink href={prevHref} label="Kalendar rezervacija" className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs hover:border-accent">
            ‹
          </TabLink>
          <TabLink href={nextHref} label="Kalendar rezervacija" className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs hover:border-accent">
            ›
          </TabLink>
        </div>
        <h1 className="font-mono text-lg">
          <span className="text-accent">$</span> {rangeLabel(view, date)}
        </h1>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-panel p-0.5 text-xs">
        {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
          <TabLink
            key={v}
            href={buildHref(view, date, filters, { view: v })}
            label="Kalendar rezervacija"
            className={`flex items-center gap-1 rounded px-2.5 py-1 ${v === view ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:text-ink'}`}
          >
            {v === 'day' && <Icon name="calendar" className="!text-[12px]" />}
            {VIEW_LABELS[v]}
          </TabLink>
        ))}
      </div>
    </div>
  );
}
