import { TravelGuaranteeService } from './travel-guarantee.service';

describe('TravelGuaranteeService (M11 spec §2)', () => {
  function makeService() {
    const prisma: any = {
      travelGuarantee: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      booking: { findMany: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const exchangeRates = { findForCurrencyOnOrBefore: jest.fn() };
    const service = new TravelGuaranteeService(prisma, auditLog as any, eventBus as any, exchangeRates as any);
    return { service, prisma, auditLog, eventBus, exchangeRates };
  }

  const activeGuarantee = {
    id: 'tg-1',
    provider: 'YUTA',
    policyNumber: 'P-1',
    coverageAmount: 1_000_000_00, // 1.000.000 RSD u para
    currency: 'RSD',
    validFrom: new Date('2026-01-01'),
    validTo: new Date('2026-12-31'),
    documentUrl: null,
    status: 'ACTIVE',
  };

  describe('assessForBooking (§2.2 — tvrda blokada preko limita)', () => {
    it('dozvoljava kad projektovana iskorišćenost ne prelazi coverage_amount', async () => {
      const { service, prisma } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue(activeGuarantee);
      prisma.booking.findMany.mockResolvedValue([{ totalPrice: 100_00, currency: 'RSD' }]);

      const result = await service.assessForBooking({ bookingTotalPrice: 200_00, currency: 'RSD' });

      expect(result).toEqual({ allowed: true });
    });

    it('blokira kad bi potvrda prevazišla coverage_amount', async () => {
      const { service, prisma } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue({ ...activeGuarantee, coverageAmount: 100_00 });
      prisma.booking.findMany.mockResolvedValue([{ totalPrice: 90_00, currency: 'RSD' }]);

      const result = await service.assessForBooking({ bookingTotalPrice: 50_00, currency: 'RSD' });

      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/prekoračenje limita garancije/);
    });

    it('emituje upozorenje kad projektovana iskorišćenost dostigne 80%', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue({ ...activeGuarantee, coverageAmount: 100_00 });
      prisma.booking.findMany.mockResolvedValue([{ totalPrice: 70_00, currency: 'RSD' }]);

      const result = await service.assessForBooking({ bookingTotalPrice: 15_00, currency: 'RSD' });

      expect(result.allowed).toBe(true);
      expect(eventBus.emit).toHaveBeenCalledWith('M11', 'travel_guarantee_utilization_warning', expect.any(Object));
    });

    it('konvertuje iznos u valutu garancije preko kursa pre poređenja', async () => {
      const { service, prisma, exchangeRates } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue({ ...activeGuarantee, coverageAmount: 1_000_00, currency: 'RSD' });
      prisma.booking.findMany.mockResolvedValue([]);
      exchangeRates.findForCurrencyOnOrBefore.mockResolvedValue({ nbsMiddleRate: 117 });

      const result = await service.assessForBooking({ bookingTotalPrice: 5_00, currency: 'EUR' });

      expect(exchangeRates.findForCurrencyOnOrBefore).toHaveBeenCalledWith('EUR', expect.any(Date));
      expect(result.allowed).toBe(true);
    });

    it('blokira potvrdu (ne baca grešku) kad kurs za valutu rezervacije nedostaje (§7, avgust 2026)', async () => {
      const { NotFoundException } = require('@nestjs/common');
      const { service, prisma, exchangeRates } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue({ ...activeGuarantee, coverageAmount: 1_000_00, currency: 'RSD' });
      prisma.booking.findMany.mockResolvedValue([]);
      exchangeRates.findForCurrencyOnOrBefore.mockRejectedValue(new NotFoundException('nema kursa'));

      const result = await service.assessForBooking({ bookingTotalPrice: 5_00, currency: 'EUR' });

      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/kurs za valutu EUR nije dostupan/);
    });

    it('POSREDNIK rezervacije nisu deo ove provere (M5 ih uopšte ne poziva za POSREDNIK, testirano u M5)', () => {
      // Dokumentacioni test — sama provera ovde ne zna za tip_nastupanja, filtriranje je na M5
      // strani (BookingsService §4 korak 1a: "if (tipNastupanja === 'ORGANIZATOR') { ... }").
      expect(true).toBe(true);
    });
  });

  describe('assessForBooking — hibridni grace period bez važeće garancije (§2.2 dopuna, avgust 2026)', () => {
    it('dozvoljava i šalje hitan alarm kad je garancija istekla unutar grace perioda (15 dana)', async () => {
      const { service, prisma, eventBus } = makeService();
      const expired = { ...activeGuarantee, status: 'EXPIRED', validTo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) };
      prisma.travelGuarantee.findFirst.mockResolvedValue(expired);

      const result = await service.assessForBooking({ bookingTotalPrice: 100_00, currency: 'RSD' });

      expect(result.allowed).toBe(true);
      expect(eventBus.emit).toHaveBeenCalledWith('M11', 'travel_guarantee_gap_urgent', expect.any(Object));
    });

    it('blokira kad je grace period (15 dana) prekoračen', async () => {
      const { service, prisma } = makeService();
      const longExpired = { ...activeGuarantee, status: 'EXPIRED', validTo: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) };
      prisma.travelGuarantee.findFirst.mockResolvedValue(longExpired);

      const result = await service.assessForBooking({ bookingTotalPrice: 100_00, currency: 'RSD' });

      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/rok počeka/);
    });

    it('dozvoljava (bootstrap) i šalje hitan alarm kad nijedna garancija još nije uneta', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue(null);

      const result = await service.assessForBooking({ bookingTotalPrice: 100_00, currency: 'RSD' });

      expect(result).toEqual({ allowed: true });
      expect(eventBus.emit).toHaveBeenCalledWith('M11', 'travel_guarantee_missing_urgent', expect.any(Object));
    });
  });

  describe('update (§2.1 — nikad autonomno)', () => {
    it('kreira novu garanciju kad nijedna ne postoji, upisuje audit log HUMAN', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue(null);
      prisma.travelGuarantee.create.mockResolvedValue(activeGuarantee);

      const result = await service.update(
        {
          provider: 'YUTA',
          policyNumber: 'P-1',
          coverageAmount: 1_000_000_00,
          currency: 'RSD',
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        },
        { userId: 'actor-1' },
      );

      expect(result).toEqual(activeGuarantee);
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'HUMAN', actorId: 'actor-1', action: 'travel_guarantee.created' }));
    });

    it('odbija kreiranje nove garancije bez obaveznih polja', async () => {
      const { service, prisma } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue(null);

      await expect(service.update({ provider: 'YUTA' }, { userId: 'actor-1' })).rejects.toThrow();
    });

    it('menja postojeću garanciju kad već postoji (bez createNew)', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue(activeGuarantee);
      prisma.travelGuarantee.update.mockResolvedValue({ ...activeGuarantee, coverageAmount: 2_000_000_00 });

      const result = await service.update({ coverageAmount: 2_000_000_00 }, { userId: 'actor-1' });

      expect(prisma.travelGuarantee.create).not.toHaveBeenCalled();
      expect(result.coverageAmount).toBe(2_000_000_00);
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'travel_guarantee.updated' }));
    });
  });

  describe('getUtilizationSnapshot', () => {
    it('vraća nule kad nijedna garancija ne postoji', async () => {
      const { service, prisma } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue(null);

      const snapshot = await service.getUtilizationSnapshot();

      expect(snapshot).toEqual({
        travelGuaranteeId: null,
        guaranteeStatus: null,
        coverageAmount: 0,
        currency: 'RSD',
        utilizedAmount: 0,
        utilizationPercent: 0,
        warningThresholdReached: false,
        inGracePeriod: false,
      });
    });

    it('računa procenat iskorišćenosti nad aktivnom garancijom', async () => {
      const { service, prisma } = makeService();
      prisma.travelGuarantee.findFirst.mockResolvedValue({ ...activeGuarantee, coverageAmount: 100_00 });
      prisma.booking.findMany.mockResolvedValue([{ totalPrice: 80_00, currency: 'RSD' }]);

      const snapshot = await service.getUtilizationSnapshot();

      expect(snapshot.utilizedAmount).toBe(80_00);
      expect(snapshot.utilizationPercent).toBe(80);
      expect(snapshot.warningThresholdReached).toBe(true);
      expect(snapshot.inGracePeriod).toBe(false);
    });
  });
});
