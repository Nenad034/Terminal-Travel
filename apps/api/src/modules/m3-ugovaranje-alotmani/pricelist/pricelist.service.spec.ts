import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PricelistService } from './pricelist.service';

/**
 * M3 spec §2.11 — cenovnik kao mreža.
 *
 * Težište testova je na dve stvari koje se ne vide sa ekrana:
 *  1. jedna ćelija upisuje cenu u SVE periode te sezone (Aycon sezona 1 ima dva opsega, pa dva
 *     perioda) — greška bi bila da se cena upiše samo u prvi, a hotel bi u oktobru prodavao staru;
 *  2. ispravka postojeće cene je gašenje pa nova (§2.4c), nikad prepisivanje.
 */
describe('PricelistService (M3 §2.11)', () => {
  const UGOVOR = {
    id: 'c1',
    contractNumber: 'TT-2026-014',
    currency: 'EUR',
    commissionModel: 'NET',
    commissionPercentage: null,
  };

  // Sezona 1 iz stvarnog cenovnika Aycon 2026 — dva odvojena dela godine.
  const SEZONA_1 = {
    id: 's1',
    contractId: 'c1',
    code: '1',
    label: 'Predsezona',
    rank: 1,
    ranges: [
      {
        id: 'r1',
        seasonId: 's1',
        dateFrom: new Date('2026-04-01'),
        dateTo: new Date('2026-05-31'),
      },
      {
        id: 'r2',
        seasonId: 's1',
        dateFrom: new Date('2026-10-01'),
        dateTo: new Date('2026-10-31'),
      },
    ],
  };

  function makeService(over: Record<string, any> = {}) {
    const napravljeniPeriodi: any[] = [];
    const napravljeneCene: any[] = [];
    const ugasene: string[] = [];

    const tx = {
      rateLine: {
        findFirst: over.rateLineFindFirst ?? jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation(({ where }: any) => {
          ugasene.push(where.id);
          return { id: where.id };
        }),
        create: jest.fn().mockImplementation(({ data }: any) => {
          const nova = { id: `rl${napravljeneCene.length + 1}`, ...data };
          napravljeneCene.push(nova);
          return nova;
        }),
      },
      seasonRange: { deleteMany: jest.fn() },
      season: { update: jest.fn() },
    };

    const prisma = {
      contract: { findUnique: jest.fn().mockResolvedValue(over.contract ?? UGOVOR) },
      season: {
        findUnique: jest.fn().mockResolvedValue(over.season === undefined ? SEZONA_1 : over.season),
        findMany: jest.fn().mockResolvedValue(over.seasons ?? []),
        findFirst: jest.fn().mockResolvedValue(over.seasonFindFirst ?? null),
        create: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ id: 's9', ...data, ranges: [] })),
        delete: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { rank: 2 } }),
      },
      contractPeriod: {
        findMany: jest.fn().mockResolvedValue(over.periods ?? []),
        findFirst: jest.fn().mockResolvedValue(over.periodFindFirst ?? null),
        count: jest.fn().mockResolvedValue(over.periodCount ?? 0),
        create: jest.fn().mockImplementation(({ data }: any) => {
          const p = { id: `p${napravljeniPeriodi.length + 1}`, ...data };
          napravljeniPeriodi.push(p);
          return p;
        }),
      },
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
    };

    const auditLog = { write: jest.fn() };
    const service = new PricelistService(prisma as never, auditLog as never);
    return { service, prisma, auditLog, napravljeniPeriodi, napravljeneCene, ugasene, tx };
  }

  const CELIJA = {
    seasonId: 's1',
    roomType: 'Budget double room',
    boardType: 'NsD',
    occupancy: '2 odrasle osobe',
    priceBasis: 'PER_PERSON_PER_NIGHT' as const,
    price: 3600,
  };

  describe('writeCell — jedna ćelija, svi opsezi sezone', () => {
    it('sezona sa dva opsega pravi DVA perioda i upisuje cenu u oba', async () => {
      const { service, napravljeniPeriodi, napravljeneCene } = makeService();
      const r = await service.writeCell('c1', CELIJA, 'u1');

      expect(napravljeniPeriodi).toHaveLength(2);
      expect(napravljeneCene).toHaveLength(2);
      expect(r.periodIds).toHaveLength(2);
      // Oba perioda nose istu cenu — inače bi hotel u oktobru prodavao po drugoj.
      expect(napravljeneCene.every((c) => c.price === 3600)).toBe(true);
    });

    it('period nastao iz cenovnika je ON_REQUEST — kapacitet se unosi odvojeno (§2.11n)', async () => {
      const { service, napravljeniPeriodi } = makeService();
      await service.writeCell('c1', CELIJA, 'u1');
      expect(napravljeniPeriodi.every((p) => p.allotmentMode === 'ON_REQUEST')).toBe(true);
      expect(napravljeniPeriodi.every((p) => p.totalCapacity === undefined)).toBe(true);
    });

    it('postojeći period se ponovo koristi umesto da se pravi nov', async () => {
      const { service, napravljeniPeriodi } = makeService({
        periodFindFirst: { id: 'postojeci', roomType: 'Budget double room' },
      });
      const r = await service.writeCell('c1', CELIJA, 'u1');
      expect(napravljeniPeriodi).toHaveLength(0);
      expect(r.periodIds).toEqual(['postojeci', 'postojeci']);
    });
  });

  describe('writeCell — ispravka je gašenje pa nova (§2.4c)', () => {
    it('postojeća cena se GASI, nova nosi replacesId', async () => {
      const { service, napravljeneCene, ugasene } = makeService({
        rateLineFindFirst: jest.fn().mockResolvedValue({
          id: 'stara',
          price: 3400,
          priceBasis: 'PER_PERSON_PER_NIGHT',
          bookingFrom: null,
          bookingTo: null,
        }),
      });
      const r = await service.writeCell('c1', CELIJA, 'u1');

      expect(ugasene).toEqual(['stara', 'stara']);
      expect(napravljeneCene.every((c) => c.replacesId === 'stara')).toBe(true);
      expect(r.deactivated).toBe(2);
    });

    it('ista cena se NE prepisuje — nema lažnog traga u auditu', async () => {
      const { service, napravljeneCene, ugasene } = makeService({
        rateLineFindFirst: jest.fn().mockResolvedValue({
          id: 'ista',
          price: 3600,
          priceBasis: 'PER_PERSON_PER_NIGHT',
          bookingFrom: null,
          bookingTo: null,
        }),
      });
      const r = await service.writeCell('c1', CELIJA, 'u1');
      expect(ugasene).toHaveLength(0);
      expect(napravljeneCene).toHaveLength(0);
      expect(r.rateLineIds).toEqual(['ista', 'ista']);
    });

    it('promena samo prozora rezervisanja je i dalje izmena (§2.11e)', async () => {
      const { service, ugasene } = makeService({
        rateLineFindFirst: jest.fn().mockResolvedValue({
          id: 'stara',
          price: 3600,
          priceBasis: 'PER_PERSON_PER_NIGHT',
          bookingFrom: null,
          bookingTo: null,
        }),
      });
      await service.writeCell('c1', { ...CELIJA, bookingTo: '2025-12-31' }, 'u1');
      expect(ugasene).toHaveLength(2);
    });
  });

  describe('writeCell — odbijanja', () => {
    it('sezona bez opsega ne prima cenu', async () => {
      const { service } = makeService({ season: { ...SEZONA_1, ranges: [] } });
      await expect(service.writeCell('c1', CELIJA, 'u1')).rejects.toThrow(BadRequestException);
    });

    it('sezona iz drugog ugovora se ne vidi', async () => {
      const { service } = makeService({ season: { ...SEZONA_1, contractId: 'drugi' } });
      await expect(service.writeCell('c1', CELIJA, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('prazan tip sobe se odbija', async () => {
      const { service } = makeService();
      await expect(service.writeCell('c1', { ...CELIJA, roomType: '  ' }, 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('grid', () => {
    it('grupiše po tipu sobe i puni ćelije po sezoni', async () => {
      const { service } = makeService({
        seasons: [SEZONA_1],
        periods: [
          {
            id: 'p1',
            roomType: 'Budget double room',
            seasonId: 's1',
            stayFrom: new Date('2026-04-01'),
            stayTo: new Date('2026-05-31'),
            rateLines: [
              {
                id: 'rl1',
                boardType: 'NsD',
                occupancy: '2',
                priceBasis: 'PER_PERSON_PER_NIGHT',
                price: 3600,
                bookingFrom: null,
                bookingTo: null,
              },
            ],
          },
          {
            id: 'p2',
            roomType: 'Budget double room',
            seasonId: 's1',
            stayFrom: new Date('2026-10-01'),
            stayTo: new Date('2026-10-31'),
            rateLines: [
              {
                id: 'rl2',
                boardType: 'NsD',
                occupancy: '2',
                priceBasis: 'PER_PERSON_PER_NIGHT',
                price: 3600,
                bookingFrom: null,
                bookingTo: null,
              },
            ],
          },
        ],
      });

      const g = await service.grid('c1');
      expect(g.roomTypes).toHaveLength(1);
      expect(g.roomTypes[0].rows).toHaveLength(1);
      const cell = g.roomTypes[0].rows[0].cells['s1'];
      expect(cell.price).toBe(3600);
      expect(cell.periodIds).toEqual(['p1', 'p2']);
      expect(cell.neslozno).toBe(false);
    });

    it('razlika među opsezima iste sezone se PRIKAZUJE, ne ćuti', async () => {
      const { service } = makeService({
        seasons: [SEZONA_1],
        periods: [
          {
            id: 'p1',
            roomType: 'DBL',
            seasonId: 's1',
            stayFrom: new Date('2026-04-01'),
            stayTo: new Date('2026-05-31'),
            rateLines: [
              {
                id: 'rl1',
                boardType: 'NsD',
                occupancy: '2',
                priceBasis: 'PER_PERSON_PER_NIGHT',
                price: 3600,
                bookingFrom: null,
                bookingTo: null,
              },
            ],
          },
          {
            id: 'p2',
            roomType: 'DBL',
            seasonId: 's1',
            stayFrom: new Date('2026-10-01'),
            stayTo: new Date('2026-10-31'),
            rateLines: [
              {
                id: 'rl2',
                boardType: 'NsD',
                occupancy: '2',
                priceBasis: 'PER_PERSON_PER_NIGHT',
                price: 9900,
                bookingFrom: null,
                bookingTo: null,
              },
            ],
          },
        ],
      });

      const g = await service.grid('c1');
      expect(g.roomTypes[0].rows[0].cells['s1'].neslozno).toBe(true);
    });

    it('period bez sezone se prikazuje kao izuzetak, ne gubi se', async () => {
      const { service } = makeService({
        seasons: [SEZONA_1],
        periods: [
          {
            id: 'p9',
            roomType: 'Studio',
            seasonId: null,
            stayFrom: new Date('2026-07-01'),
            stayTo: new Date('2026-07-15'),
            rateLines: [],
          },
        ],
      });
      const g = await service.grid('c1');
      expect(g.roomTypes[0].bezSezone).toHaveLength(1);
      expect(g.roomTypes[0].bezSezone[0].stayFrom).toBe('2026-07-01');
    });
  });

  describe('sezone', () => {
    it('odbija drugu sezonu sa istom oznakom u istom ugovoru', async () => {
      const { service } = makeService({ seasonFindFirst: { id: 'x', code: '1' } });
      await expect(
        service.createSeason(
          'c1',
          { code: '1', ranges: [{ dateFrom: '2026-06-01', dateTo: '2026-06-30' }] },
          'u1',
        ),
      ).rejects.toThrow(/već postoji/);
    });

    it('odbija sezonu koja se preklapa sa postojećom', async () => {
      const { service } = makeService({ seasons: [SEZONA_1] });
      await expect(
        service.createSeason(
          'c1',
          { code: '2', ranges: [{ dateFrom: '2026-05-15', dateTo: '2026-06-30' }] },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('brisanje sezone NE briše periode — javlja koliko ih je ostalo', async () => {
      const { service, prisma } = makeService({ periodCount: 4 });
      const r = await service.deleteSeason('c1', 's1', 'u1');
      expect(r).toEqual({ deleted: true, periodaOstalo: 4 });
      expect(prisma.contractPeriod.create).not.toHaveBeenCalled();
    });
  });
});
