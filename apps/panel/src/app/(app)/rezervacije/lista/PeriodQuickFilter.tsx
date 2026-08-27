'use client';

import TabLink from '@/components/TabLink';
import { computeRange, rangeLabel, shiftAnchor, todayIso, type CalendarView } from '@/lib/calendar-date';

const VIEW_LABELS: Record<CalendarView, string> = { month: 'Mesec', week: 'Nedelja', day: 'Dan' };
const STATE_KEYS = ['stayFrom', 'stayTo', 'periodView', 'periodAnchor'];

// Brz period (Dan/Nedelja/Mesec + danas/strelice), na zahtev vlasnika 27.8.2026: "pregled na
// dnevnom mesečnom i nedeljnom nivou staviti i u listu rezervacija" — potvrđeno preko
// `AskUserQuestion`: BRZI FILTER perioda (postavlja `stayFrom`/`stayTo`, iste vrednosti koje
// `RealFilterBar.tsx` već prihvata kao ručna polja "Dolazak od/do"), NE nov način prikaza
// redova (tabela ostaje nepromenjena).
//
// ISPRAVKA (isti dan, drugi krug — na zahtev vlasnika: "dodali ste bez razloga još jedan red
// filtera, ubacite brzi filter... u gornji red brzih filtera, odvojene po celinama") — ovaj
// komponent VIŠE NE nosi sopstvenu bordovanu traku/red; `RealFilterBar.tsx` ga ubacuje kao
// `quickPeriod` prop, PRVA "celina" u istom gornjem redu ostalih brzih filtera, razdvojena
// samo tankom vertikalnom linijom (`border-r`) — ne novim redom.
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
    <div className="flex flex-shrink-0 items-end gap-2 border-r border-border pr-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-ink-faint">Period</span>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-panel2 p-0.5">
          {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
            <TabLink
              key={v}
              href={hrefFor(v, periodView === v ? anchor : todayIso())}
              label="Lista rezervacija"
              className={`rounded px-2 py-1 text-xs ${v === periodView ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:text-ink'}`}
            >
              {VIEW_LABELS[v]}
            </TabLink>
          ))}
        </div>
      </div>
      {periodView && (
        <div className="flex items-center gap-1 pb-[3px] text-xs">
          <TabLink href={hrefFor(periodView, todayIso())} label="Lista rezervacija" className="rounded border border-border px-1.5 py-1 hover:border-accent">
            danas
          </TabLink>
          <TabLink href={hrefFor(periodView, shiftAnchor(periodView, anchor, -1))} label="Lista rezervacija" className="flex h-6 w-6 items-center justify-center rounded border border-border hover:border-accent">
            ‹
          </TabLink>
          <TabLink href={hrefFor(periodView, shiftAnchor(periodView, anchor, 1))} label="Lista rezervacija" className="flex h-6 w-6 items-center justify-center rounded border border-border hover:border-accent">
            ›
          </TabLink>
          <span className="whitespace-nowrap font-mono text-ink">{rangeLabel(periodView, anchor)}</span>
          <TabLink href={clearHref()} label="Lista rezervacija" className="text-ink-faint hover:text-danger">
            ✕
          </TabLink>
        </div>
      )}
    </div>
  );
}
