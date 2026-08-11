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
import { DictionaryCacheService } from '../dictionary-cache.service';
import { buildSoapEnvelope, extractDiffgramRows, extractStarRating, firstDefined, parseSoapResponse, soapActionHeader } from './solvex.soap';

/**
 * M4 spec §5a — Solvex (Master-Interlook), jedino mesto u sistemu koje govori SOAP.
 * SESSION_TOKEN auth (§2.2): `Connect(login, password)` → GUID, prosleđuje se kao
 * parametar (ne header) u svakom narednom pozivu; osvežava se reaktivno na grešku tipa
 * "nevažeći token"/"invalid login", ne na fiksni raspored.
 */
export class SolvexAdapter implements ProviderAdapter {
  readonly category = 'HOTEL' as const;

  private token: string | null = null;

  constructor(
    public readonly providerCode: string,
    private readonly endpoint: string,
    private readonly login: string,
    private readonly password: string,
    private readonly timeoutMs: number,
    private readonly dictionaryCache: DictionaryCacheService,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async rawSoapCall(method: string, params: Record<string, unknown>): Promise<unknown> {
    const xml = buildSoapEnvelope(method, params);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapActionHeader(method) },
        body: xml,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ProviderError('TIMEOUT', `Solvex poziv ${method} nije odgovorio u ${this.timeoutMs}ms`);
      }
      throw new ProviderError('PROVIDER_UNAVAILABLE', (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', `Solvex HTTP ${res.status}`);
    }
    const text = await res.text();
    try {
      return parseSoapResponse(text, method);
    } catch (err) {
      throw new ProviderError('UNKNOWN', (err as Error).message);
    }
  }

  /** M4 spec §5a, korak 1 — Connect(login, password) → GUID. */
  private async connect(): Promise<string> {
    const result = await this.rawSoapCall('Connect', { login: this.login, password: this.password });
    if (typeof result !== 'string' || /invalid/i.test(result)) {
      throw new ProviderError('AUTH_FAILED', typeof result === 'string' ? result : 'Solvex Connect nije vratio GUID');
    }
    return result;
  }

  /** Poziva metodu sa važećim GUID-om; na "invalid"-stil odgovor jednom reaktivno osvežava token i ponavlja (§2.2). */
  private async authedCall(method: string, params: Record<string, unknown>, allowRetry = true): Promise<unknown> {
    if (!this.token) this.token = await this.connect();

    const result = await this.rawSoapCall(method, { GUID: this.token, ...params });
    if (typeof result === 'string' && /invalid/i.test(result)) {
      if (!allowRetry) throw new ProviderError('AUTH_FAILED', result);
      this.token = null; // reaktivno osvežavanje, ne na raspored (§2.2)
      return this.authedCall(method, params, false);
    }
    return result;
  }

  private async getCities(): Promise<Record<string, unknown>[]> {
    return this.dictionaryCache.getOrFetch(this.providerCode, 'cities', async () => {
      const result = await this.authedCall('GetCities', { countryKey: 0, regionKey: 0 });
      return extractDiffgramRows(result, ['City']);
    });
  }

  async search(params: SearchParams): Promise<NormalizedSearchResult[]> {
    // §5a — polja u tačno ovom redosledu (WSDL sequence); CityKeys prazan niz = bez
    // filtera po gradu ako naziv grada nije poznat u keširanom šifarniku (§2.4).
    let cityKeys: number[] = [];
    if (params.destinationCity) {
      const cities = await this.getCities();
      const match = cities.find(
        (c) => String(firstDefined(c, 'Name') ?? '').toLowerCase() === params.destinationCity!.toLowerCase(),
      );
      if (match) cityKeys = [Number(firstDefined(match, 'ID', 'Id'))];
    }

    const request = {
      PageSize: 50,
      RowIndexFrom: 0,
      DateFrom: params.stayFrom,
      DateTo: params.stayTo,
      CityKeys: { int: cityKeys },
      Pax: params.adults + (params.children ?? 0),
      Tariffs: { int: [0, 1993] },
      ResultView: 1,
      Mode: 0,
      QuotaTypes: { int: [0, 1] },
    };

    const result = await this.authedCall('SearchHotelServicesMinHotel', { request });
    const rows = extractDiffgramRows(result, ['HotelService']);

    return rows.map((row) => {
      const quotaTypeRaw = Number(firstDefined(row, 'QuotaType', 'QuoteType') ?? 1);
      const name = String(firstDefined(row, 'HotelName', 'Name') ?? '');
      return {
        externalId: String(firstDefined(row, 'HotelKey') ?? ''),
        providerCode: this.providerCode,
        category: 'HOTEL' as const,
        name,
        locationSummary: name,
        priceFrom: Math.round(Number(firstDefined(row, 'Price', 'TotalPrice') ?? 0) * 100),
        currency: String(firstDefined(row, 'Currency') ?? 'EUR'),
        thumbnailUrl: null,
        starRating: extractStarRating(name),
        quotaStatus: quotaTypeRaw === 2 ? 'STOP_SALES' : quotaTypeRaw === 0 ? 'ON_REQUEST' : 'AVAILABLE',
      };
    });
  }

