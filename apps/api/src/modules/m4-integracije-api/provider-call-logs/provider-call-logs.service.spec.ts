import { ProviderCallLogsService } from './provider-call-logs.service';

// Raniji test ovog paketa zvao se „prosleđuje filtere Prisma upitu i ograničava na 200 zapisa"
// i tvrdio `take: 200` kao očekivano ponašanje. To je bio test koji ČUVA RUPU (zamka 13.6):
// granica od 200 nije bila odluka nego propust — dnevnik poziva ka dobavljačima puni se svakom
// pretragom, pa 200 redova pokriva minute rada, a ovo je dijagnostički alat gde nepotpuna
// lista vodi na pogrešan zaključak („nema poziva u tom periodu" umesto „ima ih iza granice").
// Zamenjen 6.9.2026 testovima koji opisuju ŽELJENO ponašanje: straničenje (dok. 39 nalaz 2.2).
describe('ProviderCallLogsService (M4 spec §7 — filtrirano po provajderu/operaciji/datumu)', () => {
  function makePrisma(total = 0, rows: unknown[] = []) {
    return {
      providerCallLog: {
        findMany: jest.fn().mockResolvedValue(rows),
        count: jest.fn().mockResolvedValue(total),
      },
      $transaction: jest.fn((operacije: Promise<unknown>[]) => Promise.all(operacije)),
    };
  }

  it('prosleđuje filtere Prisma upitu', async () => {
    const prisma = makePrisma();
    const service = new ProviderCallLogsService(prisma as any);

    await service.find({ providerCode: 'travelgate', operation: 'SEARCH' as any });

    expect(prisma.providerCallLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerCode: 'travelgate', operation: 'SEARCH' }),
        orderBy: { timestamp: 'desc' },
      }),
    );
  });

  it('bez parametara vraća prvu stranu od 50 — nema više tihe granice od 200', async () => {
    const prisma = makePrisma(4300, [{ id: 'a' }]);
    const service = new ProviderCallLogsService(prisma as any);

    const r = await service.find({});

    expect(prisma.providerCallLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }));
    // Jezgro nalaza: pozivalac vidi STVARAN broj poziva, ne broj koji je uspeo da povuče.
    expect(r.total).toBe(4300);
    expect(r.hasMore).toBe(true);
  });

  it('tražena strana preskače tačno prethodne strane', async () => {
    const prisma = makePrisma(4300, []);
    const service = new ProviderCallLogsService(prisma as any);

    await service.find({}, { page: 4, limit: 25 });

    expect(prisma.providerCallLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 75, take: 25 }));
  });

  it('brojanje koristi ISTI filter kao i upit — inače „prikazano 50 od N" laže', async () => {
    const prisma = makePrisma(12, []);
    const service = new ProviderCallLogsService(prisma as any);

    await service.find({ providerCode: 'solvex' });

    expect(prisma.providerCallLog.count).toHaveBeenCalledWith({
      where: prisma.providerCallLog.findMany.mock.calls[0][0].where,
    });
  });
});
