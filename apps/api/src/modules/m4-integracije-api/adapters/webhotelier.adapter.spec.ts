import { BasicAuthStrategy } from '../auth-strategies/basic.strategy';
import { ProviderError } from '../provider-adapter.interface';
import { WebHotelierAdapter } from './webhotelier.adapter';

function jsonResponse(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

function okResponse(data: unknown) {
  return jsonResponse(200, { method: '', http_method: 'GET', http_code: 200, error_code: 'OK', error_msg: '', params: [], data });
}

function errorResponse(httpCode: number, errorCode: string, errorMsg = 'error') {
  return jsonResponse(httpCode, { method: '', http_method: 'GET', http_code: httpCode, error_code: errorCode, error_msg: errorMsg, params: [], data: {} });
}

describe('WebHotelierAdapter (M4 spec §5b)', () => {
  function makeAdapter(fetchMock: jest.Mock) {
    return new WebHotelierAdapter('webhotelier', 'https://rest.reserve-online.net', new BasicAuthStrategy('agent', 'secret'), 8000, fetchMock as any);
  }

  describe('auth', () => {
    it('šalje Basic Authorization header na svaki poziv', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse({ hotels: [] }));
      const adapter = makeAdapter(fetchMock);

      await adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
      expect(headers.Authorization).toBe(`Basic ${Buffer.from('agent:secret').toString('base64')}`);
    });

    it('error_code=INVALID_AUTH → ProviderError(AUTH_FAILED)', async () => {
      const fetchMock = jest.fn().mockResolvedValue(errorResponse(403, 'INVALID_AUTH', 'Invalid username or password'));
      const adapter = makeAdapter(fetchMock);

      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });
  });

  describe('search — mapira hotels[].rates[] u NormalizedSearchResult (§5b tačka 2)', () => {
    it('jedna stavka po rate-u, quotaStatus je uvek AVAILABLE, rating=0 mapira u null', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        okResponse({
          hotels: [
            {
              code: 'demo',
              name: 'Demo Hotel',
              rating: 4,
              currency: 'EUR',
              photo: 'https://cdn.example/demo.jpg',
              rates: [
                { id: 21830, room: 'Junior Suite', price: 70, remaining: 50 },
                { id: 21831, room: 'Double', price: 55, remaining: 3 },
              ],
            },
            {
              code: 'travel',
              name: 'Travel Hotel',
              rating: 0,
              currency: 'EUR',
              rates: [{ id: 67447, room: 'Double room', price: 85.5, remaining: 10 }],
            },
          ],
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const results = await adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ externalId: 'demo:21830', priceFrom: 7000, currency: 'EUR', quotaStatus: 'AVAILABLE', starRating: 4 });
      expect(results[2]).toMatchObject({ externalId: 'travel:67447', starRating: null });
    });

    it('NO_HOTELS_FOUND → ProviderError(NO_AVAILABILITY)', async () => {
      const fetchMock = jest.fn().mockResolvedValue(errorResponse(200, 'NO_HOTELS_FOUND', 'No properties found'));
      const adapter = makeAdapter(fetchMock);

      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'NO_AVAILABILITY',
      });
    });
  });

  describe('getStaticContent', () => {
    it('mapira property info u NormalizedContent', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        okResponse({
          code: 'demo',
          name: 'Demo Hotel',
          rating: 4,
          description: '<p>desc</p>',
          location: { name: 'Athens', country: 'GR' },
          photos: [{ large: 'https://cdn.example/L.jpg', medium: 'https://cdn.example/M.jpg' }],
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const content = await adapter.getStaticContent('demo:21830');

      expect(content).toMatchObject({
        externalId: 'demo:21830',
        name: 'Demo Hotel',
        destinationCountry: 'GR',
        destinationCity: 'Athens',
        media: [{ url: 'https://cdn.example/L.jpg', type: 'image' }],
        attributes: { stars: 4 },
      });
      expect(fetchMock.mock.calls[0][0]).toContain('/property/demo');
    });
  });

  describe('checkAvailabilityAndPrice — cancellation_fees (fiksan iznos) → refund_percentage (§5b)', () => {
    it('izračunava refund_percentage od fee/price, days_before_stay od checkin-after razlike', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        okResponse({
          hotels: [
            {
              code: 'demo',
              name: 'Demo Hotel',
              currency: 'EUR',
              rates: [
                {
                  id: 21830,
                  room: 'Junior Suite',
                  price: 100,
                  remaining: 5,
                  cancellation_fees: [{ after: '2027-06-21', fee: 25 }],
                },
              ],
            },
          ],
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const quote = await adapter.checkAvailabilityAndPrice('demo:21830', { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      expect(quote.priceAmount).toBe(10000);
      expect(quote.availableUnits).toBe(5);
      expect(quote.cancellationPolicy).toEqual([{ days_before_stay: 10, refund_percentage: 75 }]);
    });

    it('rate id koji ne postoji u odgovoru → ProviderError(NO_AVAILABILITY)', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse({ hotels: [{ code: 'demo', name: 'Demo', currency: 'EUR', rates: [] }] }));
      const adapter = makeAdapter(fetchMock);

      await expect(
        adapter.checkAvailabilityAndPrice('demo:99999', { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toMatchObject({ code: 'NO_AVAILABILITY' });
    });
  });

  describe('confirmBooking (§5b tačka 5)', () => {
    it('pribavlja svežu cenu preko checkAvailabilityAndPrice, šalje je u /book, mapira res_id', async () => {
      const availabilityBody = okResponse({
        hotels: [{ code: 'demo', name: 'Demo Hotel', currency: 'EUR', rates: [{ id: 21830, room: 'JS', price: 70, remaining: 5 }] }],
      });
      const bookBody = okResponse({ summaryUrl: 'https://x', res_id: 11234567, email: 'b2b@webhotelier.net', result: 'CONFIRMED' });
      const fetchMock = jest.fn().mockResolvedValueOnce(availabilityBody).mockResolvedValueOnce(bookBody);
      const adapter = makeAdapter(fetchMock);

      const confirmation = await adapter.confirmBooking('demo:21830', {
        stay: { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 },
        guestName: 'Petar Petrović',
        idempotencyKey: 'idem-1',
      });

      expect(confirmation).toMatchObject({ providerBookingReference: '11234567', status: 'CONFIRMED', confirmedPrice: 7000 });
      const [bookUrl, bookInit] = fetchMock.mock.calls[1];
      expect(bookUrl).toContain('/book/demo');
      const form = new URLSearchParams(bookInit.body as string);
      expect(form.get('rate')).toBe('21830');
      expect(form.get('price')).toBe('70.00');
      expect(form.get('firstName')).toBe('Petar');
      expect(form.get('lastName')).toBe('Petrović');
    });

    it('ALLOT_DEPLETED na /book → ProviderError(NO_AVAILABILITY)', async () => {
      const availabilityBody = okResponse({
        hotels: [{ code: 'demo', name: 'Demo Hotel', currency: 'EUR', rates: [{ id: 21830, room: 'JS', price: 70, remaining: 5 }] }],
      });
      const fetchMock = jest.fn().mockResolvedValueOnce(availabilityBody).mockResolvedValueOnce(errorResponse(400, 'ALLOT_DEPLETED', 'Availability depleted'));
      const adapter = makeAdapter(fetchMock);

      await expect(
        adapter.confirmBooking('demo:21830', {
          stay: { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 },
          guestName: 'X Y',
          idempotencyKey: 'idem-2',
        }),
      ).rejects.toMatchObject({ code: 'NO_AVAILABILITY' });
    });
  });

  describe('cancelBooking', () => {
    it('poziva /reservation/cancel/{res_id} i vraća cancelled:true', async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse({ result: 'OK', cancellation_penalty_amount: 59.4, cancellation_penalty_currency: 'EUR' }));
      const adapter = makeAdapter(fetchMock);

      const result = await adapter.cancelBooking('11234567');

      expect(result).toEqual({ cancelled: true, providerBookingReference: '11234567' });
      expect(fetchMock.mock.calls[0][0]).toContain('/reservation/cancel/11234567');
    });
  });

  describe('greške mreže/timeout/format', () => {
    it('AbortError → ProviderError(TIMEOUT)', async () => {
      const fetchMock = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
    });

    it('HTTP 503 → ProviderError(PROVIDER_UNAVAILABLE)', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ status: 503, ok: false, json: async () => ({}) });
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
    });

    it('nevalidan JSON odgovor → ProviderError(UNKNOWN)', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => {
          throw new Error('bad json');
        },
      });
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toBeInstanceOf(ProviderError);
    });
  });
});
