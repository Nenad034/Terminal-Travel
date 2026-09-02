'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import { sortOptionsFor, resolveSort } from '@/lib/search-sort';

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
export default function SortBar({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  const types = sp.getAll('type');
  const options = sortOptionsFor(types);
  const current = resolveSort(sp.get('sort'), types);

  function pick(value: string) {
    const next = new URLSearchParams(sp.toString());
    next.set('sort', value);
    router.push(`/rezervacije/pretraga?${next.toString()}`);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
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
      {resultCount > 0 && <span className="ml-auto text-ink-faint">{resultLabel(resultCount)}</span>}
    </div>
  );
}
