import { BadRequestException } from '@nestjs/common';
import { CapacityService, enumerateDays, isoDay } from './capacity.service';

/**
 * M3 spec §2.8 — kapacitet po danu.
 *
 * Težište testova je na §2.8c izračunu, jer je on jedino mesto gde greška ne pada nego tiho
 * daje pogrešan broj na ekranu prodaje: prodato se ne čita iz kolone nego se raspoređuje po
 * noćima, a prikaz (`razlika`) i odluka o prodaji (`zaProdaju`) su namerno dve različite
 * vrednosti — prva sme biti negativna, druga nikad.
 */
describe('CapacityService', () => {
  const PERIOD = {
    id: 'p1',
    contractId: 'c1',
    roomType: 'DBL',
    allotmentMode: 'FIXED',
    totalCapacity: 10,
    stayFrom: new Date('2027-07-01'),
    stayTo: new Date('2027-07-31'),
    status: 'ACTIVE',
    contract: { supplier: { name: 'Hotel Splendid d.o.o.' } },
    capacityDays: [] as any[],
    capacityBlocks: [] as any[],
  };

  function makeService(period: Partial<typeof PERIOD> = {}, items: any[] = []) {
    const prisma = {
      contractPeriod: {
        findMany: jest.fn().mockResolvedValue([{ ...PERIOD, ...period }]),
        findUnique: jest.fn().mockResolvedValue({ ...PERIOD, ...period }),
      },
      bookingItem: { findMany: jest.fn().mockResolvedValue(items) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      capacityDay: { upsert: jest.fn() },
      capacityBlock: {
        create: jest.fn().mockImplementation(({ data }: any) => ({ id: 'b1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const auditLog = { write: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const service = new CapacityService(prisma as any, auditLog as any, eventBus as any);
    return { service, prisma, auditLog, eventBus };
  }

  const upit = { from: '2027-07-10', to: '2027-07-14' };
  const dan = (rows: any[], datum: string) => rows[0].days.find((d: any) => d.date === datum);

  describe('grid — §2.8c izračun', () => {
    it('raspoređuje prodato po noćima, i NE broji noć koja počinje na dan odlaska', async () => {
      const { service } = makeService({}, [
        {
          unitCount: 2,
          stayFrom: new Date('2027-07-11'),
          stayTo: new Date('2027-07-13'),
          rateLine: { contractPeriodId: 'p1' },
        },
      ]);

      const { rows } = await service.grid(upit as any);

      expect(dan(rows, '2027-07-10').sold).toBe(0);
      expect(dan(rows, '2027-07-11').sold).toBe(2);
      expect(dan(rows, '2027-07-12').sold).toBe(2);
      // 13. je dan odlaska — ta noć se ne troši.
      expect(dan(rows, '2027-07-13').sold).toBe(0);
    });

    it('oduzima blokirano od slobodnog, ali ga ne meša sa prodatim', async () => {
      const { service } = makeService({
        capacityBlocks: [
          {
            units: 3,
            dateFrom: new Date('2027-07-11'),
            dateTo: new Date('2027-07-12'),
            status: 'ACTIVE',
          },
        ],
      });

      const { rows } = await service.grid(upit as any);
      const d = dan(rows, '2027-07-11');

      expect(d.blocked).toBe(3);
      expect(d.sold).toBe(0);
      expect(d.razlika).toBe(7);
      expect(d.zaProdaju).toBe(7);
    });

    it('stop-sale spušta zaProdaju na nulu, a kapacitet ostaje netaknut (FIXED_LEASE ograda)', async () => {
      const { service } = makeService({
        capacityDays: [
          { date: new Date('2027-07-12'), saleStatus: 'STOP', stopReason: 'renoviranje' },
        ],
      });

      const { rows } = await service.grid(upit as any);
      const d = dan(rows, '2027-07-12');

      expect(d.saleStatus).toBe('STOP');
      expect(d.zaProdaju).toBe(0);
      expect(d.capacity).toBe(10); // nije spušten na nulu — obaveza po zakupu ostaje
      expect(d.razlika).toBe(10);
      expect(d.stopReason).toBe('renoviranje');
    });

    it('prekoračenje daje NEGATIVNU razliku za prikaz, a zaProdaju ostaje nula', async () => {
      const { service } = makeService({ totalCapacity: 5 }, [
        {
          unitCount: 8,
          stayFrom: new Date('2027-07-11'),
          stayTo: new Date('2027-07-12'),
          rateLine: { contractPeriodId: 'p1' },
        },
      ]);

      const { rows } = await service.grid(upit as any);
      const d = dan(rows, '2027-07-11');

      expect(d.razlika).toBe(-3);
      expect(d.zaProdaju).toBe(0);
    });

    it('dan van perioda nema kapacitet (null), što nije isto što i popunjeno (0)', async () => {
      const { service } = makeService({
        stayFrom: new Date('2027-07-12'),
        stayTo: new Date('2027-07-20'),
      });

      const { rows } = await service.grid(upit as any);

      expect(dan(rows, '2027-07-11').capacity).toBeNull();
      expect(dan(rows, '2027-07-11').razlika).toBeNull();
      expect(dan(rows, '2027-07-12').capacity).toBe(10);
    });

    it('dnevni override menja SAMO taj dan', async () => {
      const { service } = makeService({
        capacityDays: [{ date: new Date('2027-07-12'), capacityOverride: 4, saleStatus: 'OPEN' }],
      });

      const { rows } = await service.grid(upit as any);

      expect(dan(rows, '2027-07-11').capacity).toBe(10);
      expect(dan(rows, '2027-07-12').capacity).toBe(4);
      expect(dan(rows, '2027-07-13').capacity).toBe(10);
    });

    it('odbija raspon duži od kvartala', async () => {
      const { service } = makeService();
      await expect(
        service.grid({ from: '2027-01-01', to: '2027-12-31' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  /**
   * §6 (v1.22) — filteri nad vezanim proizvodom. Ono što se ovde stvarno proverava nije da
   * Prisma ume da filtrira, nego DA LI SE UOPŠTE PITA: bez filtera se `product.findMany` ne sme
   * koristiti za sužavanje (inače bi svaki period bez proizvoda u M2 tiho nestao sa mreže), a sa
   * filterom mora, i mora da uđe u uslov nad periodima.
   */
  describe('grid — filteri nad proizvodom (§6 v1.22)', () => {
    it('bez filtera nad proizvodom ne sužava po ugovoru — period bez proizvoda ostaje na mreži', async () => {
      const { service, prisma } = makeService();

      const { rows } = await service.grid(upit as any);

      expect(rows).toHaveLength(1);
      expect(rows[0].productName).toBeNull();
      expect(rows[0].productType).toBeNull();
      // Jedini poziv je onaj koji dopunjava naziv/destinaciju POSLE upita nad periodima.
      expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.contractPeriod.findMany.mock.calls[0][0].where.contractId).toBeUndefined();
    });

    it('filter po vrsti proizvoda i destinaciji sužava periode na ugovore koje proizvod nalazi', async () => {
      const { service, prisma } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([{ sourceContractId: 'c1' }]);

      await service.grid({
        ...upit,
        productType: ['ACCOMMODATION'],
        destinationCity: 'budva',
      } as any);

      const productWhere = prisma.product.findMany.mock.calls[0][0].where;
      expect(productWhere.type).toEqual({ in: ['ACCOMMODATION'] });
      expect(productWhere.destinationCity).toEqual({ contains: 'budva', mode: 'insensitive' });
      expect(prisma.contractPeriod.findMany.mock.calls[0][0].where.contractId).toEqual({
        in: ['c1'],
      });
    });

    it('kad nijedan proizvod ne odgovara filteru, mreža je prazna i ne pita za periode', async () => {
      const { service, prisma } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([]);

      const { rows } = await service.grid({ ...upit, productName: 'nepostojeći' } as any);

      expect(rows).toEqual([]);
      expect(prisma.contractPeriod.findMany).not.toHaveBeenCalled();
    });

    it('filter po ugovoru ostaje na snazi i kad se doda filter nad proizvodom', async () => {
      const { service, prisma } = makeService();
      prisma.product.findMany.mockResolvedValueOnce([{ sourceContractId: 'c1' }]);

      await service.grid({ ...upit, contractId: 'c1', productName: 'Splendid' } as any);

      expect(prisma.product.findMany.mock.calls[0][0].where.sourceContractId).toBe('c1');
    });

    it('vraća productType na redu kad ugovor ima proizvod u M2', async () => {
      const { service, prisma } = makeService();
      prisma.product.findMany.mockResolvedValue([
        {
          sourceContractId: 'c1',
          type: 'ACCOMMODATION',
          destinationCountry: 'Crna Gora',
          destinationCity: 'Budva',
          translations: [{ name: 'Hotel Splendid' }],
        },
      ]);

      const { rows } = await service.grid(upit as any);

      expect(rows[0].productType).toBe('ACCOMMODATION');
      expect(rows[0].productName).toBe('Hotel Splendid');
    });
  });

  describe('stop-sale — §2.8a dve dimenzije obima', () => {
    it('po ugovoru zatvara SVE periode koji pokrivaju te datume', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findMany.mockResolvedValue([
        { ...PERIOD, id: 'p1' },
        { ...PERIOD, id: 'p2', roomType: 'SUITE' },
      ]);

      const rezultat = await service.setStopSale(
        {
          contractId: 'c1',
          dateFrom: '2027-07-12',
          dateTo: '2027-07-14',
          source: 'SUPPLIER_EMAIL',
        } as any,
        'actor-1',
      );

      expect(rezultat).toEqual({ periods: 2, days: 6 }); // 2 perioda × 3 dana
      expect(prisma.capacityDay.upsert).toHaveBeenCalledTimes(6);
    });

    it('ne upisuje dane van perioda', async () => {
      const { service, prisma } = makeService();
      prisma.contractPeriod.findMany.mockResolvedValue([
        { ...PERIOD, stayFrom: new Date('2027-07-13'), stayTo: new Date('2027-07-20') },
      ]);

      const rezultat = await service.setStopSale(
        { contractPeriodId: 'p1', dateFrom: '2027-07-10', dateTo: '2027-07-14' } as any,
        'actor-1',
      );

      expect(rezultat.days).toBe(2); // samo 13. i 14.
    });

    it('ponovno otvaranje briše razlog i izvor, ne ostavlja ih da vise', async () => {
      const { service, prisma } = makeService();

      await service.setStopSale(
        { contractPeriodId: 'p1', dateFrom: '2027-07-12', dateTo: '2027-07-12' } as any,
        'actor-1',
        true,
      );

      expect(prisma.capacityDay.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            saleStatus: 'OPEN',
            stopReason: null,
            stopSource: null,
          }),
        }),
      );
    });

    it('zahtev bez ijednog obima se odbija', async () => {
      const { service } = makeService();
      await expect(
        service.setStopSale({ dateFrom: '2027-07-12', dateTo: '2027-07-12' } as any, 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('blokade — §2.8b', () => {
    it('odbija rok u prošlosti (blokada bez važećeg roka tiho pojede kapacitet)', async () => {
      const { service } = makeService();
      await expect(
        service.createBlock(
          {
            contractPeriodId: 'p1',
            dateFrom: '2027-07-12',
            dateTo: '2027-07-14',
            units: 3,
            reason: 'grupa OŠ Vuk Karadžić',
            holdUntil: '2020-01-01',
          } as any,
          'actor-1',
        ),
      ).rejects.toThrow(/budućnosti/);
    });

    it('istekle blokade se same vraćaju u prodaju, a one pred istek javljaju M18', async () => {
      const { service, prisma, eventBus } = makeService();
      prisma.capacityBlock.findMany
        .mockResolvedValueOnce([{ id: 'b1', contractPeriodId: 'p1', units: 2 }])
        .mockResolvedValueOnce([
          { id: 'b2', contractPeriodId: 'p1', units: 4, holdUntil: new Date(), reason: 'grupa' },
        ]);

      const rezultat = await service.releaseExpiredBlocks();

      expect(prisma.capacityBlock.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: 'RELEASED' },
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        'M3',
        'capacity_block_expiring',
        expect.objectContaining({ blockId: 'b2', severity: 'WARNING' }),
      );
      expect(rezultat).toEqual({ released: 1, expiring: 1 });
    });
  });

  describe('pomoćne funkcije', () => {
    it('enumerateDays je uključiv na oba kraja', () => {
      const dani = enumerateDays(new Date('2027-07-10'), new Date('2027-07-12'));
      expect(dani.map(isoDay)).toEqual(['2027-07-10', '2027-07-11', '2027-07-12']);
    });
  });
});
