'use client';

import { useState } from 'react';
import ClearableTextField from '@/components/ClearableTextField';
import type { BookingFilters } from './RealFilterBar';

// M5 spec v1.6x dopuna (6.9.2026, vlasnikov zahtev: "Polja za filtriranje Drzave, destinacije i
// hotela stavite da bude jedno ali iznad stavite tri multiselect okidaca Drzava, Mesto, Hotel")
// — isti princip kao "odnosi se na" (Dolasci/Odlasci/Kreirano) na Izveštajima: JEDNO tekstualno
// polje, tri dugmeta iznad biraju NA KOJE od tri stvarna `GET /sales/bookings` polja se ono
// odnosi (`destinationCountry`/`destinationCity`/`productName` — poslednje je isti parametar koji
// već koristi "Naziv hotela" na `rezervacije/kalendar/CalendarFilterBar.tsx`, ovde prvi put stiže
// i do Liste rezervacija). Namerna razlika u odnosu na ranija tri odvojena polja: sad se NE mogu
// kombinovati država+mesto istovremeno — vlasnikov izričit zahtev ("da bude jedno"), ne previd.
//
// `key={target}` na `ClearableTextField` ispod je namerno — REMOUNT pri promeni cilja (ne
// kontrolisano polje, `ClearableTextField` je uncontrolled/ref-zasnovano) osigurava DVE stvari
// odjednom: (1) prikazana vrednost postaje ona koju `filters` već ima za NOVI cilj (ako je
// korisnik ranije filtrirao po toj dimenziji), (2) DOM input prethodnog cilja se UKLANJA iz forme
// pri promeni — nema potrebe za praznim skrivenim poljima da "obrišu" preostala dva, uklonjen
// element se prosto ne šalje pri submit-u.
type LocationTarget = 'destinationCountry' | 'destinationCity' | 'productName';
const TARGETS: LocationTarget[] = ['destinationCountry', 'destinationCity', 'productName'];
const TARGET_LABELS: Record<LocationTarget, string> = {
  destinationCountry: 'Država',
  destinationCity: 'Mesto',
  productName: 'Hotel',
};

export default function LocationOrHotelField({
  filters,
  autoSubmit,
}: {
  filters: BookingFilters;
  /** `false` unutar modala "Detaljna pretraga" — isti princip kao ostala polja tamo. */
  autoSubmit: boolean;
}) {
  const [target, setTarget] = useState<LocationTarget>(() => TARGETS.find((t) => filters[t]) ?? 'destinationCountry');

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex overflow-hidden rounded border border-border text-[11px]">
        {TARGETS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTarget(t)}
            className={`flex-1 px-2 py-1 font-medium ${i > 0 ? 'border-l border-border' : ''} ${
              target === t ? 'bg-accent-soft text-accent-strong' : 'text-ink-dim hover:bg-panel2'
            }`}
          >
            {TARGET_LABELS[t]}
          </button>
        ))}
      </div>
      <ClearableTextField
        key={target}
        name={target}
        defaultValue={filters[target] ?? ''}
        placeholder={target === 'destinationCity' ? 'npr. Budva' : target === 'destinationCountry' ? 'npr. Grčka' : 'naziv hotela'}
        className="input text-xs"
        autoSubmit={autoSubmit}
      />
    </div>
  );
}
