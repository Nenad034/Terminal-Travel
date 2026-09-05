import { PRODUCT_ICONS } from '@/lib/search-product-types';

// Deljeno između `page.tsx` (server komponenta — sadržaj izveštaja) i
// `IzvestajiFilterForm.tsx` (klijentska komponenta — filter red, 5.9.2026 dopuna: ceo filter red
// je izdvojen u klijentsku komponentu da bi mogao da se primenjuje ODMAH pri promeni polja, isti
// obrazac kao `rezervacije/lista/RealFilterBar.tsx`).

export const TAB_LABELS = {
  profitabilnost: 'Profitabilnost',
  prodaja: 'Prodaja',
  smestaj: 'Smeštaj',
  dinamicki: 'Dinamički',
  marketing: 'Marketing',
} as const;
export type TabKey = keyof typeof TAB_LABELS;

// Pod-tabovi unutar "Profitabilnost"/"Prodaja" (5.9.2026, vlasnikov zahtev: "izvestaje po
// kategorijama stavite takodje u tabove kako se ne bi skrolovalo na dole").
export const PROFITABILNOST_SUB_LABELS = {
  destinacija: 'Po destinaciji',
  dobavljac: 'Po dobavljaču/provajderu',
  kanal: 'Po kanalu',
} as const;
export type ProfitabilnostSub = keyof typeof PROFITABILNOST_SUB_LABELS;

export const PRODAJA_SUB_LABELS = {
  kanal: 'Po kanalu',
  tip: 'Po tipu proizvoda',
} as const;
export type ProdajaSub = keyof typeof PRODAJA_SUB_LABELS;

export const OCCUPANCY_GROUP_BY = ['room_type', 'board_type', 'stars', 'accommodation_type'] as const;
// Kanal/tip proizvoda kao padajući meni umesto slobodnog teksta (5.9.2026, vlasnikov nalaz uz
// snimak ekrana: "polja u kojima se kuca ne reaguju, a tu treba da vec postoje podaci koji se
// biraju") — vrednosti su poznat, fiksan skup (M5 spec `M5Channel`/M2 `ProductType`), isti
// princip kao `RealFilterBar.tsx`/`CalendarFilterBar.tsx` (ti fajlovi drže sopstvenu kopiju iste
// liste — mala dupliranost, isti obrazac).
export const CHANNEL_OPTIONS = ['B2C_SITE', 'B2B_PORTAL', 'MOBILE', 'INTERNAL_PANEL', 'PHONE', 'MCP_AGENT'] as const;
export const PRODUCT_TYPE_OPTIONS = [
  'ACCOMMODATION',
  'PACKAGE',
  'TRANSFER',
  'EXCURSION',
  'FLIGHT',
  'INSURANCE',
  'TRANSPORT',
  'TICKET',
  'EVENT',
  'CRUISE',
] as const;
export const DYNAMIC_DIMENSIONS = ['destination_country', 'destination_city', 'product_name', 'supplier_name', 'channel', 'subagent_name'] as const;
// Ikonice vrsta proizvoda (5.9.2026, vlasnikov zahtev: "stavi ikone iz pretrage... sve treba da
// ide u tri nivoa Drzava, Mesto, proizvod koji smo odabrali") — ISTE ikonice kao ekran pretrage
// (`PRODUCT_ICONS`, jedan izvor istine). Klik UVEK postavlja isti trodelni niz dimenzija
// (država → mesto → proizvod), filtriran na TU vrstu. Samo ikonice sa nepraznim `types` ulaze
// ovde ("Individualni paketi" je `packageMode` bez sopstvenog `ProductType`).
export const DYNAMIC_DRILLDOWN_DIMS = 'destination_country,destination_city,product_name';
export const DYNAMIC_PRODUCT_ICONS = PRODUCT_ICONS.filter((p) => p.types.length > 0);
// Preostala dva preseta koja NISU vezana za vrstu proizvoda — kanal/dobavljač imaju smisla za
// sve vrste odjednom, ostaju kao pre.
export const DYNAMIC_OTHER_PRESETS = [
  { label: 'Kanal', dims: 'channel', productType: undefined },
  { label: 'Dobavljač', dims: 'supplier_name', productType: undefined },
] as const;

export const DATE_FIELD_LABELS: Record<string, string> = {
  stay_from: 'Dolasci',
  stay_to: 'Odlasci',
  created: 'Kreirano',
};
export const DATE_FIELD_OPTIONS = ['stay_from', 'stay_to', 'created'] as const;
export const SEGMENT_LABELS: Record<string, string> = {
  B2B: 'B2B',
  B2C: 'B2C',
  SUBAGENT: 'Subagenti',
};
export const SEGMENT_OPTIONS = ['B2B', 'B2C', 'SUBAGENT'] as const;

export interface SearchParams {
  tab?: string;
  from?: string;
  to?: string;
  /** Na koje polje se `from`/`to` odnosi — 5.9.2026, vlasnikov zahtev: "dinamicki izvestaj treba
   * da ima datume za filtriranje... Kreirano od...do, Dolasci od...do, Odlasci od...do... Mozete
   * staviti jedan kalendar a ovo gore kao okidace... da ustedimo prostor" — JEDAN par od/do,
   * ovo bira NA ŠTA se odnosi (umesto tri istovremena para kao u Listi rezervacija). */
  dateField?: string;
  /** Segment prodaje — B2B/B2C/Subagenti, tačno jedan aktivan (5.9.2026, vlasnikov zahtev:
   * "treba dodati i fitere Subagenti, B2B, B2C"). */
  segment?: string;
  destinationCountry?: string;
  destinationCity?: string;
  supplierId?: string;
  providerCode?: string;
  channel?: string;
  productType?: string;
  groupBy?: string;
  view?: string;
  sub?: string;
}
