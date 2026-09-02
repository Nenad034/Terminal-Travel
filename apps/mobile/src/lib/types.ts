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

// M6 spec §2.2 — putni profil gosta (dokument/državljanstvo/datum rođenja), odvojeno od
// ClientAccount (ime/email/telefon). §2a (dopuna 2.9.2026) — može se kreirati ručno ili
// predpopuniti fotografisanjem pasoša (vidi GuestProfileScreen.tsx).
export interface GuestProfile {
  id: string;
  fullName: string;
  documentType: 'PASSPORT' | 'LICNA_KARTA';
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  [key: string]: unknown;
}

// M15 spec §6.5.6e — odgovor `POST /mobile/guest-profile/scan-document`; polja koja model
// nije uspeo pouzdano da pročita dolaze kao `null` (nikad izmišljena vrednost), `warning`
// objašnjava razlog kad nešto nedostaje ili nije prepoznat čitljiv dokument.
export interface ScannedDocumentFields {
  documentDetected: boolean;
  fullName: string | null;
  documentType: 'PASSPORT' | 'LICNA_KARTA' | null;
  documentNumber: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  warning?: string;
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('sr-RS', { style: 'currency', currency }).format(amount / 100);
}
