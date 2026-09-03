'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ALL_FILTER_KEYS, MULTI_FILTER_KEYS, countActiveFilters, type FilterReader } from '@/lib/search-filters';

// ŽIVO STANJE FILTERA (M5 spec §3.0c.2 tačka 3, vlasnikova odluka 3.9.2026).
//
// Odluka: klik na filter deluje ODMAH, bez dugmeta. Razlog je tiha greška koju dugme proizvodi —
// agent štiklira tri taga, gleda u listu koja se nije promenila i misli da je to rezultat
// filtriranja; to se ne vidi kao kvar nego kao „nema ponude".
//
// Zašto onda filteri ne žive u adresi kao pre: stranica pretrage je SERVER komponenta, pa svaka
// promena adrese znači nov `GET /search`. Trenutno filtriranje kroz adresu bi značilo jedan
// poziv serveru po štikliranom tagu — sporo, a kod živih M4 provajdera i plaćeno po pozivu.
// Zato živo stanje stoji ovde, na klijentu, i sužava ono što je VEĆ dovučeno; server se ne dira.
//
// Dugme „primeni filtere" OSTAJE (vlasnikova izričita odluka istog dana) i dobija jasan, uži
// posao: upisuje filtere u adresu i time pokreće NOVU pretragu na serveru. To je potrebno kad
// filter mora da važi nad širim skupom nego što je dovučeno, i jedini je način da filteri uđu u
// adresu — dakle u sačuvanu pretragu (§3.0g.2) i u deljiv link.
//
// Provajder mora stajati IZNAD stranice (Shell.tsx), iz istog razloga kao `SearchStateContext` i
// `GroupSearchBuilderContext`: stranica je server komponenta i gubi svako lokalno stanje pri
// svakoj promeni query stringa.

type Values = Record<string, string[]>;

interface SearchFiltersValue extends FilterReader {
  /** Postavlja filter sa jednom vrednošću; prazna vrednost ga uklanja. */
  setScalar: (key: string, value: string) => void;
  /** Uključuje/isključuje jednu vrednost višestrukog filtera. */
  toggleMulti: (key: string, value: string) => void;
  /** Skida sve filtere (i iz živog stanja — ne dira adresu). */
  reset: () => void;
  /** Broj aktivnih filtera, za oznaku uz „poništi filtere". */
  activeCount: number;
  /** Query string samo od filter-parametara — ono što „primeni filtere" šalje u adresu. */
  toQueryString: () => string;
}

const Ctx = createContext<SearchFiltersValue | null>(null);

function valuesFromParams(sp: URLSearchParams): Values {
  const out: Values = {};
  for (const key of ALL_FILTER_KEYS) {
    const all = sp.getAll(key).filter((v) => v !== '');
    if (all.length > 0) out[key] = all;
  }
  return out;
}

/** Otisak filtera u adresi — služi samo za poređenje, ne prikazuje se nigde. */
function fingerprint(v: Values): string {
  return ALL_FILTER_KEYS.map((k) => `${k}=${(v[k] ?? []).join(',')}`).join('&');
}

export function SearchFiltersProvider({ children }: { children: React.ReactNode }) {
  const sp = useSearchParams();
  const fromUrl = useMemo(() => valuesFromParams(new URLSearchParams(sp.toString())), [sp]);
  const [values, setValues] = useState<Values>(fromUrl);

  // Adresa je i dalje polazno stanje: pri učitavanju, pri otvaranju sačuvane pretrage i posle
  // „primeni filtere". Prepisuje se SAMO kad se filteri u adresi stvarno razlikuju od zatečenih
  // — bez ovog poređenja bi svaka promena adrese (npr. prelazak lista/mapa, sortiranje) pobrisala
  // filtere koje je korisnik upravo naštiklirao, a nije ih još poslao serveru.
  const lastUrlPrint = useRef(fingerprint(fromUrl));
  useEffect(() => {
    const print = fingerprint(fromUrl);
    if (print === lastUrlPrint.current) return;
    lastUrlPrint.current = print;
    setValues(fromUrl);
  }, [fromUrl]);

  const api: SearchFiltersValue = {
    get: (key) => values[key]?.[0] ?? null,
    getAll: (key) => values[key] ?? [],
    setScalar: (key, value) =>
      setValues((v) => {
        const next = { ...v };
        if (value.trim() === '') delete next[key];
        else next[key] = [value];
        return next;
      }),
    toggleMulti: (key, value) =>
      setValues((v) => {
        const current = v[key] ?? [];
        const next = { ...v };
        const without = current.filter((x) => x !== value);
        if (without.length === current.length) next[key] = [...current, value];
        else if (without.length === 0) delete next[key];
        else next[key] = without;
        return next;
      }),
    reset: () => setValues({}),
    activeCount: countActiveFilters({ get: (k) => values[k]?.[0] ?? null, getAll: (k) => values[k] ?? [] }),
    toQueryString: () => {
      const out = new URLSearchParams();
      for (const key of ALL_FILTER_KEYS) {
        for (const value of values[key] ?? []) {
          if (MULTI_FILTER_KEYS.includes(key as (typeof MULTI_FILTER_KEYS)[number])) out.append(key, value);
          else out.set(key, value);
        }
      }
      return out.toString();
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSearchFilters(): SearchFiltersValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSearchFilters mora stajati unutar <SearchFiltersProvider> (Shell.tsx).');
  return ctx;
}
