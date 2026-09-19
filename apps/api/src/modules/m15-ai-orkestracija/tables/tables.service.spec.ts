import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { applyTransform, TablesService } from './tables.service';
import { validateTableSpec } from './table-sources';

// M15 spec §6.5.4.10 / M17 §6e — Terminal tabela: registar, dozvole po izvoru, redovi iz
// postojećih servisa, poređenje perioda, transformacije koje server ponovo primeni pri izvozu.
describe('validateTableSpec (registar)', () => {
  it('nepoznat izvor / filter / vrednost / obavezan filter / period daju čitljivu grešku', () => {
    expect(validateTableSpec({ source: 'x' as never })).toMatchObject({
      error: expect.stringMatching(/Nepoznat izvor/),
    });
    expect(validateTableSpec({ source: 'bookings', filters: { foo: '1' } })).toMatchObject({
      error: expect.stringMatching(/Nepoznat filter "foo"/),
    });
    expect(validateTableSpec({ source: 'bookings', filters: { status: 'NEMA' } })).toMatchObject({
      error: expect.stringMatching(/nije dozvoljena/),
    });
    expect(validateTableSpec({ source: 'funnel' })).toMatchObject({
      error: expect.stringMatching(/obavezan/),
    });
    expect(
      validateTableSpec({ source: 'catalog', compare: { from: '2026-01-01', to: '2026-01-31' } }),
    ).toMatchObject({ error: expect.stringMatching(/nema period/) });
    expect(
      validateTableSpec({ source: 'bookings', filters: { status: ['CONFIRMED', 'MODIFIED'] } }),
    ).toEqual({ ok: true });
  });
});

describe('applyTransform (izvoz ponovo primeni isto što i pregledač)', () => {
  const rows = [
    { _key: 'a', mesto: 'Budva', prodajna: 100 },
    { _key: 'b', mesto: 'Budva', prodajna: 300 },
    { _key: 'c', mesto: 'Kotor', prodajna: 50 },
  ];
  it('filter contains + sort desc', () => {
    const out = applyTransform(rows, {
      filters: [{ column: 'mesto', op: 'contains', value: 'bud' }],
      sort: { column: 'prodajna', dir: 'desc' },
    });
    expect(out.map((r) => r._key)).toEqual(['b', 'a']);
  });
  it('gte nad brojem, groupBy dodaje red zbira po grupi, hidden skida kolonu', () => {
    const out = applyTransform(rows, {
      filters: [{ column: 'prodajna', op: 'gte', value: '100' }],
      groupBy: 'mesto',
      hidden: ['prodajna'],
    });
    expect(out.map((r) => r._key)).toEqual(['a', 'b', 'zbir:Budva']);
    expect(out[2].mesto).toBe('Budva (2)');
    expect('prodajna' in out[0]).toBe(false);
  });
});

