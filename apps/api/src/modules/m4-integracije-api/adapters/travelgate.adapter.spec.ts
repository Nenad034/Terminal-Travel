import { ApiKeyStrategy } from '../auth-strategies/api-key.strategy';
import { ProviderError } from '../provider-adapter.interface';
import { TravelgateAdapter } from './travelgate.adapter';

describe('TravelgateAdapter (M4 spec §5)', () => {
  function makeAdapter(fetchMock: jest.Mock) {
    return new TravelgateAdapter('travelgate', 'https://api.travelgate.com/', new ApiKeyStrategy('kljuc'), 8000, fetchMock as any);
  }

  function jsonResponse(status: number, body: unknown) {
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  }

  describe('search', () => {
    it('mapira Travelgate opcije u NormalizedSearchResult (tanak oblik, M4 spec §2.1)', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              search: {
                options: [
                  { hotelCode: 'HTL1', hotelName: 'Hotel Test', status: 'CONFIRM', totalStayPrice: { currency: 'EUR', gross: 120.5 } },
                ],
                errors: [],
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const results = await adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      expect(results).toEqual([
        {
          externalId: 'HTL1',
          providerCode: 'travelgate',
          category: 'HOTEL',
          name: 'Hotel Test',
          locationSummary: 'Hotel Test',
          priceFrom: 12050,
          currency: 'EUR',
          thumbnailUrl: null,
          starRating: null,
          quotaStatus: 'AVAILABLE',
        },
      ]);
    });

    it('mapira status ON_REQUEST u quotaStatus=ON_REQUEST', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: { hotelX: { search: { options: [{ hotelCode: 'H1', hotelName: 'H', status: 'ON_REQUEST', totalStayPrice: { currency: 'EUR', gross: 10 } }], errors: [] } } },
        }),
      );
      const adapter = makeAdapter(fetchMock);
      const results = await adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });
      expect(results[0].quotaStatus).toBe('ON_REQUEST');
    });
  });

  describe('greške — mapiranje na normalizovan ProviderErrorCode (M4 spec §3.2)', () => {
    it('HTTP 401 → AUTH_FAILED', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(401, {}));
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('HTTP 429 → RATE_LIMITED', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(429, {}));
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'RATE_LIMITED',
      });
    });

    it('HTTP 500 → PROVIDER_UNAVAILABLE', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(500, {}));
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
    });

    it('GraphQL errors[] u 200 odgovoru → INVALID_REQUEST', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { errors: [{ message: 'Bad variable' }] }));
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
      });
    });

    it('AbortError (timeout) → TIMEOUT', async () => {
      const fetchMock = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
    });

    it('mrežna greška → PROVIDER_UNAVAILABLE', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
    });
  });

  describe('checkAvailabilityAndPrice — cancellationPolicy isti oblik kao M3 CancellationRule (§2.1)', () => {
    it('mapira cancelPenalties u {days_before_stay, refund_percentage}', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              quote: {
                optionQuote: {
                  price: { currency: 'EUR', gross: 200 },
                  cancelPolicy: { cancelPenalties: [{ hoursBefore: 720, penaltyType: 'PERCENT', value: 0 }] },
                },
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const quote = await adapter.checkAvailabilityAndPrice('HTL1', { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      expect(quote.cancellationPolicy).toEqual([{ days_before_stay: 30, refund_percentage: 100 }]);
      expect(quote.priceAmount).toBe(20000);
      expect(typeof quote.quoteExpiresAt).toBe('string');
    });

    it('baca ProviderError(NO_AVAILABILITY) kad nema optionQuote', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { data: { hotelX: { quote: {} } } }));
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.checkAvailabilityAndPrice('HTL1', { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toBeInstanceOf(ProviderError);
    });
  });

  describe('confirmBooking', () => {
    it('mapira ON_REQUEST status u PENDING_SUPPLIER_CONFIRMATION (isti kao Solvex QuotaType=0, M4 spec §2.1)', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: { hotelX: { book: { booking: { supplierReference: 'SUP-1', status: 'ON_REQUEST', price: { gross: 100 } } } } },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const confirmation = await adapter.confirmBooking('HTL1', {
        stay: { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 },
        guestName: 'Petar Petrović',
        idempotencyKey: 'idem-1',
      });

      expect(confirmation.status).toBe('PENDING_SUPPLIER_CONFIRMATION');
      expect(confirmation.providerBookingReference).toBe('SUP-1');
    });

    it('CONFIRM status mapira u CONFIRMED', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: { hotelX: { book: { booking: { supplierReference: 'SUP-2', status: 'CONFIRM', price: { gross: 100 } } } } },
        }),
      );
      const adapter = makeAdapter(fetchMock);
      const confirmation = await adapter.confirmBooking('HTL1', {
        stay: { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 },
        guestName: 'X',
        idempotencyKey: 'idem-2',
      });
      expect(confirmation.status).toBe('CONFIRMED');
    });
  });
});
