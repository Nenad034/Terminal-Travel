'use client';

import TabLink from '@/components/TabLink';
import Icon from '@/components/Icon';
import { computeRange, rangeLabel, shiftAnchor, todayIso, type CalendarView } from '@/lib/calendar-date';

const VIEW_LABELS: Record<CalendarView, string> = { month: 'Mesec', week: 'Nedelja', day: 'Dan' };
const STATE_KEYS = ['stayFrom', 'stayTo', 'periodView', 'periodAnchor'];

// Brz period (Dan/Nedelja/Mesec + danas/strelice), na zahtev vlasnika 27.8.2026: "pregled na
// dnevnom mesečnom i nedeljnom nivou staviti i u listu rezervacija" — potvrđeno preko
// `AskUserQuestion`: ovo je BRZI FILTER perioda (postavlja `stayFrom`/`stayTo`, isti parametri
// koje `RealFilterBar.tsx` već ima kao ručna polja "Dolazak od/do"), NE novi način prikaza
// redova (tabela ostaje nepromenjena). Deli datumsku aritmetiku sa "Kalendar rezervacija"
// (`@/lib/calendar-date.ts`) — isti mesec/nedelja/dan obračun, druga primena.
//
// `periodView`/`periodAnchor` su SOPSTVENI parametri ovog prekidača (ne diraju `RealFilterBar`)
// — pamte samo KOJU granularnost/poziciju prekidač trenutno prikazuje, da strelice prethodno/
// sledeće imaju od čega da računaju. Ručna izmena datuma kroz `RealFilterBar` (obična GET forma
// SA SOPSTVENIM poljima, bez ovih import) prirodno "resetuje" prekidač — normalna GET
// navigacija zamenjuje ceo query string poljima te forme, `periodView`/`periodAnchor` se gube
// zajedno sa svime što ta forma ne nosi, što je i namerno: ručan unos ima prednost.
export default function PeriodQuickFilter({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const periodViewRaw = searchParams.periodView;
  const periodView = typeof periodViewRaw === 'string' && ['month', 'week', 'day'].includes(periodViewRaw) ? (periodViewRaw as CalendarView) : null;
  const anchor = typeof searchParams.periodAnchor === 'string' ? searchParams.periodAnchor : todayIso();

  function hrefFor(view: CalendarView, anchorIso: string): string {
    const range = computeRange(view, anchorIso);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (STATE_KEYS.includes(key) || value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) if (v) params.append(key, v);
      } else if (value) {
        params.set(key, value);
      }
    }
    params.set('periodView', view);
    params.set('periodAnchor', anchorIso);
    params.set('stayFrom', range.from);
    params.set('stayTo', range.to);
    return `/rezervacije/lista?${params.toString()}`;
  }

  function clearHref(): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (STATE_KEYS.includes(key) || value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) if (v) params.append(key, v);
      } else if (value) {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return qs ? `/rezervacije/lista?${qs}` : '/rezervacije/lista';
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-panel p-2 text-xs">
      <span className="flex items-center gap-1 text-ink-faint">
        <Icon name="calendar" className="!text-[12px]" /> Brz period:
      </span>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-panel2 p-0.5">
        {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
          <TabLink
            key={v}
            href={hrefFor(v, periodView === v ? anchor : todayIso())}
            label="Lista rezervacija"
            className={`rounded px-2 py-1 ${v === periodView ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:text-ink'}`}
          >
            {VIEW_LABELS[v]}
          </TabLink>
        ))}
      </div>
      {periodView && (
        <>
          <TabLink href={hrefFor(periodView, todayIso())} label="Lista rezervacija" className="rounded border border-border px-2 py-1 hover:border-accent">
            danas
          </TabLink>
          <div className="flex items-center gap-1">
            <TabLink href={hrefFor(periodView, shiftAnchor(periodView, anchor, -1))} label="Lista rezervacija" className="flex h-6 w-6 items-center justify-center rounded border border-border hover:border-accent">
              ‹
            </TabLink>
            <TabLink href={hrefFor(periodView, shiftAnchor(periodView, anchor, 1))} label="Lista rezervacija" className="flex h-6 w-6 items-center justify-center rounded border border-border hover:border-accent">
              ›
            </TabLink>
          </div>
          <span className="font-mono text-ink">{rangeLabel(periodView, anchor)}</span>
          <TabLink href={clearHref()} label="Lista rezervacija" className="ml-auto text-ink-faint hover:text-ink">
            ukloni period
          </TabLink>
        </>
      )}
    </div>
  );
}
