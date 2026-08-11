import { DictionaryCacheService } from '../dictionary-cache.service';
import { ProviderError } from '../provider-adapter.interface';
import { SolvexAdapter } from './solvex.adapter';

function xmlResponse(status: number, method: string, resultXml: string) {
  const text = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${method}Response xmlns="http://www.megatec.ru/"><${method}Result>${resultXml}</${method}Result></${method}Response></soap:Body></soap:Envelope>`;
  return { status, ok: status >= 200 && status < 300, text: async () => text };
}

describe('SolvexAdapter (M4 spec §5a)', () => {
  function makeAdapter(fetchMock: jest.Mock) {
    return new SolvexAdapter('solvex', 'https://evaluation.solvex.bg/iservice/integrationservice.asmx', 'sol611s', 'En5AL535', 8000, new DictionaryCacheService(), fetchMock as any);
  }

  describe('connect / autentikacija', () => {
    it('baca ProviderError(AUTH_FAILED) kad Connect vrati "Invalid login or password"', async () => {
      const fetchMock = jest.fn().mockResolvedValue(xmlResponse(200, 'Connect', 'Connection result code: -1. Invalid login or password'));
      const adapter = makeAdapter(fetchMock);

      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toMatchObject({
        code: 'AUTH_FAILED',
      });
    });

    it('uspešan Connect vraća GUID koji se koristi u narednim pozivima kao telo parametra, ne header', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(xmlResponse(200, 'Connect', 'guid-123'))
        .mockResolvedValueOnce(xmlResponse(200, 'SearchHotelServicesMinHotel', ''));
      const adapter = makeAdapter(fetchMock);

      await adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      const secondCallBody = fetchMock.mock.calls[1][1].body as string;
      expect(secondCallBody).toContain('<GUID>guid-123</GUID>');
      const secondCallHeaders = fetchMock.mock.calls[1][1].headers;
      expect(secondCallHeaders.SOAPAction).toBe('"http://www.megatec.ru/SearchHotelServicesMinHotel"');
    });

    it('reaktivno osvežava token kad naredni poziv vrati "invalid" (§2.2, ne na fiksni raspored)', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(xmlResponse(200, 'Connect', 'guid-old'))
        .mockResolvedValueOnce(xmlResponse(200, 'SearchHotelServicesMinHotel', 'Invalid GUID'))
        .mockResolvedValueOnce(xmlResponse(200, 'Connect', 'guid-new'))
        .mockResolvedValueOnce(xmlResponse(200, 'SearchHotelServicesMinHotel', ''));
      const adapter = makeAdapter(fetchMock);

      const result = await adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      expect(result).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(4); // Connect, pokušaj (invalid), ponovni Connect, ponovljen poziv
      const lastCallBody = fetchMock.mock.calls[3][1].body as string;
      expect(lastCallBody).toContain('<GUID>guid-new</GUID>');
    });
  });

  describe('search — mapiranje QuotaType u quotaStatus', () => {
    it('mapira QuotaType=0 u ON_REQUEST, 1 u AVAILABLE, 2 u STOP_SALES', async () => {
      const rows = `<HotelService><HotelKey>1</HotelKey><HotelName>Hotel A 4*</HotelName><Price>100</Price><Currency>EUR</Currency><QuotaType>0</QuotaType></HotelService><HotelService><HotelKey>2</HotelKey><HotelName>Hotel B</HotelName><Price>50</Price><Currency>EUR</Currency><QuotaType>1</QuotaType></HotelService><HotelService><HotelKey>3</HotelKey><HotelName>Hotel C</HotelName><Price>75</Price><Currency>EUR</Currency><QuotaType>2</QuotaType></HotelService>`;
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(xmlResponse(200, 'Connect', 'guid-1'))
        .mockResolvedValueOnce(xmlResponse(200, 'SearchHotelServicesMinHotel', rows));
      const adapter = makeAdapter(fetchMock);

      const results = await adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });

      expect(results.map((r) => r.quotaStatus)).toEqual(['ON_REQUEST', 'AVAILABLE', 'STOP_SALES']);
      expect(results[0].priceFrom).toBe(10000);
      expect(results[0].starRating).toBe(4); // heuristika iz naziva "Hotel A 4*"
      expect(results[1].starRating).toBeNull(); // nema prepoznatljivog obrasca — nikad pretpostaviti 0
    });

    it('prihvata i QuoteType varijantu naziva polja (§5a — obe viđene u praksi)', async () => {
      const rows = `<HotelService><HotelKey>1</HotelKey><HotelName>Hotel A</HotelName><Price>100</Price><Currency>EUR</Currency><QuoteType>0</QuoteType></HotelService>`;
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(xmlResponse(200, 'Connect', 'guid-1'))
        .mockResolvedValueOnce(xmlResponse(200, 'SearchHotelServicesMinHotel', rows));
      const adapter = makeAdapter(fetchMock);

      const results = await adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 });
      expect(results[0].quotaStatus).toBe('ON_REQUEST');
    });
  });

  describe('confirmBooking — QuotaType=0 mapira u PENDING_SUPPLIER_CONFIRMATION (§5a, korak 5)', () => {
    it('mapira status ispravno i koristi ExternalID kao providerBookingReference', async () => {
      const resultXml = `<ExternalID>EXT-1</ExternalID><QuotaType>0</QuotaType><Price>150</Price>`;
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(xmlResponse(200, 'Connect', 'guid-1'))
        .mockResolvedValueOnce(xmlResponse(200, 'CreateReservation', resultXml));
      const adapter = makeAdapter(fetchMock);

      const confirmation = await adapter.confirmBooking('1', {
        stay: { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 },
        guestName: 'Petar Petrović',
        idempotencyKey: 'idem-1',
      });

      expect(confirmation.status).toBe('PENDING_SUPPLIER_CONFIRMATION');
      expect(confirmation.providerBookingReference).toBe('EXT-1');
    });

    it('QuotaType=1 mapira u CONFIRMED', async () => {
      const resultXml = `<ExternalID>EXT-2</ExternalID><QuotaType>1</QuotaType><Price>150</Price>`;
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(xmlResponse(200, 'Connect', 'guid-1'))
        .mockResolvedValueOnce(xmlResponse(200, 'CreateReservation', resultXml));
      const adapter = makeAdapter(fetchMock);

      const confirmation = await adapter.confirmBooking('1', {
        stay: { stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 },
        guestName: 'X',
        idempotencyKey: 'idem-2',
      });
      expect(confirmation.status).toBe('CONFIRMED');
    });
  });

  describe('cancelBooking', () => {
    it('šalje ExternalID i vraća cancelled:true', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(xmlResponse(200, 'Connect', 'guid-1'))
        .mockResolvedValueOnce(xmlResponse(200, 'CancelReservation', 'true'));
      const adapter = makeAdapter(fetchMock);

      const result = await adapter.cancelBooking('EXT-1');
      expect(result).toEqual({ cancelled: true, providerBookingReference: 'EXT-1' });
    });
  });

  describe('greške mreže/timeout', () => {
    it('AbortError → ProviderError(TIMEOUT)', async () => {
      const fetchMock = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      const adapter = makeAdapter(fetchMock);
      await expect(adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 })).rejects.toBeInstanceOf(
        ProviderError,
      );
    });

    it('HTTP 500 → ProviderError(PROVIDER_UNAVAILABLE)', async () => {
      const fetchMock = jest.fn().mockResolvedValue({ status: 500, ok: false, text: async () => '' });
      const adapter = makeAdapter(fetchMock);
      await expect(
        adapter.search({ stayFrom: '2027-07-01', stayTo: '2027-07-08', adults: 2 }),
      ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    });
  });
});
