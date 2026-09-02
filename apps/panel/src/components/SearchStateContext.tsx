'use client';

import { createContext, useContext, useRef, useState } from 'react';

// M5 spec §3.0g.3 i §3.0g.4, dizajn dok. §6d.1 — dve stvari koje stranica pretrage sama ne
// može da pamti, jer je server komponenta koja se u potpunosti ponovo renderuje pri svakoj
// promeni query stringa (isti razlog i ista pozicija u Shell.tsx kao GroupSearchBuilderContext):
//
//  1. §3.0g.4 — kriterijumi SVAKE vrste proizvoda, da prelazak sa hotela na letove i nazad ne
//     obriše ono što je već uneto. Bez ovoga ekran je devet odvojenih pretraživača; sa ovim je
//     sastavljač putovanja. Aktivna vrsta i dalje živi u adresi (`searchParams`, nepromenjeno) —
//     ovde se pamte NEAKTIVNE, da bi bilo šta da se vrati u adresu pri povratku na njih.
//  2. §3.0g.3 — snimak prethodnih ponuda, da "Osveži podatke" može da PRIJAVI razliku umesto
//     da tiho zameni cenu. Poređenje je klijentsko, bez novog endpointa (isti princip kao
//     klijentski filteri u §3.0c.2).

export interface OfferSnapshot {
  key: string;
  label: string;
  price: number;
  currency: string;
}

export interface SearchDiff {
  changed: { key: string; label: string; previous: number; current: number; currency: string }[];
  gone: { key: string; label: string; previous: number; currency: string }[];
  added: { key: string; label: string; current: number; currency: string }[];
}

export function emptyDiff(): SearchDiff {
  return { changed: [], gone: [], added: [] };
}

export function diffIsEmpty(d: SearchDiff): boolean {
  return d.changed.length === 0 && d.gone.length === 0 && d.added.length === 0;
}

/**
 * Kriterijumi jedne vrste proizvoda, upakovani kao query string BEZ `type` parametra (npr.
 * `destinationCountry=Gr%C4%8Dka&stayFrom=2026-07-12&amenityTags=POOL_KIDS&amenityTags=PARKING`).
 * Namerno string, a ne objekat: `amenityTags` je višestruk parametar, pa bi `Record<string,string>`
 * tiho odbacio sve osim poslednje vrednosti.
 */
export type SearchCriteria = string;

interface SearchStateValue {
  /** §3.0g.4 — upamćeni kriterijumi po ključu vrste (`types.join('+')`). */
  criteriaFor: (typeKey: string) => SearchCriteria | undefined;
  rememberCriteria: (typeKey: string, criteria: SearchCriteria) => void;
  forgetCriteria: (typeKey: string) => void;
  /** §3.0g.3 — "Osveži podatke" naoruža poređenje, pa pokrene ponovno učitavanje. */
  armRefresh: (typeKey: string) => void;
  /** Poziva prikaz rezultata pri svakom učitavanju; vraća razliku kad je poređenje naoružano. */
  recordOffers: (typeKey: string, offers: OfferSnapshot[]) => SearchDiff | null;
  diff: SearchDiff | null;
  clearDiff: () => void;
}

const SearchStateContext = createContext<SearchStateValue | null>(null);

export function SearchStateProvider({ children }: { children: React.ReactNode }) {
  // Kriterijumi i snimci se ne prikazuju sami po sebi, pa idu u ref — upis u state bi izazvao
  // ponovni render celog Shell-a pri svakoj pretrazi bez ijedne vidljive promene.
  const criteria = useRef<Record<string, SearchCriteria>>({});
  const lastOffers = useRef<Record<string, OfferSnapshot[]>>({});
  const pendingCompare = useRef<Record<string, OfferSnapshot[]>>({});
  const [diff, setDiff] = useState<SearchDiff | null>(null);

  function criteriaFor(typeKey: string) {
    return criteria.current[typeKey];
  }
  function rememberCriteria(typeKey: string, next: SearchCriteria) {
    criteria.current[typeKey] = next;
  }
  function forgetCriteria(typeKey: string) {
    delete criteria.current[typeKey];
    delete lastOffers.current[typeKey];
    delete pendingCompare.current[typeKey];
  }

  function armRefresh(typeKey: string) {
    pendingCompare.current[typeKey] = lastOffers.current[typeKey] ?? [];
    setDiff(null);
  }

  function recordOffers(typeKey: string, offers: OfferSnapshot[]): SearchDiff | null {
    const previous = pendingCompare.current[typeKey];
    lastOffers.current[typeKey] = offers;
    if (!previous) return null;
    delete pendingCompare.current[typeKey];

    const before = new Map(previous.map((o) => [o.key, o]));
    const after = new Map(offers.map((o) => [o.key, o]));
    const next = emptyDiff();

    for (const [key, o] of after) {
      const old = before.get(key);
      if (!old) next.added.push({ key, label: o.label, current: o.price, currency: o.currency });
      else if (old.price !== o.price) {
        next.changed.push({ key, label: o.label, previous: old.price, current: o.price, currency: o.currency });
      }
    }
    for (const [key, o] of before) {
      if (!after.has(key)) next.gone.push({ key, label: o.label, previous: o.price, currency: o.currency });
    }

    setDiff(next);
    return next;
  }

  function clearDiff() {
    setDiff(null);
  }

  return (
    <SearchStateContext.Provider
      value={{ criteriaFor, rememberCriteria, forgetCriteria, armRefresh, recordOffers, diff, clearDiff }}
    >
      {children}
    </SearchStateContext.Provider>
  );
}

export function useSearchState() {
  const ctx = useContext(SearchStateContext);
  if (!ctx) throw new Error('useSearchState mora biti unutar SearchStateProvider');
  return ctx;
}
