// M5 spec §3.0b — oblik odgovora GET /search.

export type SearchAvailabilityStatus = 'AVAILABLE' | 'ON_REQUEST' | 'SOLD_OUT';

export interface SearchResultOffer {
  roomTypeCode: string | null;
  roomTypeName: string | null;
  boardType: string | null;
  priceBasis: 'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT' | null;
  finalPrice: number;
  finalPriceCurrency: string;
  availabilityStatus: SearchAvailabilityStatus;
  rateLineId: string | null;
  providerQuoteReference: string | null;
  quoteExpiresAt: string | null;
  cancellationPolicySummary: string | null;
  // M5 spec §3.0b.2/§3.0c.3a — deterministički izračunato, isto za CONTRACTED i API (oba imaju
  // strukturisan cancellationPolicy dostupan u trenutku pretrage, common/refundability.ts).
  isRefundable: boolean;
  // M5 spec §3.0d.6 — samo za PACKAGE (grupni paket): tačan datum polaska ove ponude, iz
  // preseka `included_products[]` FIXED/CHARTER ContractPeriod-a (§3.0d.6a). UI prikazuje
  // dostupne datume kao izbor, ne slobodan opseg. `null` za sve ostale tipove proizvoda.
  packageDepartureDate: string | null;
}

export interface SearchResultProduct {
  productId: string;
  type: string;
  sourceType: 'CONTRACTED' | 'API';
  name: string;
  destinationCountry: string;
  destinationCity: string;
  /**
   * M5 spec §3.0b.1 (dopuna 2.9.2026) — koordinate za prikaz na mapi u rezultatima pretrage.
   * `null` kad proizvod nema tačku (novi unos koji još nije geokodiran, `geocode-products.ts`).
   *
   * Namerno `number`, ne `string`: u bazi je `Decimal`, a `Decimal.toJSON()` bi ovo poslao na
   * front kao string i svaka biblioteka za mape bi dobila pogrešan tip (zamka 10.1 u
   * `33-ZAMKE-I-OBAVEZNE-PROVERE.md`). Pretvaranje se radi ovde, jednom, ne na svakom ekranu.
   */
  geoLat: number | null;
  geoLng: number | null;
  thumbnail: { url: string; category: string } | null;
  shortDescription: string | null;
  offers: SearchResultOffer[];
}
