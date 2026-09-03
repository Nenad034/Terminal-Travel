'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import { sortOptionsFor, resolveSort } from '@/lib/search-sort';
import { QuickFilterDivider, RefundableQuickFilter, StarsQuickFilter } from './SearchQuickFilters';

// Srpska promena broja: 1 rezultat, 2–4 rezultata, 5+ rezultata — s tim da 11–14 idu kao 5+
// ("11 rezultata", ne "11 rezultat"). Bez ovoga je pisalo "1 rezultata".
function resultLabel(n: number): string {
  const last2 = n % 100;
  const last = n % 10;
  if (last === 1 && last2 !== 11) return `${n} rezultat`;
  return `${n} rezultata`;
}

// Traka za sortiranje rezultata (M5 spec §3.0g.8, dizajn dok. §6d.2). Stoji IZNAD rezultata u
// centralnom panelu, ne u levom panelu među filterima — sortiranje i filtriranje su dve različite
// radnje: filter menja KOJI se rezultati vide, sortiranje samo REDOSLED. Isti razlog zašto je i
// na velikim portalima traka nad listom, a ne stavka u bočnom meniju.
//
// Dugmad, ne padajući meni — dizajn dok. §6f (mali, poznat skup opcija).
//
// Dopuna 3.9.2026 (vlasnikov zahtev: „stavite u jedan red filtere iznad rezultata pretrage i
// odvojite ih vertikalnom linijom") — brzi filteri (§3.0c.3a/§3.0c.3c) su prvo dobili sopstven
// red iznad ovog; sad stoje U OVOM redu, levo od sortiranja, razdvojeni uspravnom crtom. Traka
// je time jedna, a ne dve — dva reda su nad listom rezultata trošila visinu koju mapa i kartice
// stvarno koriste. Crta razdvaja grupe koje rade RAZLIČIT posao (filter menja koji se rezultati
// vide, sortiranje samo redosled) — bez nje bi red od dvanaest pilula izgledao kao jedan skup.
export default function SortBar({
  resultCount,
  mapAvailable,
  showRefundable,
  showStars,
}: {
  resultCount: number;
  mapAvailable: boolean;
  /** §3.0c.3a — prekidač se nudi samo gde podatak postoji; odlučuje stranica. */
  showRefundable: boolean;
  showStars: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const types = sp.getAll('type');
  const options = sortOptionsFor(types);
  const current = resolveSort(sp.get('sort'), types);

  const view = sp.get('prikaz') === 'mapa' ? 'mapa' : 'lista';

  function pick(value: string) {
    const next = new URLSearchParams(sp.toString());
    next.set('sort', value);
    router.push(`/rezervacije/pretraga?${next.toString()}`);
  }

  // M5 spec §3.0h — prekidač lista/mapa. Stanje ide u adresu, ne u lokalno stanje: tako
  // zatvoren tab može sutra da se otvori na istom prikazu (isti princip kao kriterijumi
  // pretrage, §3.0g.4).
  function pickView(next: 'lista' | 'mapa') {
    const params = new URLSearchParams(sp.toString());
    if (next === 'lista') params.delete('prikaz');
    else params.set('prikaz', 'mapa');
    router.push(`/rezervacije/pretraga?${params.toString()}`);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
      {showRefundable && (
        <>
          <RefundableQuickFilter />
          <QuickFilterDivider />
        </>
      )}
      {showStars && (
        <>
          <StarsQuickFilter />
          <QuickFilterDivider />
        </>
      )}
      <span className="flex items-center gap-1 text-ink-faint">
        <Icon name="list-ordered" /> sortiraj:
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => pick(o.value)}
            // Jednostruk izbor (dizajn dok. §6f): klik na već aktivno dugme ga NE deselektuje —
            // lista uvek mora imati neki redosled, "nesortirano" nije smisleno stanje.
            aria-pressed={current === o.value}
            className={`rounded-full border px-2 py-0.5 ${
              current === o.value
                ? 'border-accent bg-accent-soft font-semibold text-accent-strong'
                : 'border-border text-ink-dim hover:border-accent hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        {resultCount > 0 && <span className="text-ink-faint">{resultLabel(resultCount)}</span>}
        {mapAvailable && (
          <div className="flex overflow-hidden rounded-full border border-border">
            {(['lista', 'mapa'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => pickView(v)}
                aria-pressed={view === v}
                className={`flex items-center gap-1 px-2.5 py-0.5 ${
                  view === v ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-ink-dim hover:text-ink'
                }`}
              >
                <Icon name={v === 'lista' ? 'list-flat' : 'location'} /> {v}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
