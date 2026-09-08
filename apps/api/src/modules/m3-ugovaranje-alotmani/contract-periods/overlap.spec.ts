import { BadRequestException } from '@nestjs/common';
import { assertNoContractPeriodOverlap } from './overlap';

describe('assertNoContractPeriodOverlap (M3 spec §2.3b)', () => {
  function makePrisma(conflicting: unknown) {
    return { contractPeriod: { findFirst: jest.fn().mockResolvedValue(conflicting) } };
  }

  it('baca BadRequestException kad postoji period koji se datumski preseca (isti contract+room_type)', async () => {
    const prisma = makePrisma({
      id: 'p1',
      stayFrom: new Date('2027-07-01'),
      stayTo: new Date('2027-08-01'),
    });

    await expect(
      assertNoContractPeriodOverlap(
        prisma as any,
        'contract-1',
        'DELUXE',
        new Date('2027-07-15'),
        new Date('2027-07-20'),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('ne baca grešku kad nema preklapanja', async () => {
    const prisma = makePrisma(null);
    await expect(
      assertNoContractPeriodOverlap(
        prisma as any,
        'contract-1',
        'DELUXE',
        new Date('2027-07-01'),
        new Date('2027-07-10'),
      ),
    ).resolves.toBeUndefined();
  });

  it('upit isključuje sam period pri izmeni (excludePeriodId)', async () => {
    const prisma = makePrisma(null);
    await assertNoContractPeriodOverlap(
      prisma as any,
      'contract-1',
      'DELUXE',
      new Date('2027-07-01'),
      new Date('2027-07-10'),
      'period-being-edited',
    );

    const whereArg = (prisma.contractPeriod.findFirst as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.id).toEqual({ not: 'period-being-edited' });
  });

  it('šalje ispravan uslov strogog presecanja (stayFrom < other.stayTo AND stayTo > other.stayFrom)', async () => {
    const prisma = makePrisma(null);
    const stayFrom = new Date('2027-09-01');
    const stayTo = new Date('2027-09-10');
    await assertNoContractPeriodOverlap(prisma as any, 'contract-1', 'DELUXE', stayFrom, stayTo);

    const whereArg = (prisma.contractPeriod.findFirst as jest.Mock).mock.calls[0][0].where;
    expect(whereArg.stayFrom).toEqual({ lt: stayTo });
    expect(whereArg.stayTo).toEqual({ gt: stayFrom });
  });

  // §2.3e.2 (v1.20) — prozor prijave ulazi u proveru preklapanja. Bez ovoga bi sistem odbio
  // potpuno ispravan unos iz prakse: "isti boravak, 10 soba za prijave do 31.3., 5 posle".
  describe('prozor prijave (§2.3e.2)', () => {
    it('ne šalje uslov nad prozorom kad prozor nije zadat (zatečeno ponašanje ostaje isto)', async () => {
      const prisma = makePrisma(null);
      await assertNoContractPeriodOverlap(
        prisma as any,
        'c1',
        'DBL',
        new Date('2027-07-01'),
        new Date('2027-07-10'),
      );
      const where = prisma.contractPeriod.findFirst.mock.calls[0][0].where;
      expect(where.AND).toBeUndefined();
    });

    it('traži presek OBA opsega — u upit ulazi i uslov nad prozorom prijave', async () => {
      const prisma = makePrisma(null);
      await assertNoContractPeriodOverlap(
        prisma as any,
        'c1',
        'DBL',
        new Date('2027-07-01'),
        new Date('2027-07-10'),
        undefined,
        { from: new Date('2027-04-01'), to: new Date('2027-06-30') },
      );
      const where = prisma.contractPeriod.findFirst.mock.calls[0][0].where;
      expect(where.AND).toEqual([
        { OR: [{ bookingFrom: null }, { bookingFrom: { lte: new Date('2027-06-30') } }] },
        { OR: [{ bookingTo: null }, { bookingTo: { gte: new Date('2027-04-01') } }] },
      ]);
    });

    it('prozor bez donje granice ne ograničava upit sa te strane', async () => {
      const prisma = makePrisma(null);
      await assertNoContractPeriodOverlap(
        prisma as any,
        'c1',
        'DBL',
        new Date('2027-07-01'),
        new Date('2027-07-10'),
        undefined,
        { from: null, to: new Date('2027-03-31') },
      );
      const where = prisma.contractPeriod.findFirst.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(1);
    });

    it('poruka o sukobu navodi i prozor prijave postojećeg perioda', async () => {
      const prisma = makePrisma({
        id: 'p9',
        stayFrom: new Date('2027-07-01'),
        stayTo: new Date('2027-08-01'),
        bookingFrom: new Date('2027-01-01'),
        bookingTo: new Date('2027-03-31'),
      });
      await expect(
        assertNoContractPeriodOverlap(
          prisma as any,
          'c1',
          'DBL',
          new Date('2027-07-15'),
          new Date('2027-07-20'),
          undefined,
          { from: new Date('2027-02-01'), to: new Date('2027-02-28') },
        ),
      ).rejects.toThrow(/prijave 2027-01-01/);
    });
  });
});
