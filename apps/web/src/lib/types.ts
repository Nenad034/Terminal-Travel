// Oblik odgovora M2 `GET /catalog/public/products` (public-products.controller.ts) —
// source_* polja su fizički uklonjena na backend-u (M2 spec §5.1), ne samo sakrivena.
export interface PublicProduct {
  id: string;
  type: string;
  destinationCountry: string | null;
  destinationCity: string | null;
  status: string;
  attributes: Record<string, unknown> | null;
  media: unknown[] | null;
  translation: {
    languageCode: string;
    name: string;
    description: string;
    slug: string;
  } | null;
  [key: string]: unknown;
}

// M5 spec §3.0b — GET /search odgovor.
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

// M5 spec §3.1 — POST /quotes odgovor.
export interface Quote {
  id: string;
  status: string;
  expiresAt: string;
  isExpired?: boolean;
  clientAccountId: string | null;
  channel: string;
  contractTermsAccepted: boolean;
  items: QuoteItem[];
  [key: string]: unknown;
}

export interface QuoteItem {
  id: string;
  productId: string;
  finalPrice: number;
  finalPriceCurrency: string;
  stayFrom: string;
  stayTo: string;
  [key: string]: unknown;
}

// M5 spec §4 — Booking (maskiran prikaz za B2C, §6.2 dopuna).
export interface Booking {
  id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  voucherUrl: string | null;
  items: {
    id: string;
    productId: string;
    finalPrice: number;
    finalPriceCurrency: string;
    itemStatus: string;
    stayFrom: string;
    stayTo: string;
  }[];
  [key: string]: unknown;
}

// Oblik odgovora M12 `GET /marketing/public/content` (public-content.controller.ts).
export interface PublicContent {
  id: string;
  type: string;
  slug: string | null;
  translation: {
    languageCode: string;
    title: string;
    body: string;
  } | null;
}

export interface ClientAccount {
  id: string;
  accountType: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  marketingConsent: boolean;
  [key: string]: unknown;
}
