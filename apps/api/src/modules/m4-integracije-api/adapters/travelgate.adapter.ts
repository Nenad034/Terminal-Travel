import { AuthStrategy } from '../auth-strategies/auth-strategy.interface';
import {
  AvailabilityQuote,
  BookingConfirmation,
  BookingRequest,
  CancellationResult,
  NormalizedContent,
  NormalizedSearchResult,
  ProviderAdapter,
  ProviderError,
  SearchParams,
  StayParams,
} from '../provider-adapter.interface';
import { BOOK_MUTATION, CANCEL_MUTATION, CONTENT_QUERY, QUOTE_QUERY, SEARCH_QUERY } from './travelgate.graphql';

interface GraphQlError {
  message?: string;
  extensions?: { code?: string };
}

/**
 * M4 spec §5 — Travelgate adapter, jedino mesto u sistemu koje govori GraphQL. Svi
 * GraphQL upiti/mutacije su izolovani u `travelgate.graphql.ts`; ovaj fajl samo šalje
 * zahtev, prati timeout, i mapira odgovor u normalizovan oblik (§2.1).
 */
export class TravelgateAdapter implements ProviderAdapter {
  readonly providerCode: string;
  readonly category = 'HOTEL' as const;

  constructor(
    providerCode: string,
    private readonly endpoint: string,
    private readonly authStrategy: AuthStrategy,
    private readonly timeoutMs: number,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.providerCode = providerCode;
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    await this.authStrategy.refreshIfNeeded();
    const request = this.authStrategy.applyAuth({
      headers: { 'Content-Type': 'application/json' },
      body: { query, variables },
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ProviderError('TIMEOUT', `Travelgate poziv nije odgovorio u ${this.timeoutMs}ms`);
      }
      throw new ProviderError('PROVIDER_UNAVAILABLE', (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    if (res.status === 401 || res.status === 403) {
      throw new ProviderError('AUTH_FAILED', `Travelgate autentikacija odbijena (HTTP ${res.status})`);
    }
    if (res.status === 429) {
      throw new ProviderError('RATE_LIMITED', 'Travelgate rate limit dostignut');
    }
    if (!res.ok) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', `Travelgate HTTP ${res.status}`);
    }

    const body = (await res.json()) as { data?: T; errors?: GraphQlError[] };
    if (body.errors?.length) {
      throw new ProviderError('INVALID_REQUEST', body.errors.map((e) => e.message).join('; '));
    }
    if (!body.data) {
      throw new ProviderError('UNKNOWN', 'Travelgate odgovor bez data polja');
    }
    return body.data;
  }

  async search(params: SearchParams): Promise<NormalizedSearchResult[]> {
    const data = await this.graphql<{
      hotelX: { search: { options: Record<string, any>[]; errors: { description: string }[] } };
    }>(SEARCH_QUERY, {
      criteriaSearch: {
        stay: { checkIn: params.stayFrom, checkOut: params.stayTo },
        occupancies: [{ paxes: Array.from({ length: params.adults }, () => ({})) }],
        market: params.destinationCountry,
      },
    });

    const { options, errors } = data.hotelX.search;
    if (errors?.length) {
      throw new ProviderError('INVALID_REQUEST', errors.map((e) => e.description).join('; '));
    }

    return options.map((o) => ({
      externalId: o.hotelCode,
      providerCode: this.providerCode,
      category: 'HOTEL' as const,
      name: o.hotelName,
      locationSummary: o.hotelName,
      priceFrom: Math.round((o.totalStayPrice?.gross ?? 0) * 100),
      currency: o.totalStayPrice?.currency ?? 'EUR',
      thumbnailUrl: null,
      starRating: null,
      quotaStatus: o.status === 'ON_REQUEST' ? 'ON_REQUEST' : 'AVAILABLE',
    }));
  }

  async getStaticContent(externalId: string): Promise<NormalizedContent> {
    const data = await this.graphql<{ hotelX: { content: { hotels: Record<string, any>[] } } }>(CONTENT_QUERY, {
      criteriaContent: { hotels: [externalId] },
    });
    const hotel = data.hotelX.content.hotels[0];
    if (!hotel) throw new ProviderError('INVALID_REQUEST', `Nema sadržaja za ${externalId}`);

    return {
      externalId,
      name: hotel.hotelName,
      description: hotel.description ?? '',
      destinationCountry: hotel.address?.country ?? '',
      destinationCity: hotel.address?.city ?? '',
      media: (hotel.images ?? []).map((i: { url: string }) => ({ url: i.url, type: 'image' as const })),
      attributes: { stars: hotel.category?.code ?? null },
    };
  }

  async checkAvailabilityAndPrice(externalId: string, stay: StayParams): Promise<AvailabilityQuote> {
    const data = await this.graphql<{
      hotelX: { quote: { optionQuote: Record<string, any> } };
    }>(QUOTE_QUERY, {
      criteriaQuote: { optionRefId: externalId, stay: { checkIn: stay.stayFrom, checkOut: stay.stayTo } },
    });
    const quote = data.hotelX.quote.optionQuote;
    if (!quote) throw new ProviderError('NO_AVAILABILITY', `Nema ponude za ${externalId}`);

    // §2.1 — cancellationPolicy uvek isti oblik kao M3 CancellationRule.
    const cancellationPolicy = (quote.cancelPolicy?.cancelPenalties ?? []).map((p: Record<string, any>) => ({
      days_before_stay: Math.floor((p.hoursBefore ?? 0) / 24),
      refund_percentage: p.penaltyType === 'PERCENT' ? 100 - p.value : 100,
    }));

    return {
      externalId,
      priceAmount: Math.round((quote.price?.gross ?? 0) * 100),
      currency: quote.price?.currency ?? 'EUR',
      availableUnits: 1,
      cancellationPolicy,
      quoteExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  async confirmBooking(externalId: string, booking: BookingRequest): Promise<BookingConfirmation> {
    const data = await this.graphql<{ hotelX: { book: { booking: Record<string, any> } } }>(BOOK_MUTATION, {
      bookInput: { optionRefId: externalId, clientReference: booking.idempotencyKey, holder: { name: booking.guestName } },
    });
    const result = data.hotelX.book.booking;
    return {
      providerBookingReference: result.supplierReference ?? result.id,
      status: result.status === 'ON_REQUEST' ? 'PENDING_SUPPLIER_CONFIRMATION' : 'CONFIRMED',
      confirmedPrice: result.price ? Math.round(result.price.gross * 100) : null,
      confirmedAt: new Date().toISOString(),
    };
  }

  async cancelBooking(providerBookingReference: string): Promise<CancellationResult> {
    await this.graphql(CANCEL_MUTATION, { cancelInput: { bookingID: providerBookingReference } });
    return { cancelled: true, providerBookingReference };
  }
}