  async getStaticContent(externalId: string): Promise<NormalizedContent> {
    const result = await this.authedCall('GetHotels', { HotelKeys: { int: [Number(externalId)] } });
    const rows = extractDiffgramRows(result, ['Hotel']);
    const hotel = rows[0];
    if (!hotel) throw new ProviderError('INVALID_REQUEST', `Nema Solvex sadržaja za ${externalId}`);

    const name = String(firstDefined(hotel, 'Name') ?? '');
    return {
      externalId,
      name,
      description: String(firstDefined(hotel, 'Description') ?? ''),
      destinationCountry: String(firstDefined(hotel, 'CountryName') ?? ''),
      destinationCity: String(firstDefined(hotel, 'CityName') ?? ''),
      media: [],
      attributes: { stars: extractStarRating(name) ?? extractStarRating(String(firstDefined(hotel, 'Description') ?? '')) },
    };
  }

  async checkAvailabilityAndPrice(externalId: string, stay: StayParams): Promise<AvailabilityQuote> {
    const request = {
      PageSize: 1,
      RowIndexFrom: 0,
      DateFrom: stay.stayFrom,
      DateTo: stay.stayTo,
      CityKeys: { int: [] },
      HotelKeys: { int: [Number(externalId)] },
      Pax: stay.adults + (stay.children ?? 0),
      Tariffs: { int: [0, 1993] },
      ResultView: 1,
      Mode: 0,
      QuotaTypes: { int: [0, 1] },
    };
    const result = await this.authedCall('SearchHotelServices', { request });
    const rows = extractDiffgramRows(result, ['HotelService']);
    const row = rows[0];
    if (!row) throw new ProviderError('NO_AVAILABILITY', `Nema Solvex ponude za ${externalId}`);

    const priceAmount = Math.round(Number(firstDefined(row, 'Price', 'TotalPrice') ?? 0) * 100);
    const cancellationPolicy = this.mapCancellationPolicy(
      extractDiffgramRows(row, ['CancellationPolicyWithPenaltyValue', 'CancellationPolicy']),
      priceAmount,
    );

    return {
      externalId,
      priceAmount,
      currency: String(firstDefined(row, 'Currency') ?? 'EUR'),
      availableUnits: 1,
      cancellationPolicy,
      quoteExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  // M4 spec §2.1 — Solvex CancellationPolicyWithPenaltyValue (DateFrom/DateTo/PenaltyValue/
  // IsPercent) prevodi se u {days_before_stay, refund_percentage}; fiksan iznos (IsPercent=false)
  // se izračunava kao procenat od priceAmount.
  private mapCancellationPolicy(rows: Record<string, unknown>[], priceAmount: number) {
    return rows.map((r) => {
      const isPercent = Boolean(firstDefined(r, 'IsPercent'));
      const penaltyValue = Number(firstDefined(r, 'PenaltyValue') ?? 0);
      const dateFrom = String(firstDefined(r, 'DateFrom') ?? '');
      const daysBeforeStay = dateFrom ? Math.max(0, Math.floor((Date.parse(dateFrom) - Date.now()) / 86_400_000)) : 0;
      const penaltyPercent = isPercent ? penaltyValue : priceAmount > 0 ? Math.round((penaltyValue * 100 * 100) / priceAmount) / 100 : 0;
      return { days_before_stay: daysBeforeStay, refund_percentage: Math.max(0, Math.min(100, 100 - penaltyPercent)) };
    });
  }

  async confirmBooking(externalId: string, booking: BookingRequest): Promise<BookingConfirmation> {
    const result = (await this.authedCall('CreateReservation', {
      HotelKey: Number(externalId),
      DateFrom: booking.stay.stayFrom,
      DateTo: booking.stay.stayTo,
      ClientReference: booking.idempotencyKey,
      GuestName: booking.guestName,
    })) as Record<string, unknown>;

    const externalRef = String(firstDefined(result, 'ExternalID', 'ExternalId') ?? '');
    const quotaTypeRaw = Number(firstDefined(result, 'QuotaType', 'QuoteType') ?? 1);

    return {
      providerBookingReference: externalRef,
      // §5a, korak 5 — QuotaType=0 ("na zahtev") = isti status kao ON_REQUEST alotman u M3.
      status: quotaTypeRaw === 0 ? 'PENDING_SUPPLIER_CONFIRMATION' : 'CONFIRMED',
      confirmedPrice: Math.round(Number(firstDefined(result, 'Price') ?? 0) * 100) || null,
      confirmedAt: new Date().toISOString(),
    };
  }

  async cancelBooking(providerBookingReference: string): Promise<CancellationResult> {
    await this.authedCall('CancelReservation', { ExternalID: providerBookingReference });
    return { cancelled: true, providerBookingReference };
  }
}
