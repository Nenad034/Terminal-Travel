// Oblik odgovora `GET /sales/search` (M5 spec §11), onako kako ga ekran pretrage koristi.
//
// Izdvojeno iz `page.tsx` 3.9.2026: otkako filtriranje i sortiranje rade na klijentu
// (`RealResults.tsx`, vlasnikova odluka o trenutnom filtriranju), isti tip treba i server
// komponenti koja podatke dovlači i klijentskoj koja ih prikazuje. Prepisan tip na dva mesta bi
// se razišao pri prvoj izmeni odgovora.

export interface SearchOffer {
  roomTypeCode?: string;
  roomTypeName?: string;
  boardType?: string;
  finalPrice: number;
  finalPriceCurrency: string;
  availabilityStatus: string;
  rateLineId?: string;
  providerQuoteReference?: string;
  quoteExpiresAt?: string;
  cancellationPolicySummary?: string;
}

export interface SearchResult {
  productId: string;
  type: string;
  sourceType: string;
  name: string;
  destinationCountry: string;
  destinationCity: string;
  /** M5 spec §3.0b.1 — koordinate za mapu. `GET /sales/search` ih vraća kao BROJ (servis
   * pretvara iz `Decimal`), za razliku od `GET /catalog/products/:id` koji vraća string. */
  geoLat: number | null;
  geoLng: number | null;
  /** M2 §2.3c `AmenityTag[]` — sadržaji objekta, za filtriranje bez ponovne pretrage (§3.0c.3).
   * `null`/izostavljeno za tipove koji nemaju sadržaje (let, transfer). */
  amenities?: string[] | null;
  shortDescription?: string;
  thumbnail?: { url: string; category: string } | null;
  offers: SearchOffer[];
}
