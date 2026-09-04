'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
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
// Padajući meni, ne red dugmadi — IZUZETAK od §6f, upisan u dizajn dok. §6d.2 (4.9.2026, na
// zahtev vlasnika: "sortiranje u rezultatima pretrage stavite u dropdown modul... ovo je na
// laptopu, nisam primetio na velikim monitorima"). Pravilo §6f ("mali skup → dugmad") bira se
// zbog broja opcija; ovde je presudila ŠIRINA: u istom redu već stoje brzi filteri i prekidač
// lista/mapa, pa su četiri pilule sortiranja na laptopu (~1366px, uz otvoren levi panel) trpale
// traku do ivice. Dugmad su i dalje ispravna za skupove koji stoje sami u redu — menja se samo
// ovaj slučaj, ne pravilo.
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

  const [sortOpen, setSortOpen] = useState(false);

  const types = sp.getAll('type');
  const options = sortOptionsFor(types);
  const current = resolveSort(sp.get('sort'), types);
  const currentLabel = options.find((o) => o.value === current)?.label ?? options[0]?.label ?? '';

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
      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            // Izabrani redosled stoji NA dugmetu, ne samo unutar otvorenog menija — zatvoren
            // meni inače krije po čemu je lista poređana, a to je podatak koji agent čita u
            // toku razgovora sa gostom.
            className="h-7 gap-1 bg-panel px-2.5 text-xs font-normal"
            aria-label={`sortiraj: ${currentLabel}`}
          >
            <Icon name="list-ordered" className="text-ink-faint" />
            <span className="text-ink-faint">sortiraj:</span>
            <span className="font-semibold text-accent-strong">{currentLabel}</span>
            <Icon name="chevron-down" className="text-ink-faint" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52 p-1">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                pick(o.value);
                setSortOpen(false);
              }}
              // Jednostruk izbor: klik na već aktivnu stavku ne poništava redosled — lista uvek
              // mora imati neki, "nesortirano" nije smisleno stanje.
              aria-pressed={current === o.value}
              className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs ${
                current === o.value ? 'bg-accent-soft font-semibold text-accent-strong' : 'text-ink-dim hover:bg-panel2 hover:text-ink'
              }`}
            >
              <span className="truncate">{o.label}</span>
              {current === o.value && <Icon name="check" className="text-accent-strong" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>
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
