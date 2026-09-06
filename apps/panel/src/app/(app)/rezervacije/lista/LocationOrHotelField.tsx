'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import ClearableTextField from '@/components/ClearableTextField';
import type { BookingFilters } from './RealFilterBar';

// M5 spec v1.6x dopuna (6.9.2026, vlasnikov zahtev: "Polja za filtriranje Drzave, destinacije i
// hotela stavite da bude jedno... u jedno polje postavite ikone za drzavu, mesto i hotel. klikom
// na jedan ili vise definisemo nivoe pretrage") — ISTI princip kao `PeriodTogglePicker.tsx`
// (K/D/O): tri ikonice, NEZAVISNO biranje (0 do 3 istovremeno aktivne — vlasnik je eksplicitno
// tražio višestruki izbor, ne isključiv kao prvobitni pokušaj istog dana), svaki aktivan cilj
// dobija SVOJE tekstualno polje. Pozadinski deo (`GET /sales/bookings`) već ume da kombinuje sve
// tri istovremeno (`itemWhere.product = {destinationCountry, destinationCity, translations...}`,
// M5 spec v2.39) — ovde se menja isključivo prikaz, bez ijedne API izmene.
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
  const [active, setActive] = useState<Set<LocationTarget>>(() => new Set(TARGETS.filter((t) => filters[t])));

  function toggle(target: LocationTarget) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex gap-1">
        {TARGETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            title={TARGET_LABEL[t]}
            className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded ${
              active.has(t) ? 'bg-brand text-brand-ink' : 'border border-border text-ink-dim hover:border-accent hover:text-ink'
            }`}
          >
            <Icon name={TARGET_ICON[t]} />
          </button>
        ))}
      </div>
      {TARGETS.filter((t) => active.has(t)).map((t) => (
        <label key={t} className="flex flex-col gap-0.5">
          <span className="text-xs text-ink-faint">{TARGET_LABEL[t]}</span>
          <ClearableTextField
            name={t}
            defaultValue={filters[t] ?? ''}
            placeholder={TARGET_PLACEHOLDER[t]}
            className="input text-xs"
            autoSubmit={autoSubmit}
          />
        </label>
      ))}
    </div>
  );
}
