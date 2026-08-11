// M4 spec §2 — ugovor koji svaki provajder mora ispuniti.

export type ProviderCategory = 'HOTEL' | 'FLIGHT' | 'TRANSFER' | 'ACTIVITY' | 'INSURANCE';
export type QuotaStatus = 'AVAILABLE' | 'ON_REQUEST' | 'STOP_SALES';
export type BookingStatus = 'CONFIRMED' | 'PENDING_SUPPLIER_CONFIRMATION' | 'FAILED';

export interface SearchParams {
  destinationCountry?: string;
  destinationCity?: string;
  stayFrom: string;
  stayTo: string;
  adults: number;
  children?: number;
}

export interface StayParams {
  stayFrom: string;
  stayTo: string;
  adults: number;
  children?: number;
}

export interface BookingRequest {
  stay: StayParams;
  guestName: string;
  idempotencyKey: string;
}

// §2.1 — namerno tanak oblik (§2.4) — lista rezultata pretrage nikad ne nosi pun opis.
export interface NormalizedSearchResult {
  externalId: string;
  providerCode: string;
  category: ProviderCategory;
  name: string;
  locationSummary: string;
  priceFrom: number; // najmanja jedinica valute
  currency: string;
  thumbnailUrl: string | null;
  starRating: number | null; // null kad provajder ne vraća pouzdan podatak (§2.1) — nikad pretpostaviti 0
  quotaStatus: QuotaStatus;
}

// §2.1 — isti oblik kao M2 Product + ProductTranslation.
export interface NormalizedContent {
  externalId: string;
  name: string;
  description: string;
  destinationCountry: string;
  destinationCity: string;
  media: { url: string; type: 'image' | 'video' }[];
  attributes: Record<string, unknown>;
}

// §2.1 — cancellationPolicy je isti oblik kao M3 CancellationRule (poglavlje 2.5).
export interface CancellationPolicyEntry {
  days_before_stay: number;
  refund_percentage: number;
}

export interface AvailabilityQuote {
  externalId: string;
  priceAmount: number;
  currency: string;
  availableUnits: number;
  cancellationPolicy: CancellationPolicyEntry[];
  quoteExpiresAt: string; // ISO datum
}

export interface BookingConfirmation {
  providerBookingReference: string;
  status: BookingStatus;
  confirmedPrice: number | null;
  confirmedAt: string | null;
}

export interface CancellationResult {
  cancelled: boolean;
  providerBookingReference: string;
}

export interface ProviderAdapter {
  providerCode: string;
  category: ProviderCategory;

  search(params: SearchParams): Promise<NormalizedSearchResult[]>;
  getStaticContent(externalId: string): Promise<NormalizedContent>;
  checkAvailabilityAndPrice(externalId: string, stay: StayParams): Promise<AvailabilityQuote>;
  confirmBooking(externalId: string, booking: BookingRequest): Promise<BookingConfirmation>;
  cancelBooking(providerBookingReference: string): Promise<CancellationResult>;
}

// M4 spec §3.2 — normalizovan tip greške, nezavisan od HTTP/GraphQL/SOAP specifičnosti.
export type ProviderErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'INVALID_REQUEST'
  | 'NO_AVAILABILITY'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN';

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
