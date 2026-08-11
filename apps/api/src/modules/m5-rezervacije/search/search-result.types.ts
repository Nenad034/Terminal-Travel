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
