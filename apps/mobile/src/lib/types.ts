// M9 spec §2 v1.4 — isti oblik odgovora kao apps/web/src/lib/types.ts (M5/M2 API-ji), gost
// deo mobilnog klijenta nema sopstvenu poslovnu logiku, samo iste ugovore.

export interface SearchResultOffer {
  rateLineId: string | null;
  finalPrice: number;
  finalPriceCurrency: string;
  availabilityStatus: string;
  cancellationPolicySummary?: string;
  [key: string]: unknown;
}

export interface SearchResultProduct {
  productId: string;
  type: string;
  translation: { name: string; slug: string } | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  offers: SearchResultOffer[];
  [key: string]: unknown;
}

export interface Quote {
  id: string;
  status: string;
  expiresAt: string;
  isExpired?: boolean;
  items: { id: string; productId: string; finalPrice: number; finalPriceCurrency: string; stayFrom: string; stayTo: string }[];
  [key: string]: unknown;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  voucherUrl: string | null;
  items: { id: string; productId: string; finalPrice: number; finalPriceCurrency: string; itemStatus: string; stayFrom: string; stayTo: string }[];
  [key: string]: unknown;
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('sr-RS', { style: 'currency', currency }).format(amount / 100);
}
