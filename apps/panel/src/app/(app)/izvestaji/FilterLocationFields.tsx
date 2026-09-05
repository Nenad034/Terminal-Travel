'use client';

import { useState } from 'react';
import SuggestField, { type Suggestion } from '@/components/SuggestField';
import FieldInline from './FieldInline';

// M13 spec §7 dopuna (5.9.2026, vlasnikov nalaz uz snimak ekrana: "polja u kojima se kuca ne
// reaguju, a tu treba da vec postoje podaci koji se biraju") — država/destinacija u filteru
// izveštaja su bila prosta slobodna polja (`<input>`), bez ikakvog predloga iako isti podaci (M2
// destinacije) već postoje i imaju gotov predlagač na ekranu pretrage (`SuggestField.tsx`,
// `/api/search-suggest`). Isti obrazac kao "Naziv hotela" u `CalendarFilterBar.tsx` — kontrolisan
// `SuggestField` + skriveno polje da ISTA prava GET forma i dalje ponese vrednost pri "primeni
// filter" (`izvestaji/page.tsx` ostaje server komponenta). Država i destinacija dele stanje u
// OVOM komponenti (ne dva odvojena fajla) jer `GET /sales/search/destinations` zahteva `country`
// — bez toga predlog destinacija nema odakle da krene.
const inputClassName = 'w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-ink-faint';

async function suggestCountries(q: string): Promise<Suggestion[]> {
  const res = await fetch(`/api/search-suggest?kind=countries${q ? `&q=${encodeURIComponent(q)}` : ''}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const rows = (await res.json()) as { country: string; count: number }[];
  return rows.map((r) => ({ value: r.country, label: r.country, hint: `${r.count}` }));
}

async function suggestDestinations(country: string, q: string): Promise<Suggestion[]> {
  if (!country.trim()) return [];
  const params = new URLSearchParams({ kind: 'destinations', country });
  if (q) params.set('q', q);
  const res = await fetch(`/api/search-suggest?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const rows = (await res.json()) as { city: string; country: string; count: number }[];
  return rows.map((r) => ({ value: r.city, label: r.city, hint: r.country }));
}

export default function FilterLocationFields({ initialCountry, initialCity }: { initialCountry: string; initialCity: string }) {
  const [country, setCountry] = useState(initialCountry);
  const [city, setCity] = useState(initialCity);

  return (
    <>
      <FieldInline label="država">
        <input type="hidden" name="destinationCountry" value={country} />
        <SuggestField
          value={country}
          onChange={(next) => {
            setCountry(next);
            if (next !== country) setCity('');
          }}
          fetchSuggestions={suggestCountries}
          placeholder="bilo koja"
          inputClassName={inputClassName}
        />
      </FieldInline>
      <FieldInline label="destinacija">
        <input type="hidden" name="destinationCity" value={city} />
        <SuggestField
          value={city}
          onChange={setCity}
          fetchSuggestions={(q) => suggestDestinations(country, q)}
          placeholder={country.trim() ? 'bilo koja' : 'prvo izaberite državu'}
          disabled={!country.trim()}
          disabledHint="prvo izaberite državu"
          inputClassName={inputClassName}
        />
      </FieldInline>
    </>
  );
}
