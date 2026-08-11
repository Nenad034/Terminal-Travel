import {
  AvailabilityQuote,
  BookingConfirmation,
  BookingRequest,
  CancellationResult,
  NormalizedContent,
  NormalizedSearchResult,
  ProviderAdapter,
  ProviderCategory,
  ProviderError,
  ProviderErrorCode,
  SearchParams,
  StayParams,
} from '../provider-adapter.interface';

/**
 * M4 spec §9 — "vredi formalizovati ProviderConfig.use_mock". Ne gađa nijedan spoljni
 * servis — koristi se kad `ProviderConfig.useMock = true` (npr. dok se ne dobiju/obnove
 * prava produkcijska/test akreditiva za Travelgate/Solvex), i u testovima za simulaciju
 * timeout-a/pada koje izlazni kriterijum M4 (§8) eksplicitno traži.
 */
export class MockProviderAdapter implements ProviderAdapter {
  /** Kad > 0, sledećih N poziva bilo koje operacije baca ProviderError, pa se "oporavlja". */
  failNextCalls = 0;
  failureCode: ProviderErrorCode = 'PROVIDER_UNAVAILABLE';
  /** Kad true, poziv nikad ne razrešava (simulira timeout) — pozivalac mora sam da ograniči vreme čekanja. */
  simulateHang = false;

  searchResults: NormalizedSearchResult[] = [];
  content: NormalizedContent | null = null;
  availabilityQuote: AvailabilityQuote | null = null;
  bookingConfirmation: BookingConfirmation | null = null;

  private readonly confirmedIdempotencyKeys = new Set<string>();

  constructor(
    public readonly providerCode: string,
    public readonly category: ProviderCategory,
  ) {}

  private async maybeFail(): Promise<void> {
    if (this.simulateHang) {
      await new Promise(() => {}); // nikad se ne razrešava — pozivalac mora imati sopstveni timeout
    }
    if (this.failNextCalls > 0) {
      this.failNextCalls -= 1;
      throw new ProviderError(this.failureCode, `Simulirana greška (mock adapter): ${this.failureCode}`);
    }
  }

  async search(_params: SearchParams): Promise<NormalizedSearchResult[]> {
    await this.maybeFail();
    return this.searchResults;
  }

  async getStaticContent(externalId: string): Promise<NormalizedContent> {
    await this.maybeFail();
    if (!this.content) throw new ProviderError('INVALID_REQUEST', `Nema sadržaja za ${externalId}`);
    return this.content;
  }

  async checkAvailabilityAndPrice(_externalId: string, _stay: StayParams): Promise<AvailabilityQuote> {
    await this.maybeFail();
    if (!this.availabilityQuote) throw new ProviderError('NO_AVAILABILITY', 'Nema dostupne ponude');
    return this.availabilityQuote;
  }

  // M4 spec §4 — idempotentnost: isti idempotency_key nikad ne pravi drugu rezervaciju.
  async confirmBooking(_externalId: string, booking: BookingRequest): Promise<BookingConfirmation> {
    await this.maybeFail();
    if (this.confirmedIdempotencyKeys.has(booking.idempotencyKey)) {
      return this.bookingConfirmation ?? { providerBookingReference: 'MOCK-DUP', status: 'CONFIRMED', confirmedPrice: null, confirmedAt: null };
    }
    this.confirmedIdempotencyKeys.add(booking.idempotencyKey);
    return (
      this.bookingConfirmation ?? {
        providerBookingReference: `MOCK-${booking.idempotencyKey}`,
        status: 'CONFIRMED',
        confirmedPrice: 10000,
        confirmedAt: new Date().toISOString(),
      }
    );
  }

  async cancelBooking(providerBookingReference: string): Promise<CancellationResult> {
    await this.maybeFail();
    return { cancelled: true, providerBookingReference };
  }
}
