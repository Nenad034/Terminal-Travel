import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContractPeriodsService } from './contract-periods.service';

describe('ContractPeriodsService', () => {
  function makeService() {
    const prisma = {
      contractPeriod: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      bookingItem: { count: jest.fn().mockResolvedValue(0) },
      // §2.4c (v1.25) — gašenje i ispravka traže findUnique/update na svakoj cenovnoj stavci.
      rateLine: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      cancellationRule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      pricelistOffer: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ancillaryService: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      touristTaxInfo: { upsert: jest.fn(), findUnique: jest.fn() },
      $queryRaw: jest.fn(),
    };
    // `replaceRateLine` radi u jednoj transakciji — mock je prosleđuje kao isti klijent, pa
    // testovi vide oba upisa (gašenje + kreiranje) na istim špijunima.
    (prisma as unknown as { $transaction: unknown }).$transaction = jest.fn(
      (fn: (tx: unknown) => unknown) => fn(prisma),
    );
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
          data: expect.objectContaining({
            allotmentMode: 'FIXED',
            totalCapacity: 10,
            releaseDaysBefore: 21,
          }),
        }),
      );
    });

    it('kreira ON_REQUEST period bez kapaciteta', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.create.mockResolvedValue({ id: 'p2' });

      await service.create(
        'contract-1',
        {
          stayFrom: '2027-07-01',
          stayTo: '2027-07-31',
          roomType: 'STD',
          allotmentMode: 'ON_REQUEST' as any,
        },
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
          {
            stayFrom: '2027-07-15',
            stayTo: '2027-08-15',
            roomType: 'DELUXE',
            allotmentMode: 'FIXED' as any,
            totalCapacity: 5,
          },
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

      expect(result).toEqual({
        reserved: true,
        allotmentMode: 'ON_REQUEST',
        requiresSupplierConfirmation: true,
      });
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
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'contract_period.reserved' }),
      );
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
      prisma.contractPeriod.findUniqueOrThrow.mockResolvedValue({
        id: 'p1',
        allotmentMode: 'ON_REQUEST',
        totalCapacity: null,
      });

      const result = await service.availability('p1');
      expect(result).toEqual({
        allotmentMode: 'ON_REQUEST',
        unlimited: false,
        requiresSupplierConfirmation: true,
      });
    });

    it('FIXED period vraća preostali kapacitet', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUniqueOrThrow.mockResolvedValue({
        id: 'p1',
        allotmentMode: 'FIXED',
        totalCapacity: 10,
        unitsSold: 3,
      });

      const result = await service.availability('p1');
      expect(result).toEqual({
        allotmentMode: 'FIXED',
        totalCapacity: 10,
        unitsSold: 3,
        remaining: 7,
      });
    });
  });

  describe('upsertOffer / listOffers (M3 spec §2.4b, dopuna v1.12)', () => {
    it('kreira EARLY_BOOKING ponudu sa discount_type PERCENTAGE', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.pricelistOffer.create.mockResolvedValue({ id: 'o1' });

      await service.upsertOffer(
        'p1',
        {
          offerType: 'EARLY_BOOKING' as any,
          bookingFrom: '2027-01-01',
          bookingTo: '2027-03-31',
          discountType: 'PERCENTAGE' as any,
          discountPercentage: 15,
        } as any,
        'actor-1',
      );

      expect(prisma.pricelistOffer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractPeriodId: 'p1',
            offerType: 'EARLY_BOOKING',
            discountPercentage: 15,
          }),
        }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'pricelist_offer.upserted' }),
      );
    });

    it('kreira FREE_NIGHTS ponudu sa stay_nights/pay_nights', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistOffer.create.mockResolvedValue({ id: 'o2' });

      await service.upsertOffer(
        'p1',
        {
          offerType: 'FREE_NIGHTS' as any,
          bookingFrom: '2027-01-01',
          bookingTo: '2027-03-31',
          stayNights: 6,
          payNights: 5,
        } as any,
        'actor-1',
      );

      expect(prisma.pricelistOffer.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ stayNights: 6, payNights: 5 }) }),
      );
    });

    it('listOffers vraća ponude perioda', async () => {
      const { service, prisma } = makeService();
      prisma.pricelistOffer.findMany.mockResolvedValue([{ id: 'o1' }]);

      const result = await service.listOffers('p1');
      expect(result).toEqual([{ id: 'o1' }]);
      expect(prisma.pricelistOffer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contractPeriodId: 'p1' } }),
      );
    });
  });

  describe('upsertAncillaryService / listAncillaryServices (M3 spec §2.6, dopuna v1.12)', () => {
    it('kreira uslugu sa pricingMode FLAT_PER_UNIT', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.ancillaryService.create.mockResolvedValue({ id: 'a1' });

      await service.upsertAncillaryService(
        'p1',
        {
          name: 'Kućni ljubimac',
          pricingMode: 'FLAT_PER_UNIT' as any,
          flatAmount: 1000,
          unit: 'PER_STAY' as any,
        } as any,
        'actor-1',
      );

      expect(prisma.ancillaryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractPeriodId: 'p1',
            name: 'Kućni ljubimac',
            flatAmount: 1000,
          }),
        }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ancillary_service.upserted' }),
      );
    });

    it('kreira uslugu sa pricingMode PERCENTAGE_OF_NIGHTLY_RATE', async () => {
      const { service, prisma } = makeService();
      prisma.ancillaryService.create.mockResolvedValue({ id: 'a2' });

      await service.upsertAncillaryService(
        'p1',
        {
          name: 'Rani check-in',
          pricingMode: 'PERCENTAGE_OF_NIGHTLY_RATE' as any,
          percentageOfNightlyRate: 30,
          unit: 'PER_STAY' as any,
        } as any,
        'actor-1',
      );

      expect(prisma.ancillaryService.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ percentageOfNightlyRate: 30 }) }),
      );
    });

    it('listAncillaryServices vraća usluge perioda', async () => {
      const { service, prisma } = makeService();
      prisma.ancillaryService.findMany.mockResolvedValue([{ id: 'a1' }]);

      const result = await service.listAncillaryServices('p1');
      expect(result).toEqual([{ id: 'a1' }]);
    });
  });

  describe('upsertTouristTax / getTouristTax (M3 spec §2.7, dopuna v1.12)', () => {
    it('koristi Prisma upsert (1:1 po periodu), ne "uvek kreiraj novi red"', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.touristTaxInfo.upsert.mockResolvedValue({
        id: 't1',
        contractPeriodId: 'p1',
        includedInPrice: false,
      });

      await service.upsertTouristTax(
        'p1',
        {
          includedInPrice: false,
          collectedBy: 'PAID_ON_SITE_BY_GUEST' as any,
          amountPerNight: 200,
          currency: 'EUR',
        } as any,
        'actor-1',
      );

      expect(prisma.touristTaxInfo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractPeriodId: 'p1' },
          create: expect.objectContaining({ contractPeriodId: 'p1', includedInPrice: false }),
          update: expect.objectContaining({ includedInPrice: false }),
        }),
      );
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'tourist_tax_info.upserted' }),
      );
    });

    it('getTouristTax vraća null kad ne postoji zapis za period', async () => {
      const { service, prisma } = makeService();
      prisma.touristTaxInfo.findUnique.mockResolvedValue(null);

      const result = await service.getTouristTax('p1');
      expect(result).toBeNull();
    });
  });

  // §2.3d (v1.16, 8.9.2026) — izmena i gašenje perioda; do te verzije nisu postojali.
  describe('update (M3 spec §2.3d)', () => {
    const POSTOJECI = {
      id: 'p1',
      contractId: 'c1',
      roomType: 'DBL',
      stayFrom: new Date('2027-07-01'),
      stayTo: new Date('2027-07-31'),
      totalCapacity: 20,
      unitsSold: 15,
      allotmentMode: 'FIXED',
    };

    it('menja kapacitet iznad prodatog bez ikakve potvrde', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);
      prisma.contractPeriod.update.mockResolvedValue({ ...POSTOJECI, totalCapacity: 18 });

      await service.update('p1', { totalCapacity: 18 }, 'actor-1');

      expect(prisma.contractPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ totalCapacity: 18 }) }),
      );
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('ODBIJA smanjenje ispod prodatog bez izričite potvrde, i kaže koliko ostaje bez pokrića', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);

      await expect(service.update('p1', { totalCapacity: 12 }, 'actor-1')).rejects.toThrow(
        /3 jedinice\/jedinica ostaju bez pokrića/,
      );
      expect(prisma.contractPeriod.update).not.toHaveBeenCalled();
    });

    it('DOZVOLJAVA smanjenje ispod prodatog uz confirmOversold i emituje capacity_oversold', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);
      prisma.contractPeriod.update.mockResolvedValue({ ...POSTOJECI, totalCapacity: 12 });

      await service.update('p1', { totalCapacity: 12, confirmOversold: true }, 'actor-1');

      expect(eventBus.emit).toHaveBeenCalledWith(
        'M3',
        'capacity_oversold',
        expect.objectContaining({ oversoldBy: 3, unitsSold: 15, severity: 'CRITICAL' }),
      );
    });

    it('ponovo proverava preklapanje kad se menjaju datumi — i isključuje sam taj period', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);
      prisma.contractPeriod.findFirst.mockResolvedValue({
        id: 'p2',
        stayFrom: new Date('2027-08-01'),
        stayTo: new Date('2027-08-15'),
      });

      await expect(
        service.update('p1', { stayFrom: '2027-08-05', stayTo: '2027-08-20' }, 'actor-1'),
      ).rejects.toThrow(/preklapa/);
      expect(prisma.contractPeriod.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { not: 'p1' } }) }),
      );
    });

    it('ne dira proveru preklapanja kad se menja samo kapacitet', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);
      prisma.contractPeriod.update.mockResolvedValue(POSTOJECI);

      await service.update('p1', { totalCapacity: 25 }, 'actor-1');

      expect(prisma.contractPeriod.findFirst).not.toHaveBeenCalled();
    });

    it('odbija period kod kog bi „od" bilo posle „do"', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);

      await expect(
        service.update('p1', { stayFrom: '2027-07-31', stayTo: '2027-07-01' }, 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('nepostojeći period daje 404', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(null);

      await expect(service.update('nema', { totalCapacity: 5 }, 'actor-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove (M3 spec §2.3d — gašenje umesto brisanja)', () => {
    const POSTOJECI = { id: 'p1', contractId: 'c1', roomType: 'DBL', unitsSold: 0 };

    it('period SA rezervacijama se gasi (INACTIVE), ne briše', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);
      prisma.bookingItem.count.mockResolvedValue(4);
      prisma.contractPeriod.update.mockResolvedValue({ ...POSTOJECI, status: 'INACTIVE' });

      const rezultat = await service.remove('p1', 'actor-1');

      expect(prisma.contractPeriod.delete).not.toHaveBeenCalled();
      expect(rezultat).toEqual({ deleted: false, status: 'INACTIVE', bookedItems: 4 });
    });

    it('period BEZ rezervacija se stvarno briše', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);
      prisma.bookingItem.count.mockResolvedValue(0);

      const rezultat = await service.remove('p1', 'actor-1');

      expect(prisma.contractPeriod.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(rezultat.deleted).toBe(true);
    });

    it('broji rezervacije preko RateLine veze, ne po periodu direktno', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUnique.mockResolvedValue(POSTOJECI);

      await service.remove('p1', 'actor-1');

      expect(prisma.bookingItem.count).toHaveBeenCalledWith({
        where: { rateLine: { contractPeriodId: 'p1' } },
      });
    });
  });

  /**
   * §2.4c (v1.25) — životni ciklus cenovne stavke. Ono što se ovde stvarno proverava nije da
   * `update` radi, nego DA SE NE BRIŠE i da se ne prepisuje: cena je finansijski podatak, pa
   * posle ispravke mora ostati odgovor po kojoj je ceni nešto prodato pre nje.
   */
  describe('gašenje i ispravka cenovne stavke (§2.4c v1.25)', () => {
    const STAVKA = { id: 'r1', contractPeriodId: 'per1', status: 'ACTIVE', price: 10000 };

    it('gašenje NE briše zapis — samo menja status i beleži ko je i kada', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.rateLine.findUnique.mockResolvedValue(STAVKA);
      prisma.rateLine.update.mockResolvedValue({ ...STAVKA, status: 'INACTIVE' });

      await service.deactivateRateLine('per1', 'r1', 'u1');

      const data = prisma.rateLine.update.mock.calls[0][0].data;
      expect(data.status).toBe('INACTIVE');
      expect(data.deactivatedBy).toBe('u1');
      expect(data.deactivatedAt).toBeInstanceOf(Date);
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'rate_line.deactivated' }),
      );
    });

    it('gašenje ne proverava da li je cena prodata — prošlost se ne dira (M5 §6 snimak)', async () => {
      const { service, prisma } = makeService();
      prisma.rateLine.findUnique.mockResolvedValue(STAVKA);
      prisma.rateLine.update.mockResolvedValue({ ...STAVKA, status: 'INACTIVE' });

      await service.deactivateRateLine('per1', 'r1', 'u1');

      // Provera „da li je prodato" bi zabranila ispravku baš tamo gde je najpotrebnija.
      expect(prisma.bookingItem.count).not.toHaveBeenCalled();
    });

    it('odbija gašenje stavke koja pripada drugom periodu — greška u adresi ne sme da ugasi tuđu cenu', async () => {
      const { service, prisma } = makeService();
      prisma.rateLine.findUnique.mockResolvedValue({ ...STAVKA, contractPeriodId: 'drugi' });

      await expect(service.deactivateRateLine('per1', 'r1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.rateLine.update).not.toHaveBeenCalled();
    });

    it('ponovljeno gašenje ne upisuje ništa i ne pravi drugi audit zapis', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.rateLine.findUnique.mockResolvedValue({ ...STAVKA, status: 'INACTIVE' });

      await service.deactivateRateLine('per1', 'r1', 'u1');

      expect(prisma.rateLine.update).not.toHaveBeenCalled();
      expect(auditLog.write).not.toHaveBeenCalled();
    });

    it('ispravka gasi staru i upisuje novu sa replacesId, u istoj transakciji', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.rateLine.findUnique.mockResolvedValue(STAVKA);
      prisma.rateLine.update.mockResolvedValue({ ...STAVKA, status: 'INACTIVE' });
      prisma.rateLine.create.mockResolvedValue({ id: 'r2', replacesId: 'r1' });

      const nova = await service.replaceRateLine(
        'per1',
        'r1',
        { boardType: 'BB', occupancy: '2', priceBasis: 'PER_ROOM_PER_NIGHT', price: 12000 } as any,
        'u1',
      );

      expect((prisma as any).$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.rateLine.update.mock.calls[0][0].data.status).toBe('INACTIVE');
      expect(prisma.rateLine.create.mock.calls[0][0].data.replacesId).toBe('r1');
      expect(prisma.rateLine.create.mock.calls[0][0].data.price).toBe(12000);
      expect(nova.id).toBe('r2');
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'rate_line.replaced' }),
      );
    });

    it('čitanje perioda NE sakriva ugašene stavke, samo ih stavlja iza aktivnih (§2.4c pravilo 2)', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findUniqueOrThrow.mockResolvedValue({ id: 'per1' });

      await service.findOne('per1');

      const include = prisma.contractPeriod.findUniqueOrThrow.mock.calls[0][0].include;
      // Nema `where` po statusu — ugašena cena ostaje vidljiva na ekranu.
      expect(include.rateLines.where).toBeUndefined();
      expect(include.rateLines.orderBy).toEqual([{ status: 'asc' }, { createdAt: 'asc' }]);
    });
  });
});
