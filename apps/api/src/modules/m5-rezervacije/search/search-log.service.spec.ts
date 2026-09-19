import {
  leadTimeDays,
  MAX_RESULTS_LOGGED,
  nightsBetween,
  SearchLogService,
} from './search-log.service';

// M5 spec §3.0i (dopuna 8.9.2026) + §3.0k (19.9.2026, signali potražnje).
describe('SearchLogService', () => {
  function makeService() {
    const prisma = { searchLog: { create: jest.fn().mockResolvedValue({}) } };
    const service = new SearchLogService(prisma as any);
    return { service, prisma };
  }

  it('upisuje zapis sa svim prosleđenim poljima i vraća id koji je sam generisao', () => {
    const { service, prisma } = makeService();

    const id = service.log(
      {
        channel: 'B2C_SITE',
        productType: 'ACCOMMODATION',
        destinationCountry: 'Grčka',
        destinationCity: 'Halkidiki',
        resultCount: 5,
      },
      [],
      new Date('2026-09-19T10:00:00Z'),
    );

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(prisma.searchLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id,
        channel: 'B2C_SITE',
        actorId: undefined,
        clientAccountId: undefined,
        productType: 'ACCOMMODATION',
        destinationCountry: 'Grčka',
        destinationCity: 'Halkidiki',
        resultCount: 5,
        stayFrom: null,
        leadTimeDays: null,
        nights: null,
        amenityTags: [],
        results: undefined,
      }),
    });
  });

  it('§3.0k.1 — lead-time i noći se računaju pri upisu, gosti i tagovi se prenose', () => {
    const { service, prisma } = makeService();

    service.log(
      {
        channel: 'INTERNAL_PANEL',
        resultCount: 1,
        stayFrom: '2026-10-01',
        stayTo: '2026-10-08',
        adults: 2,
        children: 1,
        amenityTags: ['POOL'],
      },
      [],
      new Date('2026-09-19T23:30:00Z'),
    );

    const data = prisma.searchLog.create.mock.calls[0][0].data;
    expect(data.leadTimeDays).toBe(12);
    expect(data.nights).toBe(7);
    expect(data.adults).toBe(2);
    expect(data.children).toBe(1);
    expect(data.amenityTags).toEqual(['POOL']);
  });

  it('§3.0k.2 — prikazani rezultati idu kao deca sa rangom, najviše prvih 20', () => {
    const { service, prisma } = makeService();
    const rezultat = (i: number) => ({
      productId: `p${i}`,
      sourceType: 'CONTRACTED',
      offerFinalPrice: 1000 + i,
      offerBaseCost: 800,
      currency: 'EUR',
      markupRuleId: 'mr1',
      availabilityStatus: 'AVAILABLE',
      remainingUnits: 3,
      isRefundable: true,
    });

    service.log(
      { channel: 'B2C_SITE', resultCount: 25 },
      Array.from({ length: 25 }, (_, i) => rezultat(i + 1)),
    );

    const deca = prisma.searchLog.create.mock.calls[0][0].data.results.create;
    expect(deca).toHaveLength(MAX_RESULTS_LOGGED);
    expect(deca[0]).toMatchObject({ rank: 1, productId: 'p1', offerBaseCost: 800 });
    expect(deca[19]).toMatchObject({ rank: 20, productId: 'p20' });
  });

  it('ne baca kad upis padne — "fire and forget" (§3.0i.2)', async () => {
    const prisma = { searchLog: { create: jest.fn().mockRejectedValue(new Error('boom')) } };
    const service = new SearchLogService(prisma as any);

    expect(() => service.log({ channel: 'B2C_SITE', resultCount: 0 })).not.toThrow();
    // pusti mikrotask red da se odbijeni Promise obradi (catch u log()) pre kraja testa
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('leadTimeDays / nightsBetween (§3.0k.1)', () => {
  it('lead-time je razlika kalendarskih dana, ne sati', () => {
    expect(leadTimeDays('2026-09-20', new Date('2026-09-19T23:59:00Z'))).toBe(1);
    expect(leadTimeDays('2026-09-19', new Date('2026-09-19T00:01:00Z'))).toBe(0);
    expect(leadTimeDays(undefined, new Date())).toBeNull();
    expect(leadTimeDays('nije datum', new Date())).toBeNull();
  });

  it('noći: neispravan ili obrnut opseg daje null', () => {
    expect(nightsBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(nightsBetween('2026-10-08', '2026-10-01')).toBeNull();
    expect(nightsBetween('2026-10-01', undefined)).toBeNull();
  });
});
