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
  thumbnail: { url: string; category: string } | null;
  shortDescription: string | null;
  offers: SearchResultOffer[];
}
