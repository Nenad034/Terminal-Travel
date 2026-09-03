// Spisak filter-parametara i njihova primena nad već dobijenim rezultatima (M5 spec §3.0c.2
// tačka 3 i §3.0d.1).
//
// Zašto na trećem, zajedničkom mestu: filteri se UNOSE u levom panelu
// (`SearchSidebarPanel.tsx`), a PRIMENJUJU na tri različita mesta — mock prikazi po vrsti
// proizvoda, pravi rezultati `GET /search`, i mapa. Dok je isti spisak ključeva stajao prepisan
// u svakom od njih, dodavanje jednog filtera značilo je izmenu na četiri mesta i tiho
// razilaženje čim se neko preskoči.
//
// Podela na `SCALAR_FILTER_KEYS` i `MULTI_FILTER_KEYS` nije kozmetička: višestruki parametar se
// u adresi ponavlja (`boardTypes=BB&boardTypes=HB`), pa se mora čitati preko `getAll`. Jedan
// `Record<string, string>` bi tiho zadržao samo poslednju vrednost.

/** Filteri sa jednom vrednošću. Prazan string znači „bez filtera" i briše se iz adrese. */
export const SCALAR_FILTER_KEYS = [
  'priceMin', 'priceMax', 'availability',
  // M5 spec §3.0d.1 — filteri letova.
  'stops', 'maxLayover', 'maxDuration', 'departFrom', 'departTo', 'arriveFrom', 'arriveTo', 'minCheckedBags',
] as const;

/** Filteri sa više izabranih vrednosti. Prazan niz znači „sve". */
export const MULTI_FILTER_KEYS = ['amenityTags', 'boardTypes', 'airlines', 'connAirports'] as const;

export const ALL_FILTER_KEYS: string[] = [...SCALAR_FILTER_KEYS, ...MULTI_FILTER_KEYS];

/** Isti oblik čitanja kao `useSearchParams()`, da isti pomoćnici rade i nad adresom i nad stanjem. */
export interface FilterReader {
  get: (key: string) => string | null;
  getAll: (key: string) => string[];
}

/** Koliko je filtera aktivno — broj koji stoji uz „poništi filtere" u levom panelu. */
export function countActiveFilters(r: FilterReader): number {
  let n = 0;
  for (const key of SCALAR_FILTER_KEYS) if ((r.get(key) ?? '').trim()) n++;
  for (const key of MULTI_FILTER_KEYS) n += r.getAll(key).length;
  return n;
}

/**
 * Filteri koji se primenjuju nad PONUDAMA proizvoda, ne nad proizvodom kao celinom: proizvod
 * ostaje u rezultatu ako mu bar jedna ponuda prođe (M5 §3.0b.2 — proizvod bez ijedne ponude se
 * ne prikazuje). Cena je u najmanjoj jedinici valute, kao svuda u M5.
 */
export interface OfferLike {
  finalPrice: number;
  availabilityStatus: string;
  boardType?: string | null;
}

export function offerMatches(
  o: OfferLike,
  f: { priceMin: number | null; priceMax: number | null; availability: string | null; boardTypes: string[] },
): boolean {
  if (f.priceMin !== null && o.finalPrice < f.priceMin) return false;
  if (f.priceMax !== null && o.finalPrice > f.priceMax) return false;
  if (f.availability && o.availabilityStatus !== f.availability) return false;
  if (f.boardTypes.length > 0 && !f.boardTypes.includes(o.boardType ?? '')) return false;
  return true;
}

/**
 * Zajednički filteri smeštaja/opšti. Cena se u adresi drži u EVRIMA (ono što korisnik kuca), a
 * u poređenju u CENTIMA — pretvaranje stoji ovde, na jednom mestu, jer je ranije stajalo u
 * `page.tsx` i u svakom mock prikazu posebno.
 */
export function commonFiltersFrom(r: FilterReader) {
  const num = (key: string) => {
    const raw = r.get(key);
    return raw && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };
  const priceMinEur = num('priceMin');
  const priceMaxEur = num('priceMax');
  return {
    priceMin: priceMinEur === null ? null : priceMinEur * 100,
    priceMax: priceMaxEur === null ? null : priceMaxEur * 100,
    availability: r.get('availability') || null,
    boardTypes: r.getAll('boardTypes'),
    amenityTags: r.getAll('amenityTags'),
  };
}

/** Proizvod prolazi samo ako nosi SVAKI traženi sadržaj (I-logika, ista kao na serveru, M5 §3.0c.3). */
export function amenitiesMatch(productAmenities: string[] | null | undefined, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const have = productAmenities ?? [];
  return wanted.every((tag) => have.includes(tag));
}