describe('TablesService', () => {
  function make(opts: { allowed?: boolean; profitability?: boolean } = {}) {
    const permissions = {
      hasPermission: jest.fn(async (_u: string, _m: string, r: string) => {
        if (r === 'report:profitability') return opts.profitability ?? false;
        return opts.allowed ?? true;
      }),
    };
    const bookings = {
      findAll: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'b1',
            bookingNumber: 'TT-1',
            buyerName: 'Petar',
            channel: 'INTERNAL_PANEL',
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            createdAt: new Date('2026-09-01T10:00:00Z'),
            items: [
              {
                finalPrice: 1200,
                baseCost: 1000,
                finalPriceCurrency: 'EUR',
                stayFrom: new Date('2026-10-01'),
                stayTo: new Date('2026-10-08'),
                product: {
                  destinationCountry: 'Crna Gora',
                  destinationCity: 'Budva',
                  type: 'ACCOMMODATION',
                },
              },
            ],
          },
        ],
        hasMore: false,
      }),
    };
    const products = {
      findAll: jest.fn().mockResolvedValue({ data: [], hasMore: false, pageCount: 1 }),
    };
    const funnel = {
      funnel: jest.fn().mockResolvedValue({
        steps: [
          { key: 'Grčka / Halkidiki', searches: 3, shown: 3, quotes: 1, opened: 0, converted: 0 },
        ],
      }),
    };
    const item = (over: Record<string, unknown>) => ({
      kind: 'LOW_UNITS',
      date: '2026-09-25',
      contractId: 'c1',
      contractPeriodId: 'p1',
      productName: 'Hotel A',
      supplierName: 'S',
      destinationCity: 'Budva',
      destinationCountry: 'CG',
      roomType: 'DBL',
      detail: 'još 1',
      value: 1,
      noticeId: null,
      ...over,
    });
    const workQueue = {
      build: jest.fn().mockResolvedValue({
        generatedFor: '2026-09-19',
        items: [
          item({}),
          item({ kind: 'OVERBOOKED', contractId: 'c2', productName: 'Hotel B', value: -2 }),
        ],
      }),
    };
    return {
      service: new TablesService(
        permissions as any,
        bookings as any,
        products as any,
        funnel as any,
        workQueue as any,
      ),
      permissions,
      bookings,
      funnel,
    };
  }

  it('bookings — interni pozivalac dobija nabavnu/maržu/neto, red nosi _key i _href', async () => {
    const { service } = make();
    const r = await service.run({ source: 'bookings', filters: { status: ['CONFIRMED'] } }, 'u1');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0]).toMatchObject({
      _key: 'TT-1',
      _href: '/rezervacije/b1',
      mesto: 'Budva',
      noci: 7,
      prodajna: 1200,
      nabavna: 1000,
      marza: 200,
      marza_pct: 20,
      neto: 200,
    });
    expect(r.columns.some((c) => c.key === 'nabavna')).toBe(true);
  });

  it('bookings — maskiran pozivalac (bez baseCost u stavkama) ne dobija interne kolone', async () => {
    const { service, bookings } = make();
    (bookings.findAll as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          id: 'b1',
          bookingNumber: 'TT-1',
          items: [
            {
              finalPrice: 1200,
              finalPriceCurrency: 'EUR',
              stayFrom: new Date('2026-10-01'),
              stayTo: new Date('2026-10-03'),
              product: {},
            },
          ],
        },
      ],
      hasMore: false,
    });
    const r = await service.run({ source: 'bookings' }, 'u-b2b');
    expect(r.rows[0].nabavna).toBeUndefined();
    expect(r.columns.some((c) => c.key === 'nabavna')).toBe(false);
  });

  it('bez dozvole izvora → 403; funnel by_markup_rule traži i profitability', async () => {
    const { service } = make({ allowed: false });
    await expect(service.run({ source: 'bookings' }, 'u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const { service: s2 } = make({ allowed: true, profitability: false });
    await expect(
      s2.run({ source: 'funnel', filters: { dimension: 'by_markup_rule' } }, 'u1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('neispravan spec → 400 pre ikakvog upita', async () => {
    const { service, bookings } = make();
    await expect(
      service.run({ source: 'bookings', filters: { status: 'NEMA' } }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bookings.findAll).not.toHaveBeenCalled();
  });

  it('compare pokreće isti upit sa pomerenim periodom i vraća `previous`', async () => {
    const { service, bookings } = make();
    const r = await service.run(
      {
        source: 'bookings',
        filters: { createdFrom: '2026-09-01', createdTo: '2026-09-30' },
        compare: { from: '2026-08-01', to: '2026-08-31' },
      },
      'u1',
    );
    expect(r.previous).toHaveLength(1);
    const drugi = (bookings.findAll as jest.Mock).mock.calls[1][0];
    expect(drugi).toMatchObject({ createdFrom: '2026-08-01', createdTo: '2026-08-31' });
  });

  it('funnel — stepenice kao redovi sa fiksnim kolonama; work_queue — filter po vrsti', async () => {
    const { service } = make();
    const f = await service.run(
      { source: 'funnel', filters: { dimension: 'by_destination' } },
      'u1',
    );
    expect(f.columns.map((c) => c.key)).toEqual([
      'grupa',
      'upiti',
      'prikazano',
      'ponude',
      'otvorene',
      'rezervacije',
    ]);
    expect(f.rows[0]).toMatchObject({ grupa: 'Grčka / Halkidiki', upiti: 3 });
    const w = await service.run({ source: 'work_queue', filters: { kind: ['OVERBOOKED'] } }, 'u1');
    expect(w.rows).toHaveLength(1);
    expect(w.rows[0]).toMatchObject({
      vrsta: 'OVERBOOKED',
      objekat: 'Hotel B',
      _href: expect.stringContaining('/kapaciteti?contractId=c2'),
    });
  });
});
