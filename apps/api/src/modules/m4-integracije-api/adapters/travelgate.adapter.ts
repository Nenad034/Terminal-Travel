import { AuthStrategy } from '../auth-strategies/auth-strategy.interface';
import {
  AvailabilityQuote,
  BookingConfirmation,
  BookingRequest,
  CancellationPolicyEntry,
  CancellationResult,
  NormalizedContent,
  NormalizedSearchResult,
  ProviderAdapter,
  ProviderError,
  SearchParams,
  StayParams,
} from '../provider-adapter.interface';
import {
  BOOK_MUTATION,
  CANCEL_MUTATION,
  CONTENT_QUERY,
  QUOTE_QUERY,
  SEARCH_QUERY,
} from './travelgate.graphql';

interface GraphQlError {
  message?: string;
  extensions?: { code?: string };
}

interface TravelgateSettings {
  client: string;
  timeout: number;
  testMode: boolean;
}

/**
 * M4 spec §5 — Travelgate (TravelgateX HotelX Pull Buyers) adapter, jedino mesto u
 * sistemu koje govori GraphQL. GraphQL upiti su izolovani u `travelgate.graphql.ts`;
 * ovaj fajl šalje zahtev, prati timeout, i mapira odgovor u normalizovan oblik (§2.1).
 *
 * **Ispravljeno 15.9.2026 (M4 spec v1.17) prema stvarnoj šemi iz TravelgateX
 * sertifikacije** — vidi docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md zamka 8.13 za
 * uzrok (raniji kod je bio testiran samo protiv izmišljene, samo-potvrđujuće mokovane
 * šeme). Dve stvari koje ostaju otvorene i posle ove ispravke, obe upisane u M4 spec §9:
 *
 * 1. **`externalId` sada nosi TravelgateX `optionRefId`** (neproziran token vezan za
 *    jedan konkretan `search()` odgovor — datum/cena/sesija upakovani unutra), ne
 *    `hotelCode` kao ranije. Ovo je jedini način da `checkAvailabilityAndPrice`/
 *    `confirmBooking`/`cancelBooking` stvarno rade (sertifikacija dokazuje da
 *    TravelgateX `quote`/`book` traže tačno taj token, ne hotelCode). Posledica:
 *    `getStaticContent(externalId)` ispod dobija taj isti token umesto stabilnog
 *    hotelCode-a — TravelgateX `content` operacija (neproverena, nema je u sertifikaciji)
 *    verovatno očekuje hotelCode. Ne popravljeno ovde — nema stvarnog primera za
 *    `content` prema kom bi se ispravka mogla proveriti.
 * 2. **`BookingRequest` (M4/M5 ugovor) ne nosi prezime ni listu gostiju po sobi** —
 *    TravelgateX `book` traži oboje. Isti poznat gap kao WebHotelier email
 *    (`webhotelier.adapter.ts`); rešava se kad M5 definiše pun `BookingRequest` oblik.
 */
export class TravelgateAdapter implements ProviderAdapter {
  readonly providerCode: string;
  readonly category = 'HOTEL' as const;

  constructor(
    providerCode: string,
    private readonly endpoint: string,
    private readonly authStrategy: AuthStrategy,
    private readonly timeoutMs: number,
    private readonly client: string,
    private readonly testMode = false,
    private readonly accessIncludes?: string[],
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    this.providerCode = providerCode;
  }

