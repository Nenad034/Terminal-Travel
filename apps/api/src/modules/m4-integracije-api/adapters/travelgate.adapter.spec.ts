import { ApiKeyStrategy } from '../auth-strategies/api-key.strategy';
import { ProviderError } from '../provider-adapter.interface';
import { TravelgateAdapter } from './travelgate.adapter';

// M4 spec §5/v1.17 — mokovani odgovori ovde su prepisani iz stvarnih, uživo snimljenih
// TravelgateX poziva (docs/moduli/M04-integracije-api/referentni-materijal/
// travelgatex-certification-samples/), ne izmišljeni kao pre 15.9.2026 (zamka 8.13,
// docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md) — mock i dalje ne dokazuje live poziv,
// ali barem više ne dokazuje samo unutrašnju doslednost koda sa samim sobom.
describe('TravelgateAdapter (M4 spec §5, ispravljeno prema TravelgateX sertifikaciji)', () => {
  function makeAdapter(fetchMock: jest.Mock) {
    return new TravelgateAdapter(
      'travelgate',
      'https://api.travelgate.com/',
      new ApiKeyStrategy('Apikey kljuc', 'Authorization'),
      8000,
      'client_demo',
      true,
      ['2'],
      fetchMock as any,
    );
  }

  function jsonResponse(status: number, body: unknown) {
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  }

  describe('search', () => {
    it('mapira Travelgate opcije u NormalizedSearchResult — externalId je optionRefId, ne hotelCode', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              search: {
                errors: null,
                options: [
                  {
                    id: '33!~a0!~b261210!~...OPTION-REF-ID',
                    hotelCode: 'ES284122',
                    boardCode: '14',
                    status: 'OK',
                    paymentType: 'DIRECT',
                    cancelPolicy: { refundable: true },
                    price: { net: 79, currency: 'USD' },
                  },
                ],
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const results = await adapter.search({
        stayFrom: '2026-12-10',
        stayTo: '2026-12-11',
        adults: 2,
      });

      expect(results).toEqual([
        {
          externalId: '33!~a0!~b261210!~...OPTION-REF-ID',
          providerCode: 'travelgate',
          category: 'HOTEL',
          name: 'ES284122',
          locationSummary: 'ES284122',
          priceFrom: 7900,
          currency: 'USD',
          thumbnailUrl: null,
          starRating: null,
          quotaStatus: 'AVAILABLE',
        },
      ]);

      // §5 sertifikacija — settings.client/filterSearch.access moraju biti poslati.
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.variables.settings).toEqual({
        client: 'client_demo',
        timeout: 8000,
        testMode: true,
      });
      expect(sentBody.variables.filterSearch).toEqual({ access: { includes: ['2'] } });
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Apikey kljuc');
    });

    it('mapira status ON_REQUEST u quotaStatus=ON_REQUEST', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              search: {
                errors: null,
                options: [
                  {
                    id: 'opt-1',
                    hotelCode: 'H1',
                    boardCode: '1',
                    status: 'ON_REQUEST',
                    cancelPolicy: { refundable: false },
                    price: { net: 10, currency: 'EUR' },
                  },
                ],
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);
      const results = await adapter.search({
        stayFrom: '2027-07-01',
        stayTo: '2027-07-08',
        adults: 2,
      });
      expect(results[0].quotaStatus).toBe('ON_REQUEST');
    });
  });

  describe('greške — mapiranje na normalizovan ProviderErrorCode (M4 spec §3.2)', () => {
    it('HTTP 401 → AUTH_FAILED', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(401, {}));
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('HTTP 429 → RATE_LIMITED', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(429, {}));
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toMatchObject({
        code: 'RATE_LIMITED',
      });
    });

    it('HTTP 500 → PROVIDER_UNAVAILABLE', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(500, {}));
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
    });

    it('GraphQL errors[] u 200 odgovoru → INVALID_REQUEST', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(200, { errors: [{ message: 'Bad variable' }] }));
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
      });
    });

    it('AbortError (timeout) → TIMEOUT', async () => {
      const fetchMock = jest
        .fn()
        .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
    });

    it('mrežna greška → PROVIDER_UNAVAILABLE', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
    });
  });

  describe('checkAvailabilityAndPrice — cancellationPolicy izvedena iz refundable boolean-a (§2.1, sertifikacija)', () => {
    it('refundable=true mapira u potpuno besplatno otkazivanje', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              quote: {
                errors: null,
                optionQuote: {
                  optionRefId: 'opt-1',
                  hotelCode: 'ES284122',
                  boardCode: '14',
                  status: 'OK',
                  cancelPolicy: { refundable: true },
                  price: { net: 200, currency: 'EUR' },
                },
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const quote = await adapter.checkAvailabilityAndPrice('opt-1', {
        stayFrom: '2027-07-01',
        stayTo: '2027-07-08',
        adults: 2,
      });

      expect(quote.cancellationPolicy).toEqual([{ days_before_stay: 0, refund_percentage: 100 }]);
      expect(quote.priceAmount).toBe(20000);
      expect(typeof quote.quoteExpiresAt).toBe('string');

      // §5 sertifikacija — criteriaQuote nosi ISKLJUČIVO optionRefId.
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.variables.criteriaQuote).toEqual({ optionRefId: 'opt-1' });
    });

    it('refundable=false mapira u nikakav povraćaj', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              quote: {
                errors: null,
                optionQuote: {
                  optionRefId: 'opt-1',
                  status: 'OK',
                  cancelPolicy: { refundable: false },
                  price: { net: 50, currency: 'EUR' },
                },
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);
      const quote = await adapter.checkAvailabilityAndPrice('opt-1', {
        stayFrom: '2027-07-01',
        stayTo: '2027-07-08',
        adults: 2,
      });
      expect(quote.cancellationPolicy).toEqual([{ days_before_stay: 0, refund_percentage: 0 }]);
    });

    it('baca ProviderError(NO_AVAILABILITY) kad nema optionQuote', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: { hotelX: { quote: { errors: null, optionQuote: null } } },
        }),
      );
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.checkAvailabilityAndPrice('opt-1', {
          stayFrom: '2027-07-01',
          stayTo: '2027-07-08',
          adults: 2,
        }),
      ).rejects.toBeInstanceOf(ProviderError);
    });
  });

  describe('confirmBooking', () => {
    it('mapira status OK u CONFIRMED, čita bookingID iz reference (§5 sertifikacija)', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              book: {
                errors: null,
                booking: {
                  status: 'OK',
                  reference: { bookingID: 'n1@1[...]' },
                  hotel: { hotelCode: 'ES284122', boardCode: '14' },
                  cancelPolicy: { refundable: true },
                },
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const confirmation = await adapter.confirmBooking('opt-1', {
        stay: { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 },
        guestName: 'Petar Petrović',
        idempotencyKey: 'idem-1',
      });

      expect(confirmation.status).toBe('CONFIRMED');
      expect(confirmation.providerBookingReference).toBe('n1@1[...]');
      expect(confirmation.confirmedPrice).toBeNull();

      // §9 — holder/rooms/paxes se popunjavaju iz jedinog raspoloživog imena gosta.
      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.variables.input.holder).toEqual({ name: 'Petar', surname: 'Petrović' });
      expect(sentBody.variables.input.rooms).toEqual([
        {
          occupancyRefId: 1,
          paxes: [
            { name: 'Petar', surname: 'Petrović', age: 30 },
            { name: 'Petar', surname: 'Petrović', age: 30 },
          ],
        },
      ]);
    });

    it('mapira status ON_REQUEST u PENDING_SUPPLIER_CONFIRMATION', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              book: {
                errors: null,
                booking: {
                  status: 'ON_REQUEST',
                  reference: { bookingID: 'ref-1' },
                },
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);

      const confirmation = await adapter.confirmBooking('opt-1', {
        stay: { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 1 },
        guestName: 'X',
        idempotencyKey: 'idem-2',
      });
      expect(confirmation.status).toBe('PENDING_SUPPLIER_CONFIRMATION');
    });
  });

  describe('cancelBooking', () => {
    it('status CANCELLED → cancelled=true (§5 sertifikacija)', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            hotelX: {
              cancel: {
                errors: null,
                cancellation: { status: 'CANCELLED' },
              },
            },
          },
        }),
      );
      const adapter = makeAdapter(fetchMock);
      const result = await adapter.cancelBooking('n1@1[...]');
      expect(result).toEqual({ cancelled: true, providerBookingReference: 'n1@1[...]' });

      const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(sentBody.variables.input).toEqual({ bookingID: 'n1@1[...]' });
    });
  });
});
