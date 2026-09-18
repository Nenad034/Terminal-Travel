import { OFFER_EXPIRING_EVENT, OfferExpiryService } from './offer-expiry.service';

/**
 * M3 spec §4.9 — akcija pred istek. Težište: „tačno jednom po stavci po pragu", tri ograde
 * pred marketing, i pravilo „cena prve tranše" (§4.9.1) — sve mesta gde greška ne pada nego
 * tiho reklamira nešto što ne postoji ili se ne može prodati.
 */
describe('OfferExpiryService (§4.9)', () => {
  const DANAS = new Date('2026-09-17T09:00:00Z');
  const CONTRACT = { id: 'c1', supplierId: 's1', currency: 'EUR' };
  const PERIOD = {
    id: 'p1',
    contractId: 'c1',
    roomType: 'DBL',
    allotmentMode: 'FIXED',
    status: 'ACTIVE',
    seasonId: null,
    stayFrom: new Date('2027-06-01'),
    stayTo: new Date('2027-09-30'),
    contract: CONTRACT,
  };
  const PRODUCT = {
    id: 'prod1',
    status: 'ACTIVE',
    destinationCountry: 'Grčka',
    destinationCity: 'Kasandra',
    translations: [{ name: 'Aegean Breeze 4*' }],
  };

  function makeService(opts: {
    offers?: any[];
    discounts?: any[];
    rateLines?: any[];
    existing?: any[];
    product?: any;
    sellable?: boolean;
    thresholds?: Record<string, string>;
  }) {
    const created: any[] = [];
    const existing = opts.existing ?? [];
    const prisma = {
      pricelistOffer: { findMany: jest.fn().mockResolvedValue(opts.offers ?? []) },
      ancillaryService: { findMany: jest.fn().mockResolvedValue(opts.discounts ?? []) },
      rateLine: {
        findMany: jest
          .fn()
          // 1. poziv: cene sa rokom (već sa uključenim periodom); 2. poziv: sve aktivne cene tih perioda
          .mockResolvedValueOnce((opts.rateLines ?? []).filter((r) => r.bookingTo))
          .mockResolvedValueOnce(opts.rateLines ?? []),
      },
      offerExpiryNotice: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          const k = where.sourceType_sourceId_threshold;
          const hit = [...existing, ...created].find(
            (n) =>
              n.sourceType === k.sourceType &&
              n.sourceId === k.sourceId &&
              n.threshold === k.threshold,
          );
          return Promise.resolve(hit ? { id: hit.id } : null);
        }),
        create: jest.fn().mockImplementation(({ data }: any) => {
          const n = { id: `n${created.length + 1}`, ...data };
          created.push(n);
          return Promise.resolve(n);
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue(opts.product === undefined ? PRODUCT : opts.product),
      },
    };
    const auditLog = { write: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const capacity = {
      grid: jest.fn().mockResolvedValue({
        rows: [
          {
            contractPeriodId: 'p1',
            days: [{ date: '2027-06-01', zaProdaju: opts.sellable === false ? 0 : 3 }],
          },
        ],
      }),
    };
    const config = { get: jest.fn((k: string) => opts.thresholds?.[k]) };
    const service = new OfferExpiryService(
      prisma as any,
      auditLog as any,
      eventBus as any,
      capacity as any,
      config as any,
    );
    return { service, prisma, auditLog, eventBus, capacity, created };
  }

  const earlyBooking = (bookingTo: string, extra: Partial<any> = {}) => ({
    id: 'o1',
    offerType: 'EARLY_BOOKING',
    discountType: 'PERCENTAGE',
    discountPercentage: 15,
    discountAmount: null,
    stayNights: null,
    payNights: null,
    bookingTo: new Date(bookingTo),
    depositDeadline: null,
    status: 'ACTIVE',
    contractPeriod: PERIOD,
    ...extra,
  });

  it('pragovi su konfiguracija sa podrazumevanim 15/7', () => {
    const { service } = makeService({});
    expect(service.thresholdDays('INTERNAL')).toBe(15);
    expect(service.thresholdDays('MARKETING')).toBe(7);
    const { service: s2 } = makeService({
      thresholds: { M3_OFFER_EXPIRY_DAYS_INTERNAL: '20', M3_OFFER_EXPIRY_DAYS_MARKETING: 'x' },
    });
    expect(s2.thresholdDays('INTERNAL')).toBe(20);
    expect(s2.thresholdDays('MARKETING')).toBe(7);
  });

  it('rani buking 12 dana pre roka: INTERNAL zapis, bez događaja; drugi prolaz istog dana ne pravi drugi', async () => {
    const { service, created, eventBus } = makeService({ offers: [earlyBooking('2026-09-29')] });
    const r1 = await service.runDaily(DANAS);
    expect(r1.emitted).toEqual({ INTERNAL: 1, MARKETING: 0 });
    expect(created[0]).toMatchObject({
      threshold: 'INTERNAL',
      daysLeftAtEmit: 12,
      offerKind: 'EARLY_BOOKING',
      discountSummary: '−15 %',
      productName: 'Aegean Breeze 4*',
      contractPeriodId: 'p1',
    });
    expect(eventBus.emit).not.toHaveBeenCalled();

    const r2 = await service.runDaily(DANAS);
    expect(r2.emitted).toEqual({ INTERNAL: 0, MARKETING: 0 });
    expect(created).toHaveLength(1);
  });

  it('7 dana pre roka: oba praga („manje ili jednako", INTERNAL nije propušten), događaj tačno jednom sa datumom roka', async () => {
    const { service, eventBus, created } = makeService({ offers: [earlyBooking('2026-09-24')] });
    const r = await service.runDaily(DANAS);
    expect(r.emitted).toEqual({ INTERNAL: 1, MARKETING: 1 });
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    const [modul, dogadjaj, payload] = eventBus.emit.mock.calls[0];
    expect(modul).toBe('M3');
    expect(dogadjaj).toBe(OFFER_EXPIRING_EVENT);
    expect(payload).toMatchObject({
      source_type: 'PRICELIST_OFFER',
      source_id: 'o1',
      product_id: 'prod1',
      supplier_id: 's1',
      offer_kind: 'EARLY_BOOKING',
      discount_summary: '−15 %',
      booking_to: '2026-09-24',
      days_left: 7,
      stay_from: '2027-06-01',
      stay_to: '2027-09-30',
      has_subagent_allocations: false,
    });
    expect(created.map((n) => n.threshold)).toEqual(['INTERNAL', 'MARKETING']);

    await service.runDaily(DANAS);
    expect(eventBus.emit).toHaveBeenCalledTimes(1);
  });

  it('istekla juče: ništa (ni interno)', async () => {
    const { service, eventBus, created } = makeService({ offers: [earlyBooking('2026-09-16')] });
    const r = await service.runDaily(DANAS);
    expect(r.emitted).toEqual({ INTERNAL: 0, MARKETING: 0 });
    expect(created).toHaveLength(0);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('efektivan istek je min(booking_to, deposit_deadline)', async () => {
    const { service, created } = makeService({
      offers: [earlyBooking('2026-12-31', { depositDeadline: new Date('2026-09-20') })],
    });
    await service.runDaily(DANAS);
    expect(created.map((n) => n.threshold)).toEqual(['INTERNAL', 'MARKETING']);
    expect(created[0].daysLeftAtEmit).toBe(3);
  });

  describe('tri ograde pred MARKETING (§4.9.2) — INTERNAL prolazi svejedno', () => {
    it('neobjavljen proizvod (DRAFT): nema događaja, zadržano; sutra se gleda ponovo', async () => {
      const { service, eventBus, created } = makeService({
        offers: [earlyBooking('2026-09-24')],
        product: { ...PRODUCT, status: 'DRAFT' },
      });
      const r = await service.runDaily(DANAS);
      expect(r.emitted).toEqual({ INTERNAL: 1, MARKETING: 0 });
      expect(r.withheld).toBe(1);
      expect(eventBus.emit).not.toHaveBeenCalled();
      expect(created.map((n) => n.threshold)).toEqual(['INTERNAL']);
    });

    it('rasprodat period (nijedan dan sa za_prodaju ≥ 1): nema događaja', async () => {
      const { service, eventBus } = makeService({
        offers: [earlyBooking('2026-09-24')],
        sellable: false,
      });
      const r = await service.runDaily(DANAS);
      expect(r.emitted.MARKETING).toBe(0);
      expect(r.withheld).toBe(1);
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('ON_REQUEST period ne traži kapacitet', async () => {
      const { service, eventBus, capacity } = makeService({
        offers: [
          earlyBooking('2026-09-24', {
            contractPeriod: { ...PERIOD, allotmentMode: 'ON_REQUEST' },
          }),
        ],
        sellable: false,
      });
      const r = await service.runDaily(DANAS);
      expect(r.emitted.MARKETING).toBe(1);
      expect(capacity.grid).not.toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
    });
  });

  it('7=6 ponuda: sažetak „7=6", vrsta FREE_NIGHTS', async () => {
    const { service, created } = makeService({
      offers: [
        earlyBooking('2026-09-29', {
          offerType: 'FREE_NIGHTS',
          discountType: null,
          discountPercentage: null,
          stayNights: 7,
          payNights: 6,
        }),
      ],
    });
    await service.runDaily(DANAS);
    expect(created[0]).toMatchObject({ offerKind: 'FREE_NIGHTS', discountSummary: '7=6' });
  });

  it('popust (AncillaryService DISCOUNT) sa dometom na ceo ugovor: sažetak nosi naziv, period null', async () => {
    const { service, created } = makeService({
      discounts: [
        {
          id: 'a1',
          name: 'Popust za penzionere',
          kind: 'DISCOUNT',
          pricingMode: 'PERCENTAGE_OF_NIGHTLY_RATE',
          percentageOfNightlyRate: 10,
          flatAmount: null,
          bookingTo: new Date('2026-09-29'),
          contractId: 'c1',
          seasonId: null,
          contractPeriodId: null,
          contractPeriod: null,
          appliesToRoomTypes: [],
          contract: { ...CONTRACT, periods: [PERIOD, { ...PERIOD, id: 'p2', roomType: 'TRP' }] },
        },
      ],
    });
    await service.runDaily(DANAS);
    expect(created[0]).toMatchObject({
      sourceType: 'ANCILLARY_SERVICE',
      offerKind: 'DISCOUNT',
      discountSummary: '−10 % (Popust za penzionere)',
      contractPeriodId: null,
    });
  });

  describe('cena prve tranše (§4.9.1)', () => {
    const line = (id: string, price: number, extra: Partial<any> = {}) => ({
      id,
      contractPeriodId: 'p1',
      boardType: 'HB',
      occupancy: '2',
      priceBasis: 'PER_ROOM_PER_NIGHT',
      validWeekdays: [] as number[],
      price,
      bookingFrom: null,
      bookingTo: null,
      status: 'ACTIVE',
      contractPeriod: PERIOD,
      ...extra,
    });

    it('sa skupljom naslednicom posle roka: ulazi, sažetak kaže procenat i obe cene', async () => {
      const { service, created } = makeService({
        rateLines: [
          line('r1', 8000, { bookingTo: new Date('2026-09-29') }),
          line('r2', 10000, { bookingFrom: new Date('2026-09-30') }),
        ],
      });
      const r = await service.runDaily(DANAS);
      expect(r.scanned).toBe(1);
      expect(created[0]).toMatchObject({
        sourceType: 'RATE_LINE',
        sourceId: 'r1',
        offerKind: 'FIRST_TRANCHE',
        discountSummary: '−20 % do roka (80 EUR → 100 EUR)',
      });
    });

    it('bez naslednice: ne ulazi', async () => {
      const { service } = makeService({
        rateLines: [line('r1', 8000, { bookingTo: new Date('2026-09-29') })],
      });
      expect((await service.runDaily(DANAS)).scanned).toBe(0);
    });

    it('„naslednica" za drugu popunjenost ili jeftinija: ne ulazi', async () => {
      const { service } = makeService({
        rateLines: [
          line('r1', 8000, { bookingTo: new Date('2026-09-29') }),
          line('r2', 10000, { occupancy: '3' }),
          line('r3', 7000),
        ],
      });
      expect((await service.runDaily(DANAS)).scanned).toBe(0);
    });
  });

  it('acknowledge: upisuje ko i kad, idempotentno', async () => {
    const { service, prisma, auditLog } = makeService({});
    const notice = { id: 'n1', acknowledgedAt: null };
    prisma.offerExpiryNotice.findUnique.mockResolvedValue(notice);
    prisma.offerExpiryNotice.update.mockResolvedValue({ ...notice, acknowledgedBy: 'u1' });
    await service.acknowledge('n1', 'u1');
    expect(prisma.offerExpiryNotice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ acknowledgedBy: 'u1' }) }),
    );
    expect(auditLog.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pricelist.offer_expiry_acknowledged' }),
    );

    prisma.offerExpiryNotice.findUnique.mockResolvedValue({
      ...notice,
      acknowledgedAt: new Date(),
    });
    prisma.offerExpiryNotice.update.mockClear();
    await service.acknowledge('n1', 'u2');
    expect(prisma.offerExpiryNotice.update).not.toHaveBeenCalled();
  });

  describe('list — straničenje (dok. 50 nalaz 3.5)', () => {
    it('ne seče tiho na 200 — vraća total i stranicu', async () => {
      const { service, prisma } = makeService({});
      prisma.offerExpiryNotice.findMany = jest.fn().mockResolvedValue([{ id: 'n1' }]);
      prisma.offerExpiryNotice.count.mockResolvedValue(450);

      const rez = await service.list({ threshold: 'INTERNAL', page: 2, limit: 200 });

      expect(prisma.offerExpiryNotice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 200, take: 200 }),
      );
      expect(prisma.offerExpiryNotice.count).toHaveBeenCalledWith({
        where: { threshold: 'INTERNAL', acknowledgedAt: undefined },
      });
      expect(rez).toMatchObject({ total: 450, page: 2, pageCount: 3, hasMore: true });
    });
  });
});
