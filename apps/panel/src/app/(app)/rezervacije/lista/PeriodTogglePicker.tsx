'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import ClearableDateRange from '@/components/ClearableDateRange';
import type { BookingFilters } from './RealFilterBar';

// M5 spec v1.6x dopuna (6.9.2026, vlasnikov zahtev: "ikone za kreirane...i ostalo... treba da
// budu UNUTAR POLJA gde se kuca pojam... Po defoltu ukljucite Kreirano od...do") — zamenjuje tri
// STALNO vidljiva polja ("Kreirano od/do", "Dolazak od/do", "Odlazak od/do") trima "čipovima":
// neaktivan cilj je SAMO ikonica (kvadrat=Kreirano, strelica desno=Dolazak, strelica levo=
// Odlazak); klik ga PROŠIRUJE u kalendar sa ISTOM ikonicom kao trajan prefiks UNUTAR iste
// ivice/pozadine (ne odvojeno dugme negde drugde na ekranu — nalaz uz snimak ekrana: "razlikuju
// se polja... ikone treba da budu unutar polja"). Nezavisno biranje (0-3 istovremeno) — potvrđeno
// ranije, "jedan kalendar jedan tag". Podrazumevano AKTIVNO: Kreirano (vlasnikov zahtev), ne
// prazno kao u prethodnom pokušaju.
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
  const [active, setActive] = useState<Set<PeriodTag>>(() => {
    const fromFilters = TAGS.filter((t) => filters[TAG_FIELDS[t].from] || filters[TAG_FIELDS[t].to]);
    return new Set(fromFilters.length > 0 ? fromFilters : ['created']);
  });

  function toggle(tag: PeriodTag) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      {TAGS.map((tag) => {
        const isActive = active.has(tag);
        const { from, to } = TAG_FIELDS[tag];
        return (
          <label key={tag} className="flex flex-col gap-0.5">
            {isActive && <span className="text-xs text-ink-faint">{TAG_TITLE[tag]}</span>}
            <div className={`flex items-center gap-1.5 rounded border px-1.5 ${isActive ? 'border-border bg-panel py-1' : 'border-transparent py-0.5'}`}>
              <button
                type="button"
                onClick={() => toggle(tag)}
                title={TAG_TITLE[tag]}
                className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded ${
                  isActive ? 'bg-brand text-brand-ink' : 'border border-border text-ink-dim hover:border-accent hover:text-ink'
                }`}
              >
                <Icon name={TAG_ICON[tag]} className={tag === 'created' ? '!text-[10px]' : undefined} />
              </button>
              {isActive && (
                <ClearableDateRange
                  nameFrom={from}
                  nameTo={to}
                  defaultFrom={(filters[from] as string) ?? ''}
                  defaultTo={(filters[to] as string) ?? ''}
                  className="w-[110px] border-0 bg-transparent p-0 text-xs outline-none"
                  autoSubmit={autoSubmit}
                />
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
