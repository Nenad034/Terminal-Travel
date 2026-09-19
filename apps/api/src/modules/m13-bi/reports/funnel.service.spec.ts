import { FunnelService, leadTimeBucket } from './funnel.service';

// M13 spec §4.4a (19.9.2026) — lijevak nad M5 §3.0k zapisom. Podaci su lažirani na nivou
// Prisma poziva; testira se ono što radi KOD: brojanje pet stepenica, grupisanje, rangovi, marža.
describe('FunnelService', () => {
  const logs = [
    {
      id: 'l1',
      channel: 'B2C_SITE',
      destinationCountry: 'Grčka',
      destinationCity: 'Halkidiki',
      leadTimeDays: 45,
      results: [
        {
          productId: 'pA',
          rank: 1,
          offerFinalPrice: 1200,
          offerBaseCost: 1000,
          markupRuleId: 'r1',
        },
        {
          productId: 'pB',
          rank: 2,
          offerFinalPrice: 1500,
          offerBaseCost: 1000,
          markupRuleId: 'r2',
        },
      ],
    },
    {
      id: 'l2',
      channel: 'B2C_SITE',
      destinationCountry: 'Grčka',
      destinationCity: 'Halkidiki',
      leadTimeDays: 3,
      results: [
        {
          productId: 'pA',
          rank: 1,
          offerFinalPrice: 1100,
          offerBaseCost: 1000,
          markupRuleId: 'r1',
        },
      ],
    },
    {
      id: 'l3',
      channel: 'INTERNAL_PANEL',
      destinationCountry: null,
      destinationCity: null,
      leadTimeDays: null,
      results: [],
    },
  ];
  const quotes = [
    {
      searchLogId: 'l1',
      status: 'CONVERTED',
      sharedViewCount: 2,
      items: [{ productId: 'pA', markupRuleId: 'r1' }],
    },
    {
      searchLogId: 'l2',
      status: 'DRAFT',
      sharedViewCount: 0,
      items: [{ productId: 'pA', markupRuleId: 'r1' }],
    },
  ];

  function make() {
    const prisma = {
      searchLog: { findMany: jest.fn().mockResolvedValue(logs) },
      quote: { findMany: jest.fn().mockResolvedValue(quotes) },
      productTranslation: {
        findMany: jest.fn().mockResolvedValue([{ productId: 'pA', name: 'Hotel A' }]),
      },
      markupRule: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', scopeType: 'PRODUCT', percentage: 15, fixedAmount: null },
          { id: 'r2', scopeType: 'GLOBAL', percentage: null, fixedAmount: 500 },
        ]),
      },
    };
    return { service: new FunnelService(prisma as any), prisma };
  }

  it('by_destination — pet stepenica, sortirano po broju upita', async () => {
    const { service } = make();
    const r: any = await service.funnel({ dimension: 'by_destination' });
    expect(r.steps[0]).toEqual({
      key: 'Grčka / Halkidiki',
      searches: 2,
      shown: 2,
      quotes: 2,
      opened: 1,
      converted: 1,
    });
    expect(r.steps[1]).toMatchObject({
      key: '(bez destinacije u upitu)',
      searches: 1,
      shown: 0,
      quotes: 0,
    });
  });

  it('by_lead_time — kategorije u fiksnom redosledu, ne prosek', async () => {
    const { service } = make();
    const r: any = await service.funnel({ dimension: 'by_lead_time' });
    expect(r.steps.map((s: any) => s.key)).toEqual(['<7 dana', '31–90 dana', 'nepoznato']);
    expect(r.steps[1]).toMatchObject({ searches: 1, converted: 1 });
  });

  it('shown_not_chosen — pB viđen a nikad izabran, pA prosečan rang 1', async () => {
    const { service } = make();
    const r: any = await service.funnel({ dimension: 'shown_not_chosen' });
    const pA = r.rows.find((x: any) => x.productId === 'pA');
    const pB = r.rows.find((x: any) => x.productId === 'pB');
    expect(pA).toMatchObject({
      productName: 'Hotel A',
      shown: 2,
      avgRank: 1,
      chosen: 2,
      converted: 1,
    });
    expect(pB).toMatchObject({ productName: null, shown: 1, avgRank: 2, chosen: 0, converted: 0 });
  });

  it('by_markup_rule — prosečna marža iz prikazanih ponuda, čitljiva oznaka pravila', async () => {
    const { service } = make();
    const r: any = await service.funnel({ dimension: 'by_markup_rule' });
    const r1 = r.rows.find((x: any) => x.markupRuleId === 'r1');
    const r2 = r.rows.find((x: any) => x.markupRuleId === 'r2');
    expect(r1).toMatchObject({
      ruleName: 'PRODUCT · 15%',
      shown: 2,
      chosen: 2,
      converted: 1,
      avgMarginPct: 15,
    });
    expect(r2).toMatchObject({
      ruleName: 'GLOBAL · 500 fiksno',
      shown: 1,
      chosen: 0,
      avgMarginPct: 50,
    });
  });

  it('opseg datuma ide u where, prazan opseg ne', async () => {
    const { service, prisma } = make();
    await service.funnel({ dimension: 'by_channel', from: '2026-09-01', to: '2026-09-30' });
    expect(prisma.searchLog.findMany.mock.calls[0][0].where.occurredAt).toBeDefined();
    await service.funnel({ dimension: 'by_channel' });
    expect(prisma.searchLog.findMany.mock.calls[1][0].where).toEqual({});
  });
});

describe('leadTimeBucket', () => {
  it.each([
    [null, 'nepoznato'],
    [0, '<7 dana'],
    [6, '<7 dana'],
    [7, '7–30 dana'],
    [30, '7–30 dana'],
    [31, '31–90 dana'],
    [90, '31–90 dana'],
    [91, '90+ dana'],
  ])('%s → %s', (d, k) => expect(leadTimeBucket(d as number | null)).toBe(k));
});
