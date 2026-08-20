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

interface WhCancellationFee {
  after: string; // ISO 8601
  fee: number; // fiksan iznos, ne procenat
}

interface WhRate {
  id: number;
  room: string;
  price: number;
  remaining: number;
  cancellation_fees?: WhCancellationFee[];
}

interface WhHotel {
  code: string;
  name: string;
  rating?: number;
  currency: string;
  photo?: string;
  rates: WhRate[];
}

/**
 * M4 spec §5b — WebHotelier, REST/JSON API, `BASIC` auth (§2.2 — postojeća strategija,
 * nema nove implementacije). Za razliku od Solvex/Travelgate, WebHotelier nema poseban
 * "quote" metod niti eksplicitan on-request/stop-sales enum — pretraga i dostupnost/cena
 * dele isti `/availability` endpoint.
 *
 * `externalId` je kompozitan `${propertyCode}:${rateId}`: WebHotelier `/book` zahteva i
 * property code (u putanji) i konkretan rate id (parametar `rate`), a `ProviderAdapter`
 * ugovor (poglavlje 2) nosi samo jedan opaque string — adapter sam enkodira oba dela
 * umesto da traži izmenu ugovora.
 */
export class WebHotelierAdapter implements ProviderAdapter {
  readonly category = 'HOTEL' as const;

