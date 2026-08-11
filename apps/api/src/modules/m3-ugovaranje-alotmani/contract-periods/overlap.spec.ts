import { BadRequestException } from '@nestjs/common';
import { assertNoContractPeriodOverlap } from './overlap';

describe('assertNoContractPeriodOverlap (M3 spec §2.3b)', () => {
  function makePrisma(conflicting: unknown) {
    return { contractPeriod: { findFirst: jest.fn().mockResolvedValue(conflicting) } };
  }

  it('baca BadRequestException kad postoji period koji se datumski preseca (isti contract+room_type)', async () => {
    const prisma = makePrisma({ id: 'p1', stayFrom: new Date('2027-07-01'), stayTo: new Date('2027-08-01') });

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
      assertNoContractPeriodOverlap(prisma as any, 'contract-1', 'DELUXE', new Date('2027-07-01'), new Date('2027-07-10')),
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
});
