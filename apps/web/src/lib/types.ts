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

// M5 spec §3.0 — SearchService vraća RAVAN oblik (`name`, `shortDescription`), već razrešen na
// traženi jezik; NEMA ugnježdenog `translation` objekta kao M2 javni katalog, i NEMA `slug`.
// Ranije je ovde stajalo `translation`, pa je stranica pretrage prikazivala sirov UUID umesto
// naziva — bag nije bio vidljiv jer pretraga nikad nije vraćala rezultate (ni jedan proizvod
// nije imao B2C_SITE kanal). Otkriveno 17.8.2026, pri uvođenju mock podataka.
export interface SearchResultProduct {
  productId: string;
  type: string;
  name: string;
  shortDescription: string | null;
  destinationCountry: string | null;
  destinationCity: string | null;
  thumbnail: { url: string; category: string } | null;
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

// Oblik odgovora `GET /sales/bookings/public/:id/voucher` (public-voucher.controller.ts,
// M5 spec §6 dopuna 2.9.2026) — javan, već maskiran sadržaj (§6.2), nikad supplier polja.
export interface VoucherItem {
  productName: string | null;
  productType: string | null;
  destinationCity: string | null;
  /** M2 spec §2.1b — regija/poluostrvo KAD se razlikuje od destinationCity (npr. "Sitonija, Halkidiki"). */
  destinationArea: string | null;
  destinationCountry: string | null;
  stayFrom: string;
  stayTo: string;
  unitCount: number;
  /** M5 §6.7a — `ON_SITE` se plaća dobavljaču na licu mesta i NIJE u ceni aranžmana. */
  payable: 'AGENCY' | 'ON_SITE';
  price: number;
  currency: string;
  guests: { guestFirstName: string; guestLastName: string }[];
  representative: { fullName: string; phone: string | null; email: string | null } | null;
}

/**
 * M5 §6 dopuna (3.9.2026, vlasnikova odluka) — jedan vaučer po DOBAVLJAČU je podrazumevani.
 * Grupa se ZOVE po uslugama koje nosi, nikad po dobavljaču: §6.2 zabranjuje da identitet
 * dobavljača stigne do gosta (hotel je proizvod, dobavljač može biti veletrgovac).
 */
export interface VoucherGroup {
  index: number;
  label: string;
  items: VoucherItem[];
  onSiteTotal: number;
}

export interface VoucherContent {
  bookingNumber: string;
  buyerName: string;
  totalPrice: number;
  currency: string;
  onSiteTotal: number;
  groups: VoucherGroup[];
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

// Oblik odgovora M15 `POST /ai-orchestration/omnisearch` (omnisearch-result.types.ts,
// M15 spec §9, M8 spec §3a).
export interface OmnisearchEntityResult {
  type: 'BOOKING' | 'PRODUCT';
  id: string;
  label: string;
  href: string;
  media?: { url: string; category: string }[] | null;
}

export interface OmnisearchMatchedRoute {
  label: string;
  href: string;
}

export interface OmnisearchResult {
  active: boolean;
  matchedRoutes: OmnisearchMatchedRoute[];
  entityResults: OmnisearchEntityResult[];
  aiAnswer?: string;
}

// Oblik odgovora M23 `GET /knowledge/public/:shareToken` (public-knowledge.controller.ts,
// M23 spec §5/§8).
export interface PublicArticle {
  id: string;
  subjectType: string;
  destinationCountry: string | null;
  destinationCity: string | null;
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
