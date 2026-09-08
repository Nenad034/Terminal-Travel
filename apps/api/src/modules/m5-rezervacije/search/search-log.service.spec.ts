import { SearchLogService } from './search-log.service';

// M5 spec §3.0i (dopuna 8.9.2026).
describe('SearchLogService', () => {
  function makeService() {
    const prisma = { searchLog: { create: jest.fn().mockResolvedValue({}) } };
    const service = new SearchLogService(prisma as any);
    return { service, prisma };
  }

  it('upisuje zapis sa svim prosleđenim poljima', () => {
    const { service, prisma } = makeService();

    service.log({
      channel: 'B2C_SITE',
      productType: 'ACCOMMODATION',
      destinationCountry: 'Grčka',
      destinationCity: 'Halkidiki',
      resultCount: 5,
    });

    expect(prisma.searchLog.create).toHaveBeenCalledWith({
      data: {
        channel: 'B2C_SITE',
        actorId: undefined,
        clientAccountId: undefined,
        productType: 'ACCOMMODATION',
        destinationCountry: 'Grčka',
        destinationCity: 'Halkidiki',
        resultCount: 5,
      },
    });
  });

  it('ne baca kad upis padne — "fire and forget" (§3.0i.2)', async () => {
    const prisma = { searchLog: { create: jest.fn().mockRejectedValue(new Error('boom')) } };
    const service = new SearchLogService(prisma as any);

    expect(() => service.log({ channel: 'B2C_SITE', resultCount: 0 })).not.toThrow();
    // pusti mikrotask red da se odbijeni Promise obradi (catch u log()) pre kraja testa
    await new Promise((r) => setTimeout(r, 0));
  });
});
