'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import ClearableDateRange from '@/components/ClearableDateRange';
import type { BookingFilters } from './RealFilterBar';

// M5 spec v1.6x dopuna (6.9.2026, vlasnikov zahtev: "u polju gde otvaramo kalendar na pocetku
// stavite tri taga KDO... Umesto KDO stavite ikonu strelice... dolazak strelica u desno, odlazak
// strelica u levo a kreirano Kvadrat... kada odaberemo dva ili tri taga tada se otvaraju
// [onoliko] kalendara. Jedan kalendar jedan tag.") — zamenjuje tri STALNO vidljiva polja
// ("Kreirano od/do", "Dolazak od/do", "Odlazak od/do") trima tagovima koji se biraju NEZAVISNO
// (0 do 3 istovremeno aktivna, ne isključivo kao "odnosi se na" na Izveštajima — tamo je jedan
// izveštaj uvek po JEDNOM kriterijumu, ovde rezervacija ima smisla filtrirati po više odjednom).
// Svaki AKTIVAN tag dobija SVOJ kalendar (`ClearableDateRange`, isti kao ranije) — potvrđeno
// vlasnikovim odgovorom "zaboravite [spajanje u jedan opseg], to smo rešili sa tačkom 3" (dva
// aktivna taga = dva ODVOJENA kalendara, ne jedan sa dve tačke).
type PeriodTag = 'created' | 'stay' | 'return';
const TAG_FIELDS: Record<PeriodTag, { from: keyof BookingFilters; to: keyof BookingFilters }> = {
  created: { from: 'createdFrom', to: 'createdTo' },
  stay: { from: 'stayFrom', to: 'stayTo' },
  return: { from: 'returnFrom', to: 'returnTo' },
};
const TAG_ICON: Record<PeriodTag, string> = { created: 'primitive-square', stay: 'arrow-right', return: 'arrow-left' };
const TAG_TITLE: Record<PeriodTag, string> = { created: 'Kreirano od/do', stay: 'Dolazak od/do', return: 'Odlazak od/do' };
const TAGS: PeriodTag[] = ['created', 'stay', 'return'];

export default function PeriodTogglePicker({ filters, autoSubmit }: { filters: BookingFilters; autoSubmit: boolean }) {
  const [active, setActive] = useState<Set<PeriodTag>>(
    () => new Set(TAGS.filter((t) => filters[TAG_FIELDS[t].from] || filters[TAG_FIELDS[t].to])),
  );

  function toggle(tag: PeriodTag) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex gap-1">
        {TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            title={TAG_TITLE[tag]}
            className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded ${
              active.has(tag) ? 'bg-brand text-brand-ink' : 'border border-border text-ink-dim hover:border-accent hover:text-ink'
            }`}
          >
            <Icon name={TAG_ICON[tag]} className={tag === 'created' ? '!text-[10px]' : undefined} />
          </button>
        ))}
      </div>
      {TAGS.filter((t) => active.has(t)).map((tag) => {
        const { from, to } = TAG_FIELDS[tag];
        return (
          <label key={tag} className="flex flex-col gap-0.5">
            <span className="text-xs text-ink-faint">{TAG_TITLE[tag]}</span>
            <ClearableDateRange
              nameFrom={from}
              nameTo={to}
              defaultFrom={(filters[from] as string) ?? ''}
              defaultTo={(filters[to] as string) ?? ''}
              className="input text-xs"
              autoSubmit={autoSubmit}
            />
          </label>
        );
      })}
    </div>
  );
}
