'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { computeRange, rangeLabel, shiftAnchor, todayIso, type CalendarView } from '@/lib/calendar-date';

const VIEW_LABELS: Record<CalendarView, string> = { month: 'Mesec', week: 'Nedelja', day: 'Dan' };
const STATE_KEYS = ['stayFrom', 'stayTo', 'periodView', 'periodAnchor'];

// Brz period (Dan/Nedelja/Mesec + prethodni/sledeći), na zahtev vlasnika 27.8.2026: "pregled na
// dnevnom mesečnom i nedeljnom nivou staviti i u listu rezervacija" — potvrđeno preko
// `AskUserQuestion`: BRZI FILTER perioda (postavlja `stayFrom`/`stayTo`, iste vrednosti koje
// `RealFilterBar.tsx` već prihvata kao ručna polja "Dolazak od/do"), NE nov način prikaza redova.
//
// ISPRAVKA #2 (isti dan — na zahtev vlasnika, uz snimak ekrana: "nisam mislio tu vec u prvi red
// brzih filtera koji je uvek vidljiv") — prva ispravka je ovaj prekidač ubacila u gornji red
// `RealFilterBar.tsx` forme, ali ta forma NIJE uvek vidljiva (sklanja se dugmetom −/+ u
// `BookingsListClient.tsx`, v. komentar tamo "Uklanjanje/vraćanje filtera"). Vlasnik je mislio na
// TRAKU IKONICA u `BookingsListClient.tsx` koja je `sticky`/uvek vidljiva — prekidač se sada
// montira TAMO (pored +10/−10 tagova, odvojen razdelnikom kao posebna celina), zato je ovde
// samostalna komponenta bez `searchParams` propa — čita/piše URL direktno preko
// `useSearchParams`/`useRouter`, isti obrazac kao susedni `DateRangeTag` u istom fajlu.
export default function PeriodQuickFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const periodViewRaw = searchParams.get('periodView');
  const periodView = periodViewRaw && ['month', 'week', 'day'].includes(periodViewRaw) ? (periodViewRaw as CalendarView) : null;
  const anchor = searchParams.get('periodAnchor') ?? todayIso();

  function go(view: CalendarView, anchorIso: string) {
    const range = computeRange(view, anchorIso);
    const params = new URLSearchParams(searchParams.toString());
    params.set('periodView', view);
    params.set('periodAnchor', anchorIso);
    params.set('stayFrom', range.from);
    params.set('stayTo', range.to);
    router.push(`/rezervacije/lista?${params.toString()}`);
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of STATE_KEYS) params.delete(k);
    const qs = params.toString();
    router.push(qs ? `/rezervacije/lista?${qs}` : '/rezervacije/lista');
  }

  return (
    <div className="flex items-center gap-1">
      {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
        <button
          key={v}
          onClick={() => go(v, periodView === v ? anchor : todayIso())}
          title={`Prikaz po ${VIEW_LABELS[v].toLowerCase()}u`}
          className={`flex h-[26px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${
            v === periodView ? 'border-accent bg-accent-soft text-accent-strong' : 'border-ink-faint text-ink-faint hover:border-accent hover:text-ink'
          }`}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
      {periodView && (
        <>
          <button
            onClick={() => go(periodView, shiftAnchor(periodView, anchor, -1))}
            title="Prethodni period"
            className="flex h-[26px] w-[22px] items-center justify-center rounded text-ink-faint hover:bg-panel2 hover:text-ink"
          >
            ‹
          </button>
          <span className="whitespace-nowrap font-mono text-[11px] text-ink">{rangeLabel(periodView, anchor)}</span>
          <button
            onClick={() => go(periodView, shiftAnchor(periodView, anchor, 1))}
            title="Sledeći period"
            className="flex h-[26px] w-[22px] items-center justify-center rounded text-ink-faint hover:bg-panel2 hover:text-ink"
          >
            ›
          </button>
          <button onClick={clear} title="Ukloni brzi period" className="flex h-[26px] w-[22px] items-center justify-center rounded text-ink-faint hover:text-danger">
            ✕
          </button>
        </>
      )}
    </div>
  );
}