  // §5 sertifikacija — `settings.client` identifikuje klijenta unutar GraphQL
  // promenljivih, NE kroz HTTP header (dodavanje custom `Client` headera ruši CORS).
  private buildSettings(): TravelgateSettings {
    return { client: this.client, timeout: this.timeoutMs, testMode: this.testMode };
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
      throw new ProviderError(
        'AUTH_FAILED',
        `Travelgate autentikacija odbijena (HTTP ${res.status})`,
      );
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

  // §5 sertifikacija — jedina potvrđena polja: `net`/`currency` (nikad `gross`, koje
  // stvaran odgovor ne vraća).
  private mapPriceToMinorUnits(price: { net?: number } | undefined): number {
    return Math.round((price?.net ?? 0) * 100);
  }

  // §5 sertifikacija — TravelgateX vraća SAMO boolean `refundable`, bez rasporeda
  // dan/procenat koji §2.1 `cancellationPolicy` inače nosi (isti oblik kao M3
  // `CancellationRule`). Konzervativno, dvostepeno mapiranje dok TravelgateX ne ponudi
  // detaljniji podatak: potpuno besplatno otkazivanje do dolaska, ili nikakav povraćaj.
  private mapCancellationPolicy(refundable: boolean | undefined): CancellationPolicyEntry[] {
    if (refundable === undefined) return [];
    return refundable
      ? [{ days_before_stay: 0, refund_percentage: 100 }]
      : [{ days_before_stay: 0, refund_percentage: 0 }];
  }

  // §5 sertifikacija — svi sertifikacioni pozivi su eksplicitno navodili ciljane
  // `hotels`/`nationality`; ovde nisu poznati jer ih `SearchParams` (M4/M5 ugovor) ne
  // nosi. `HotelCriteriaSearchInput` u šemi nije označen kao obavezan (`!`), pa se
  // izostavljaju umesto da se izmisle — nije potvrđeno uživo da li TravelgateX search
  // bez `hotels` uopšte vraća rezultate (M4 spec §9).
  private buildSearchCriteria(params: SearchParams) {
    const paxes = [
      ...Array.from({ length: params.adults }, () => ({ age: 30 })),
      // §9 — SearchParams ne nosi pojedinačne godine dece; 10 je pretpostavljena
      // vrednost dok M5 ne pošalje stvarne godine po detetu.
      ...Array.from({ length: params.children ?? 0 }, () => ({ age: 10 })),
    ];

    return {
      checkIn: params.stayFrom,
      checkOut: params.stayTo,
      occupancies: [{ paxes }],
      currency: 'EUR',
      markets: params.destinationCountry ? [params.destinationCountry] : undefined,
      language: 'en',
    };
  }

  async search(params: SearchParams): Promise<NormalizedSearchResult[]> {
    const filterSearch = this.accessIncludes
      ? { access: { includes: this.accessIncludes } }
      : undefined;

    const data = await this.graphql<{
      hotelX: { search: { options: Record<string, any>[]; errors: { description: string }[] } };
    }>(SEARCH_QUERY, {
      criteriaSearch: this.buildSearchCriteria(params),
      settings: this.buildSettings(),
      filterSearch,
    });

    const { options, errors } = data.hotelX.search;
    if (errors?.length) {
      throw new ProviderError('INVALID_REQUEST', errors.map((e) => e.description).join('; '));
    }

    return options.map((o) => ({
      // §5 sertifikacija — `id` (optionRefId) je jedina vrednost koja stvarno radi za
      // narednu quote/book/cancel kariku, ne `hotelCode` (vidi napomenu iznad klase).
      externalId: o.id,
      providerCode: this.providerCode,
      category: 'HOTEL' as const,
      // §5 sertifikacija — TravelgateX search NE vraća naziv hotela, samo `hotelCode`.
      // Pravo ime dolazi iz M2 `ProviderProductMapping` (§3.3) ili kasnijeg sadržajnog
      // poziva — ne izmišlja se ovde.
      name: o.hotelCode,
      locationSummary: o.hotelCode,
      priceFrom: this.mapPriceToMinorUnits(o.price),
      currency: o.price?.currency ?? 'EUR',
      thumbnailUrl: null,
      starRating: null,
      quotaStatus:
        o.status === 'ON_REQUEST' ? 'ON_REQUEST' : o.status === 'OK' ? 'AVAILABLE' : 'STOP_SALES',
    }));
  }

  async getStaticContent(externalId: string): Promise<NormalizedContent> {
    const data = await this.graphql<{ hotelX: { content: { hotels: Record<string, any>[] } } }>(
      CONTENT_QUERY,
      {
        criteriaContent: { hotels: [externalId] },
      },
    );
    const hotel = data.hotelX.content.hotels[0];
    if (!hotel) throw new ProviderError('INVALID_REQUEST', `Nema sadržaja za ${externalId}`);

    return {
      externalId,
      name: hotel.hotelName,
      description: hotel.description ?? '',
      destinationCountry: hotel.address?.country ?? '',
      destinationCity: hotel.address?.city ?? '',
      media: (hotel.images ?? []).map((i: { url: string }) => ({
        url: i.url,
        type: 'image' as const,
      })),
      attributes: { stars: hotel.category?.code ?? null },
    };
  }

  async checkAvailabilityAndPrice(
    externalId: string,
    _stay: StayParams,
  ): Promise<AvailabilityQuote> {
    // §5 sertifikacija — `criteriaQuote` nosi ISKLJUČIVO `optionRefId`; datum/okupacija
    // su već upakovani unutar tog tokena od strane TravelgateX-a u search koraku, pa se
    // `_stay` ne šalje ponovo (parametar ostaje u potpisu radi `ProviderAdapter` ugovora).
    const data = await this.graphql<{
      hotelX: {
        quote: { optionQuote: Record<string, any> | null; errors: { description: string }[] };
      };
    }>(QUOTE_QUERY, {
      criteriaQuote: { optionRefId: externalId },
      settings: this.buildSettings(),
    });

    const { optionQuote: quote, errors } = data.hotelX.quote;
    if (errors?.length) {
      throw new ProviderError('INVALID_REQUEST', errors.map((e) => e.description).join('; '));
    }
    if (!quote) throw new ProviderError('NO_AVAILABILITY', `Nema ponude za ${externalId}`);

    return {
      externalId,
      priceAmount: this.mapPriceToMinorUnits(quote.price),
      currency: quote.price?.currency ?? 'EUR',
      availableUnits: 1,
      cancellationPolicy: this.mapCancellationPolicy(quote.cancelPolicy?.refundable),
      quoteExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  async confirmBooking(externalId: string, booking: BookingRequest): Promise<BookingConfirmation> {
    const [firstName, ...rest] = booking.guestName.trim().split(/\s+/);
    const surname = rest.join(' ') || '-';

    // §9 — BookingRequest (M4/M5 ugovor) ne nosi listu gostiju po sobi niti godine;
    // TravelgateX `book` traži oboje (`rooms[].paxes[].name/surname/age`). Privremeno:
    // jedna soba, svi gosti nose ime/prezime nosioca rezervacije, godine su
    // pretpostavljene (30 odrasli/10 deca) — isti poznat gap kao WebHotelier email.
    const paxes = [
      ...Array.from({ length: Math.max(1, booking.stay.adults) }, () => ({
        name: firstName,
        surname,
        age: 30,
      })),
      ...Array.from({ length: booking.stay.children ?? 0 }, () => ({
        name: firstName,
        surname,
        age: 10,
      })),
    ];

    const data = await this.graphql<{
      hotelX: {
        book: { booking: Record<string, any> | null; errors: { description: string }[] };
      };
    }>(BOOK_MUTATION, {
      input: {
        optionRefId: externalId,
        clientReference: booking.idempotencyKey,
        holder: { name: firstName, surname },
        rooms: [{ occupancyRefId: 1, paxes }],
      },
      settings: this.buildSettings(),
      filter: {},
    });

    const { booking: result, errors } = data.hotelX.book;
    if (errors?.length) {
      throw new ProviderError('INVALID_REQUEST', errors.map((e) => e.description).join('; '));
    }
    if (!result) throw new ProviderError('UNKNOWN', 'Travelgate book bez booking polja');

    return {
      providerBookingReference: result.reference?.bookingID ?? '',
      status:
        result.status === 'ON_REQUEST'
          ? 'PENDING_SUPPLIER_CONFIRMATION'
          : result.status === 'OK'
            ? 'CONFIRMED'
            : 'FAILED',
      // §5 sertifikacija — stvaran `book` odgovor ne vraća cenu (samo status/reference/
      // hotel/cancelPolicy) — ranija pretpostavka `price.gross` je bila izmišljena.
      confirmedPrice: null,
      confirmedAt: new Date().toISOString(),
    };
  }

  async cancelBooking(providerBookingReference: string): Promise<CancellationResult> {
    const data = await this.graphql<{
      hotelX: {
        cancel: {
          cancellation: { status: string } | null;
          errors: { description: string }[];
        };
      };
    }>(CANCEL_MUTATION, {
      input: { bookingID: providerBookingReference },
      settings: this.buildSettings(),
    });

    const { cancellation, errors } = data.hotelX.cancel;
    if (errors?.length) {
      throw new ProviderError('INVALID_REQUEST', errors.map((e) => e.description).join('; '));
    }

    return { cancelled: cancellation?.status === 'CANCELLED', providerBookingReference };
  }
}