  constructor(
    public readonly providerCode: string,
    private readonly baseUrl: string,
    private readonly authStrategy: AuthStrategy,
    private readonly timeoutMs: number,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private encodeId(propertyCode: string, rateId: number | string): string {
    return `${propertyCode}:${rateId}`;
  }

  private decodeId(externalId: string): { propertyCode: string; rateId: string } {
    const idx = externalId.indexOf(':');
    if (idx === -1) return { propertyCode: externalId, rateId: '' };
    return { propertyCode: externalId.slice(0, idx), rateId: externalId.slice(idx + 1) };
  }

  private async call(
    path: string,
    options: { method?: 'GET' | 'POST'; query?: Record<string, string | undefined>; form?: Record<string, string | undefined> } = {},
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    await this.authStrategy.refreshIfNeeded();
    const authed = this.authStrategy.applyAuth({ headers: { Accept: 'application/json' } });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      if (options.form) {
        const body = new URLSearchParams();
        for (const [key, value] of Object.entries(options.form)) {
          if (value !== undefined) body.set(key, value);
        }
        res = await this.fetchFn(url.toString(), {
          method: 'POST',
          headers: { ...authed.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: controller.signal,
        });
      } else {
        res = await this.fetchFn(url.toString(), { method: options.method ?? 'GET', headers: authed.headers, signal: controller.signal });
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ProviderError('TIMEOUT', `WebHotelier poziv ${path} nije odgovorio u ${this.timeoutMs}ms`);
      }
      throw new ProviderError('PROVIDER_UNAVAILABLE', (err as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    if (res.status === 503) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'WebHotelier privremeno nedostupan (503)');
    }

    const body = await res.json().catch(() => null);
    if (!body) {
      throw new ProviderError('UNKNOWN', `WebHotelier odgovor (HTTP ${res.status}) nije validan JSON`);
    }

    // §5b — error_code je uvek prisutan u telu odgovora, HTTP status sam po sebi nije dovoljan.
    const errorCode = body.error_code as string | undefined;
    if (errorCode && errorCode !== 'OK') {
      if (errorCode === 'NO_AUTH' || errorCode === 'INVALID_AUTH' || errorCode === 'FORBIDDEN') {
        throw new ProviderError('AUTH_FAILED', body.error_msg ?? errorCode);
      }
      if (errorCode === 'NO_HOTELS_FOUND' || errorCode === 'NO_AVAILABILITY' || errorCode === 'ALLOT_DEPLETED') {
        throw new ProviderError('NO_AVAILABILITY', body.error_msg ?? errorCode);
      }
      if (errorCode === 'INTERNAL_ERROR') {
        throw new ProviderError('PROVIDER_UNAVAILABLE', body.error_msg ?? errorCode);
      }
      throw new ProviderError('INVALID_REQUEST', body.error_msg ?? errorCode);
    }
    return body.data;
  }

  async search(params: SearchParams): Promise<NormalizedSearchResult[]> {
    const data = await this.call('/availability', {
      query: {
        checkin: params.stayFrom,
        checkout: params.stayTo,
        adults: String(params.adults),
        children: params.children ? String(params.children) : undefined,
        location: params.destinationCity ?? params.destinationCountry,
      },
    });

    const hotels = (data?.hotels ?? []) as WhHotel[];
    const results: NormalizedSearchResult[] = [];
    for (const hotel of hotels) {
      for (const rate of hotel.rates ?? []) {
        results.push({
          externalId: this.encodeId(hotel.code, rate.id),
          providerCode: this.providerCode,
          category: 'HOTEL' as const,
          name: hotel.name,
          locationSummary: hotel.name,
          priceFrom: Math.round(Number(rate.price ?? 0) * 100),
          currency: hotel.currency ?? 'EUR',
          thumbnailUrl: hotel.photo || null,
          // §5b tačka 3 — rating=0 kod WebHotelier-a pouzdano znači "bez ocene" po
          // dokumentaciji provajdera (za razliku od Solvex heuristike, §5a) — sme se
          // mapirati direktno u null bez dodatne provere.
          starRating: hotel.rating ? hotel.rating : null,
          // §5b tačka 2 — WebHotelier nema eksplicitan on-request/stop-sales enum;
          // hotel se ili pojavljuje sa dostupnim stavkama ili se ne pojavljuje uopšte.
          quotaStatus: 'AVAILABLE' as const,
        });
      }
    }
    return results;
  }

  async getStaticContent(externalId: string): Promise<NormalizedContent> {
    const { propertyCode } = this.decodeId(externalId);
    const data = await this.call(`/property/${propertyCode}`);

    return {
      externalId,
      name: data.name ?? '',
      description: data.description ?? '',
      destinationCountry: data.location?.country ?? '',
      destinationCity: data.location?.name ?? '',
      media: (data.photos ?? []).map((p: Record<string, unknown>) => ({
        url: String(p.large ?? p.medium ?? p.small ?? ''),
        type: 'image' as const,
      })),
      attributes: { stars: data.rating ? data.rating : null },
    };
  }

  /** §5b tačka 4 — nema poseban "quote" metod; cena/dostupnost se čita iz istog /availability poziva. */
  async checkAvailabilityAndPrice(externalId: string, stay: StayParams): Promise<AvailabilityQuote> {
    const { propertyCode, rateId } = this.decodeId(externalId);
    const data = await this.call(`/availability/${propertyCode}`, {
      query: {
        checkin: stay.stayFrom,
        checkout: stay.stayTo,
        adults: String(stay.adults),
        children: stay.children ? String(stay.children) : undefined,
        payments: '1', // §5b — cancellation_fees se vraća samo uz ovaj parametar
      },
    });

    const hotel = (data?.hotels ?? [])[0] as WhHotel | undefined;
    const rate = hotel?.rates?.find((r) => String(r.id) === rateId);
    if (!hotel || !rate) {
      throw new ProviderError('NO_AVAILABILITY', `Nema WebHotelier ponude za ${externalId}`);
    }

    const priceAmount = Math.round(Number(rate.price ?? 0) * 100);
    return {
      externalId,
      priceAmount,
      currency: hotel.currency ?? 'EUR',
      availableUnits: rate.remaining ?? 1,
      cancellationPolicy: this.mapCancellationPolicy(rate.cancellation_fees ?? [], priceAmount, stay.stayFrom),
      // §5b tačka 4 — WebHotelier ne vraća isteka ponude; konzervativan TTL na našoj strani (§9 — tačan broj otvoren).
      quoteExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  // §5b — cancellation_fees je niz {after, fee} (fiksan iznos), različit od ugovora iz §2.1;
  // isto rešenje kao Solvex IsPercent=false slučaj (§2.1) — fee se izračunava kao procenat od cene.
  private mapCancellationPolicy(fees: WhCancellationFee[], priceAmount: number, checkin: string) {
    return fees.map((f) => {
      const daysBeforeStay = Math.max(0, Math.floor((Date.parse(checkin) - Date.parse(f.after)) / 86_400_000));
      const feeAmount = Math.round(Number(f.fee ?? 0) * 100);
      const penaltyPercent = priceAmount > 0 ? Math.round((feeAmount * 100 * 100) / priceAmount) / 100 : 0;
      return { days_before_stay: daysBeforeStay, refund_percentage: Math.max(0, Math.min(100, 100 - penaltyPercent)) };
    });
  }

  async confirmBooking(externalId: string, booking: BookingRequest): Promise<BookingConfirmation> {
    const { propertyCode, rateId } = this.decodeId(externalId);
    // §5b tačka 5 — /book zahteva `price` koji mora tačno odgovarati trenutnoj ceni
    // (INVALID_PRICE u suprotnom) — pribavlja se sveže, ne iz ranije keširane ponude.
    const quote = await this.checkAvailabilityAndPrice(externalId, booking.stay);

    const [firstName, ...rest] = booking.guestName.trim().split(/\s+/);
    const lastName = rest.join(' ') || '-';

    const data = await this.call(`/book/${propertyCode}`, {
      form: {
        checkin: booking.stay.stayFrom,
        checkout: booking.stay.stayTo,
        rate: rateId,
        price: (quote.priceAmount / 100).toFixed(2),
        adults: String(booking.stay.adults),
        children: booking.stay.children ? String(booking.stay.children) : undefined,
        firstName,
        lastName,
        // §9 — BookingRequest (M5 još ne postoji) ne nosi email; WebHotelier ga zahteva
        // kao obavezno polje. Isti poznat gap kao izostanak email/adrese kod Travelgate/
        // Solvex adaptera — rešava se kad M5 definiše pun BookingRequest oblik.
        email: 'noreply@terminaltravel.example',
      },
    });

    return {
      providerBookingReference: String(data.res_id ?? ''),
      // §5b tačka 5 — sve uspešne WebHotelier rezervacije vraćaju CONFIRMED odmah;
      // nema poznatog "na zahtev" tipa potvrde za ovaj adapter dok se suprotno ne potvrdi uživo.
      status: 'CONFIRMED' as const,
      confirmedPrice: quote.priceAmount,
      confirmedAt: new Date().toISOString(),
    };
  }

  async cancelBooking(providerBookingReference: string): Promise<CancellationResult> {
    await this.call(`/reservation/cancel/${providerBookingReference}`, { method: 'GET' });
    return { cancelled: true, providerBookingReference };
  }
}
