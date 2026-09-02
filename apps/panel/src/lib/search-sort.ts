// Sortiranje rezultata pretrage (M5 spec §3.0g.8, dizajn dok. §6d.2).
//
// Do 2.9.2026 sortiranje nije postojalo nigde u aplikaciji — rezultati su se prikazivali redom
// kojim stignu, a mock ekrani su interno uvek ređali po ceni rastuće, bez ikakvog izbora za
// korisnika. Nalaz je nastao pri poređenju sa velikim portalima (Booking.com sortira po ceni,
// oceni, udaljenosti i kategoriji; Google Flights po "najjeftinije"/"najbolje").
//
// Pravilo koje se ovde svesno drži: nudi se SAMO ono za šta stvarno postoji podatak. Booking
// ima "po oceni gostiju" i "po udaljenosti od centra" — TT nijedno od toga danas nema kao
// svojstvo proizvoda, pa se te opcije NE prikazuju kao siva, neupotrebljiva dugmad. Kad polja
// budu dodata (M2), ovde se dodaju i opcije.

export interface SortOption {
  value: string;
  label: string;
}

export const DEFAULT_SORT = 'PRICE_ASC';

const COMMON: SortOption[] = [
  { value: 'PRICE_ASC', label: 'najjeftinije' },
  { value: 'PRICE_DESC', label: 'najskuplje' },
  { value: 'NAME_ASC', label: 'naziv A–Š' },
];

/**
 * Opcije sortiranja za aktivnu vrstu proizvoda. Skup se razlikuje jer se i podaci razlikuju —
 * "najkraće trajanje" nema značenje za smeštaj, "kategorija" nema značenje za let.
 */
export function sortOptionsFor(types: string[]): SortOption[] {
  const single = types.length === 1 ? types[0] : null;

  if (single === 'FLIGHT') {
    return [
      // "Najbolje" je isti princip kao Google Flights — kombinacija cene, trajanja i presedanja,
      // ne čista cena. Tačna formula je u `flightBestScore` ispod, namerno na jednom mestu.
      { value: 'BEST', label: 'najbolje' },
      { value: 'PRICE_ASC', label: 'najjeftinije' },
      { value: 'DURATION_ASC', label: 'najkraće' },
      { value: 'DEPART_ASC', label: 'najranije poletanje' },
      { value: 'PRICE_DESC', label: 'najskuplje' },
    ];
  }

  if (single === 'ACCOMMODATION') {
    return [...COMMON, { value: 'STARS_DESC', label: 'kategorija (zvezdice)' }];
  }

  return COMMON;
}

export function isValidSort(value: string | null | undefined, types: string[]): boolean {
  if (!value) return false;
  return sortOptionsFor(types).some((o) => o.value === value);
}

export function resolveSort(value: string | null | undefined, types: string[]): string {
  if (isValidSort(value, types)) return value as string;
  // Letovi nemaju `NAME_ASC`, pa podrazumevano mora biti opcija koja u tom skupu postoji.
  return sortOptionsFor(types).some((o) => o.value === DEFAULT_SORT) ? DEFAULT_SORT : sortOptionsFor(types)[0].value;
}

/**
 * "Najbolje" za letove — niža vrednost je bolja. Cena je osnova, a trajanje i presedanja se
 * naplaćuju kao dodatak na nju, u parama, da bi poređenje ostalo u jednoj jedinici:
 *   +100 para (1 EUR) po minutu puta   — sat duže putovanje "košta" 60 EUR u odluci
 *   +3000 para (30 EUR) po presedanju  — presedanje nosi rizik propuštene veze, ne samo vreme
 * Brojevi su procena za poređenje unutar iste pretrage, ne poslovno pravilo i ne cena — služe
 * isključivo redosledu prikaza. Ako se pokaže da ne odgovaraju načinu na koji tim bira letove,
 * menjaju se ovde, na jednom mestu.
 */
export function flightBestScore(priceCents: number, durationMinutes: number, stops: number): number {
  return priceCents + durationMinutes * 100 + stops * 3000;
}

/** Poređenje naziva po srpskoj azbuci (č/ć/š/ž idu na svoje mesto, ne na kraj). */
export function compareName(a: string, b: string): number {
  return a.localeCompare(b, 'sr-Latn');
}
