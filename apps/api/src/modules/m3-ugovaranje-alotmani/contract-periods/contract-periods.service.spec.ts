import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContractPeriodsService } from './contract-periods.service';

describe('ContractPeriodsService', () => {
  function makeService() {
    const prisma = {
      contractPeriod: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn() },
      rateLine: { create: jest.fn(), findMany: jest.fn() },
      cancellationRule: { create: jest.fn(), findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const auditLog = { write: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const service = new ContractPeriodsService(prisma as any, auditLog as any, eventBus as any);
    return { service, prisma, auditLog, eventBus };
  }

  describe('create (M3 spec §2.3/§2.3a — 4 allotment moda)', () => {
    it('kreira FIXED period sa total_capacity i release_days_before', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.create.mockResolvedValue({ id: 'p1' });

      await service.create(
        'contract-1',
        {
          stayFrom: '2027-07-01',
          stayTo: '2027-07-31',
          roomType: 'DELUXE',
          allotmentMode: 'FIXED' as any,
          totalCapacity: 10,
          releaseDaysBefore: 21,
        },
        'actor-1',
      );

      expect(prisma.contractPeriod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ allotmentMode: 'FIXED', totalCapacity: 10, releaseDaysBefore: 21 }),
        }),
      );
    });

    it('kreira ON_REQUEST period bez kapaciteta', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.create.mockResolvedValue({ id: 'p2' });

      await service.create(
        'contract-1',
        { stayFrom: '2027-07-01', stayTo: '2027-07-31', roomType: 'STD', allotmentMode: 'ON_REQUEST' as any },
        'actor-1',
      );

      const call = prisma.contractPeriod.create.mock.calls[0][0];
      expect(call.data.totalCapacity).toBeUndefined();
    });

    it('kreira CHARTER period sa ukupna_fiksna_obaveza, bez release_days_before', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.create.mockResolvedValue({ id: 'p3' });

      await service.create(
        'contract-1',
        {
          stayFrom: '2027-07-01',
          stayTo: '2027-07-31',
          roomType: 'CHARTER_SEAT',
          allotmentMode: 'CHARTER' as any,
          totalCapacity: 150,
          ukupnaFiksnaObaveza: 5_000_000,
          fixedObligationCurrency: 'EUR',
        },
        'actor-1',
      );

      const call = prisma.contractPeriod.create.mock.calls[0][0];
      expect(call.data.ukupnaFiksnaObaveza).toBe(5_000_000);
      expect(call.data.releaseDaysBefore).toBeUndefined();
    });

    it('kreira FIXED_LEASE period sa payment_schedule', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.create.mockResolvedValue({ id: 'p4' });

      await service.create(
        'contract-1',
        {
          stayFrom: '2027-06-01',
          stayTo: '2027-09-01',
          roomType: 'CEO_HOTEL',
          allotmentMode: 'FIXED_LEASE' as any,
          totalCapacity: 40,
          ukupnaFiksnaObaveza: 20_000_000,
          fixedObligationCurrency: 'EUR',
          paymentSchedule: [{ dueDate: '2027-05-01', amount: 10_000_000 }],
        },
        'actor-1',
      );

      const call = prisma.contractPeriod.create.mock.calls[0][0];
      expect(call.data.paymentSchedule).toEqual([{ dueDate: '2027-05-01', amount: 10_000_000 }]);
    });

    it('odbija period koji se datumski preklapa sa postojećim za istu sobu (§2.3b)', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findFirst.mockResolvedValue({
        id: 'existing',
        stayFrom: new Date('2027-07-01'),
        stayTo: new Date('2027-07-31'),
      });

      await expect(
        service.create(
          'contract-1',
          { stayFrom: '2027-07-15', stayTo: '2027-08-15', roomType: 'DELUXE', allotmentMode: 'FIXED' as any, totalCapacity: 5 },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contractPeriod.create).not.toHaveBeenCalled();
    });
  });

  describe('reserve (M3 spec §2.3/§6 — atomski, interni poziv)', () => {
    it('baca NotFoundException za nepostojeći period', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(null);

      await expect(service.reserve('missing', 1, 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('ON_REQUEST period uvek "uspeva" bez diranja kapaciteta (nema total_capacity)', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue({ id: 'p1', allotmentMode: 'ON_REQUEST' });

      const result = await service.reserve('p1', 1, 'actor-1');

      expect(result).toEqual({ reserved: true, allotmentMode: 'ON_REQUEST', requiresSupplierConfirmation: true });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('baca BadRequestException kad atomski UPDATE ne vrati nijedan red (nema kapaciteta)', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue({ id: 'p1', allotmentMode: 'FIXED' });
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.reserve('p1', 1, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('uspešna rezervacija vraća unitsSold/remaining i piše audit log', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue({ id: 'p1', allotmentMode: 'FIXED' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'p1', units_sold: 8, total_capacity: 10 }]);

      const result = await service.reserve('p1', 1, 'actor-1');

      expect(result).toEqual({ reserved: true, unitsSold: 8, remaining: 2 });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'contract_period.reserved' }));
    });

    it('preostalo=1 posle rezervacije emituje CRITICAL signal (§4.3)', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue({ id: 'p1', allotmentMode: 'FIXED' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'p1', units_sold: 9, total_capacity: 10 }]);

      await service.reserve('p1', 1, 'actor-1');

      expect(eventBus.emit).toHaveBeenCalledWith('M3', 'low_capacity_critical', {
        periodId: 'p1',
        remaining: 1,
        severity: 'CRITICAL',
      });
    });

    it('preostalo=2 posle rezervacije emituje WARNING signal (§4.3)', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue({ id: 'p1', allotmentMode: 'FIXED' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'p1', units_sold: 8, total_capacity: 10 }]);

      await service.reserve('p1', 1, 'actor-1');

      expect(eventBus.emit).toHaveBeenCalledWith('M3', 'low_capacity_critical', {
        periodId: 'p1',
        remaining: 2,
        severity: 'WARNING',
      });
    });

    it('preostalo>2 ne emituje signal (izbegava šum)', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue({ id: 'p1', allotmentMode: 'FIXED' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'p1', units_sold: 5, total_capacity: 10 }]);

      await service.reserve('p1', 1, 'actor-1');

      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('šalje atomski uslov u WHERE (units_sold + n <= total_capacity) preko $queryRaw', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue({ id: 'p1', allotmentMode: 'CHARTER' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'p1', units_sold: 1, total_capacity: 150 }]);

      await service.reserve('p1', 1, 'actor-1');

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('expiringReleases (M3 spec §6 — GET /contracts/expiring-releases)', () => {
    it('vraća samo FIXED periode sa neprodatim kapacitetom kojima se bliži rok', async () => {
      const { service, prisma } = makeService();
      const soon = new Date();
      soon.setDate(soon.getDate() + 5); // za 5 dana
      const far = new Date();
      far.setDate(far.getDate() + 90);

      prisma.contractPeriod.findMany.mockResolvedValue([
        { id: 'near', stayFrom: soon, releaseDaysBefore: 10, totalCapacity: 10, unitsSold: 4 }, // 5 <= 10 → uključi
        { id: 'far', stayFrom: far, releaseDaysBefore: 10, totalCapacity: 10, unitsSold: 4 }, // 90 > 10 → izostavi
        { id: 'soldout', stayFrom: soon, releaseDaysBefore: 10, totalCapacity: 10, unitsSold: 10 }, // nema neprodatog → izostavi
      ]);

      const result = await service.expiringReleases();

      expect(result.map((p) => p.id)).toEqual(['near']);
    });
  });

  describe('availability', () => {
    it('ON_REQUEST period vraća requiresSupplierConfirmation, ne brojeve', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUniqueOrThrow.mockResolvedValue({ id: 'p1', allotmentMode: 'ON_REQUEST', totalCapacity: null });

      const result = await service.availability('p1');
      expect(result).toEqual({ allotmentMode: 'ON_REQUEST', unlimited: false, requiresSupplierConfirmation: true });
    });

    it('FIXED period vraća preostali kapacitet', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUniqueOrThrow.mockResolvedValue({ id: 'p1', allotmentMode: 'FIXED', totalCapacity: 10, unitsSold: 3 });

      const result = await service.availability('p1');
      expect(result).toEqual({ allotmentMode: 'FIXED', totalCapacity: 10, unitsSold: 3, remaining: 7 });
    });
  });
});
