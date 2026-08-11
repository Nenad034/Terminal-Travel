import { IntegrationsService } from './integrations.service';
import { ProviderError } from './provider-adapter.interface';

describe('IntegrationsService (M4 spec §2.4/§3.2/§4/§4.1)', () => {
  function makeService(adapterOverrides: Record<string, jest.Mock> = {}) {
    const prisma = {
      providerConfig: { findUniqueOrThrow: jest.fn() },
      providerCallLog: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    };
    const circuitBreaker = {
      canCall: jest.fn().mockResolvedValue({ allowed: true, effectiveState: 'CLOSED' }),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    };
    const adapter = {
      search: jest.fn(),
      getStaticContent: jest.fn(),
      checkAvailabilityAndPrice: jest.fn(),
      confirmBooking: jest.fn(),
      cancelBooking: jest.fn(),
      ...adapterOverrides,
    };
    const registry = { getAdapter: jest.fn().mockReturnValue(adapter) };
    const auditLog = { write: jest.fn() };
    const service = new IntegrationsService(prisma as any, circuitBreaker as any, registry as any, auditLog as any);
    return { service, prisma, circuitBreaker, adapter, auditLog };
  }

  describe('circuit breaker gate (§4.1)', () => {
    it('odbija poziv kad kolo nije dozvoljeno, ne poziva adapter, upisuje ProviderCallLog', async () => {
      const { service, prisma, adapter } = makeService();
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate' });
      const circuitBreaker = (service as any).circuitBreaker;
      circuitBreaker.canCall.mockResolvedValue({ allowed: false, effectiveState: 'OPEN' });

      await expect(service.search('travelgate', { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 })).rejects.toThrow(
        ProviderError,
      );
      expect(adapter.search).not.toHaveBeenCalled();
      expect(prisma.providerCallLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ responseStatus: 'CIRCUIT_OPEN', errorCode: 'PROVIDER_UNAVAILABLE' }) }),
      );
    });
  });

  describe('search — sečenje na maxResultsPerSearch (§2.4)', () => {
    it('seče rezultate na capabilities_profile.maxResultsPerSearch pre vraćanja', async () => {
      const { service, prisma, adapter } = makeService();
      const results = Array.from({ length: 10 }, (_, i) => ({ externalId: String(i) }));
      adapter.search.mockResolvedValue(results);
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({
        providerCode: 'travelgate',
        capabilitiesProfile: { maxResultsPerSearch: 3 },
      });

      const result = await service.search('travelgate', { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 });

      expect(result).toHaveLength(3);
    });

    it('koristi podrazumevanih 50 kad capabilities_profile ne deklariše maxResultsPerSearch', async () => {
      const { service, prisma, adapter } = makeService();
      const results = Array.from({ length: 60 }, (_, i) => ({ externalId: String(i) }));
      adapter.search.mockResolvedValue(results);
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate', capabilitiesProfile: {} });

      const result = await service.search('travelgate', { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 });

      expect(result).toHaveLength(50);
    });

    it('uspeh poziva circuitBreaker.recordSuccess i upisuje OK log', async () => {
      const { service, prisma, adapter, circuitBreaker } = makeService();
      adapter.search.mockResolvedValue([]);
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate', capabilitiesProfile: {} });

      await service.search('travelgate', { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 });
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('travelgate');
    });
  });

  describe('greška — normalizovan error_code uvek popunjen (§3.2)', () => {
    it('ProviderError propagira sopstven code u log i baca dalje', async () => {
      const { service, prisma, adapter, circuitBreaker } = makeService();
      adapter.search.mockRejectedValue(new ProviderError('RATE_LIMITED', 'previše zahteva'));
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate', capabilitiesProfile: {} });

      await expect(service.search('travelgate', { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 })).rejects.toThrow(
        ProviderError,
      );
      expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('travelgate');
      expect(prisma.providerCallLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ errorCode: 'RATE_LIMITED' }) }),
      );
    });

    it('generička greška (ne ProviderError) upisuje error_code=UNKNOWN, ne prazno polje', async () => {
      const { service, prisma, adapter } = makeService();
      adapter.search.mockRejectedValue(new Error('nešto neočekivano'));
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate', capabilitiesProfile: {} });

      await expect(service.search('travelgate', { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 })).rejects.toThrow();
      expect(prisma.providerCallLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ errorCode: 'UNKNOWN' }) }),
      );
    });
  });

  describe('request_summary redakcija (§3.2/§7 Master dokumenta tačka 5)', () => {
    it('uklanja osetljiva polja (npr. guestName) iz request_summary pre upisa', async () => {
      const { service, prisma, adapter, auditLog } = makeService();
      adapter.confirmBooking.mockResolvedValue({ providerBookingReference: 'X', status: 'CONFIRMED', confirmedPrice: 100, confirmedAt: null });
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate', capabilitiesProfile: {} });

      await service.confirmBooking('travelgate', 'ext-1', {
        stay: { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 },
        guestName: 'Petar Petrović',
        idempotencyKey: 'idem-1',
      });

      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'provider_booking.confirmed' }));
    });
  });

  describe('idempotentnost confirmBooking (§4)', () => {
    it('vraća sačuvan responseBody iz ranijeg uspešnog poziva bez ponovnog pozivanja adaptera', async () => {
      const { service, prisma, adapter } = makeService();
      const cachedConfirmation = { providerBookingReference: 'EXT-OLD', status: 'CONFIRMED', confirmedPrice: 500, confirmedAt: '2027-01-01' };
      prisma.providerCallLog.findFirst.mockResolvedValue({ responseBody: cachedConfirmation });

      const result = await service.confirmBooking('travelgate', 'ext-1', {
        stay: { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 },
        guestName: 'X',
        idempotencyKey: 'idem-already-sent',
      });

      expect(result).toEqual(cachedConfirmation);
      expect(adapter.confirmBooking).not.toHaveBeenCalled();
    });

    it('bez ranijeg zapisa, poziva adapter i čuva ishod za buduće ponovne pokušaje', async () => {
      const { service, prisma, adapter } = makeService();
      const confirmation = { providerBookingReference: 'EXT-NEW', status: 'CONFIRMED', confirmedPrice: 100, confirmedAt: null };
      adapter.confirmBooking.mockResolvedValue(confirmation);
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate', capabilitiesProfile: {} });

      const result = await service.confirmBooking('travelgate', 'ext-1', {
        stay: { stayFrom: '2027-01-01', stayTo: '2027-01-02', adults: 2 },
        guestName: 'X',
        idempotencyKey: 'idem-new',
      });

      expect(result).toEqual(confirmation);
      const logCall = prisma.providerCallLog.create.mock.calls.find((c: any) => c[0].data.operation === 'BOOK');
      expect(logCall[0].data.responseBody).toEqual(confirmation);
      expect(logCall[0].data.idempotencyKey).toBe('idem-new');
    });
  });

  describe('M1 audit log za BOOK/CANCEL (§3.2)', () => {
    it('uspešan cancelBooking piše M1 audit log', async () => {
      const { service, prisma, adapter, auditLog } = makeService();
      adapter.cancelBooking.mockResolvedValue({ cancelled: true, providerBookingReference: 'EXT-1' });
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate', capabilitiesProfile: {} });

      await service.cancelBooking('travelgate', 'EXT-1');

      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'provider_booking.cancelled', actorType: 'SYSTEM' }));
    });

    it('neuspešan cancelBooking i dalje piše M1 audit log (cancel_failed)', async () => {
      const { service, prisma, adapter, auditLog } = makeService();
      adapter.cancelBooking.mockRejectedValue(new ProviderError('PROVIDER_UNAVAILABLE', 'x'));
      prisma.providerConfig.findUniqueOrThrow.mockResolvedValue({ providerCode: 'travelgate', capabilitiesProfile: {} });

      await expect(service.cancelBooking('travelgate', 'EXT-1')).rejects.toThrow();
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'provider_booking.cancel_failed' }));
    });
  });
});
