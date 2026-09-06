'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import ClearableTextField from '@/components/ClearableTextField';
import type { BookingFilters } from './RealFilterBar';

// M5 spec v1.6x dopuna (6.9.2026, vlasnikov zahtev: "ikone za pretragu drzava, mesta... treba da
// budu UNUTAR POLJA gde se kuca pojam... za drugu pretragu [ukljucite] Drzavu") — isti obrazac
// kao `PeriodTogglePicker.tsx`: neaktivan cilj je SAMO ikonica (globus=Država, pribadača=Mesto,
// kuća=Objekat/hotel); klik ga proširuje u tekstualno polje sa ISTOM ikonicom kao trajan prefiks
// UNUTAR iste ivice/pozadine (ne odvojeno dugme negde drugde na ekranu). Nezavisno biranje (0-3
// istovremeno) — pozadinski deo već ume da kombinuje sve tri (M5 spec v2.39). Podrazumevano
// AKTIVNO: Država (vlasnikov zahtev), ne prazno kao u prethodnom pokušaju.
type LocationTarget = 'destinationCountry' | 'destinationCity' | 'productName';
const TARGETS: LocationTarget[] = ['destinationCountry', 'destinationCity', 'productName'];
const TARGET_ICON: Record<LocationTarget, string> = { destinationCountry: 'globe', destinationCity: 'location', productName: 'home' };
const TARGET_LABEL: Record<LocationTarget, string> = { destinationCountry: 'Država', destinationCity: 'Mesto', productName: 'Objekat (hotel)' };
const TARGET_PLACEHOLDER: Record<LocationTarget, string> = { destinationCountry: 'npr. Grčka', destinationCity: 'npr. Budva', productName: 'naziv hotela' };

export default function LocationOrHotelField({
  filters,
  autoSubmit,
}: {
  filters: BookingFilters;
  /** `false` unutar modala/ladice "Detaljna pretraga" — isti princip kao ostala polja tamo. */
  autoSubmit: boolean;
}) {
  const [active, setActive] = useState<Set<LocationTarget>>(() => {
    const fromFilters = TARGETS.filter((t) => filters[t]);
    return new Set(fromFilters.length > 0 ? fromFilters : ['destinationCountry']);
  });

  function toggle(target: LocationTarget) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      {TARGETS.map((t) => {
        const isActive = active.has(t);
        return (
          <label key={t} className="flex flex-col gap-0.5">
            {isActive && <span className="text-xs text-ink-faint">{TARGET_LABEL[t]}</span>}
            <div className={`flex items-center gap-1.5 rounded border px-1.5 ${isActive ? 'border-border bg-panel py-1' : 'border-transparent py-0.5'}`}>
              <button
                type="button"
                onClick={() => toggle(t)}
                title={TARGET_LABEL[t]}
                className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded ${
                  isActive ? 'bg-brand text-brand-ink' : 'border border-border text-ink-dim hover:border-accent hover:text-ink'
                }`}
              >
                <Icon name={TARGET_ICON[t]} />
              </button>
              {isActive && (
                <ClearableTextField
                  name={t}
                  defaultValue={filters[t] ?? ''}
                  placeholder={TARGET_PLACEHOLDER[t]}
                  className="w-[130px] border-0 bg-transparent p-0 text-xs outline-none"
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
