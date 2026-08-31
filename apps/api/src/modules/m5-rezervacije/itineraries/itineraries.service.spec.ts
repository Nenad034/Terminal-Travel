import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ItinerariesService } from './itineraries.service';

// M5 spec §3.0.1 dopuna (31.8.2026, IDOR pregled) — Itinerary nije bio obuhvaćen ranijim Faza 8
// prolazom (bookings/quotes) jer tad još nije bio na dnevnom redu; isti obrazac ownership
// provere kao QuotesService/BookingsService, testiran ovde na isti način.
describe('ItinerariesService — vlasništvo (§3.0.1 dopuna, 31.8.2026)', () => {
  function makeService() {
    const prisma: any = {
      itinerary: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      itinerarySegment: { deleteMany: jest.fn(), createMany: jest.fn() },
      quote: { create: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      subagent: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
    };
    const builder = { build: jest.fn() };
    const subagentStub = { resolveClientAccountIdForSubagentContact: jest.fn().mockResolvedValue(null) };
    const service = new ItinerariesService(prisma, builder as any, subagentStub as any);
    return { service, prisma, builder, subagentStub };
  }

  describe('create — client_account_id se ne uzima slepo iz tela zahteva', () => {
    it('gost NE može da pripiše Itinerary tuđem nalogu — server prisilno koristi sopstveni', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.itinerary.create.mockResolvedValue({ id: 'it1' });

      await service.create({ channel: 'B2C_SITE', clientAccountId: 'acc-tudj' } as any, { userId: 'guest-1' });

      expect(prisma.itinerary.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ clientAccountId: 'acc-own' }) }),
      );
    });

    it('interno osoblje zadržava puno poverenje u clientAccountId iz tela zahteva', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.itinerary.create.mockResolvedValue({ id: 'it1' });

      await service.create({ channel: 'INTERNAL_PANEL', clientAccountId: 'acc-bilo-koji' } as any, { userId: 'staff-1' });

      expect(prisma.itinerary.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ clientAccountId: 'acc-bilo-koji' }) }),
      );
    });
  });

  describe('findOne — gost ne vidi tuđi itinerar', () => {
    it('vraća 404 za itinerar koji ne pripada pozivaocu, ne otkriva postojanje', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.itinerary.findUnique.mockResolvedValue({ id: 'it1', clientAccountId: 'acc-tudj', segments: [] });

      await expect(service.findOne('it1', 'guest-1')).rejects.toThrow(NotFoundException);
    });

    it('vraća sopstveni itinerar', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.itinerary.findUnique.mockResolvedValue({ id: 'it1', clientAccountId: 'acc-own', segments: [] });

      const result = await service.findOne('it1', 'guest-1');
      expect((result as any).id).toBe('it1');
    });

    it('interno osoblje vidi bilo koji itinerar', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.itinerary.findUnique.mockResolvedValue({ id: 'it1', clientAccountId: 'acc-tudj', segments: [] });

      const result = await service.findOne('it1', 'staff-1');
      expect((result as any).id).toBe('it1');
    });
  });

  describe('findAll — ownership se nameće za gost/B2B kontekst', () => {
    it('gost ne može da vidi tuđe itinerare slanjem tuđeg clientAccountId parametra', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.itinerary.findMany.mockResolvedValue([]);

      await service.findAll('acc-tudj', 'guest-1');

      expect(prisma.itinerary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientAccountId: 'acc-own' } }),
      );
    });

    it('interno osoblje zadržava puni klijentski clientAccountId filter', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.itinerary.findMany.mockResolvedValue([]);

      await service.findAll('bilo-koji', 'staff-1');

      expect(prisma.itinerary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientAccountId: 'bilo-koji' } }),
      );
    });
  });

  describe('update/convertToQuote — nasleđuju proveru vlasništva preko findOne', () => {
    it('update odbija izmenu tuđeg itinerara sa 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.itinerary.findUnique.mockResolvedValue({ id: 'it1', clientAccountId: 'acc-tudj', segments: [] });

      await expect(service.update('it1', {} as any, 'guest-1')).rejects.toThrow(NotFoundException);
      expect(prisma.itinerary.update).not.toHaveBeenCalled();
    });

    it('convertToQuote odbija konverziju tuđeg itinerara sa 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.itinerary.findUnique.mockResolvedValue({ id: 'it1', clientAccountId: 'acc-tudj', status: 'DRAFT', segments: [] });

      await expect(service.convertToQuote('it1', { userId: 'guest-1' })).rejects.toThrow(NotFoundException);
    });
  });

  // M5 spec §3.0.2/§3.0.3 dopuna (31.8.2026) — occupancy po segmentu (Marko-ov scenario: 4
  // putnika u jednom gradu, 2 u drugom) i is_included tiho preskakanje.
  describe('convertToQuote — occupancy po segmentu i is_included (§3.0.2/§3.0.3 dopuna)', () => {
    function builtItem(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        productId: 'p1',
        sourceType: 'CONTRACTED',
        stayFrom: new Date(),
        stayTo: new Date(),
        occupancy: { adults: 1, children: 0 },
        baseCost: 1000,
        baseCostCurrency: 'EUR',
        rateLineId: 'rl1',
        markupRuleId: 'mr1',
        finalPrice: 1200,
        finalPriceCurrency: 'EUR',
        providerQuoteReference: null,
        unitCount: 1,
        cancellationPolicySnapshot: null,
        quoteExpiresAt: null,
        ...overrides,
      };
    }

    it('koristi occupancy sa segmenta kad je popunjen (npr. 4 putnika u Rimu)', async () => {
      const { service, prisma, builder } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      const segmentOccupancy = { adults: 2, children: 2, roomConfig: [{ adults: 2, children: 2, childrenAges: [5, 8] }] };
      prisma.itinerary.findUnique.mockResolvedValue({
        id: 'it1',
        clientAccountId: 'acc-own',
        channel: 'B2C_SITE',
        status: 'DRAFT',
        segments: [{ id: 's1', productId: 'p1', isIncluded: true, stayFrom: new Date(), stayTo: new Date(), occupancy: segmentOccupancy }],
      });
      builder.build.mockResolvedValue(builtItem());
      prisma.quote.create.mockResolvedValue({ id: 'q1', items: [] });

      await service.convertToQuote('it1', { userId: 'guest-1' });

      expect(builder.build).toHaveBeenCalledWith(expect.objectContaining({ occupancy: segmentOccupancy }));
    });

    it('bez occupancy na segmentu zadržava staro ponašanje (1 odrasla osoba)', async () => {
      const { service, prisma, builder } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.itinerary.findUnique.mockResolvedValue({
        id: 'it1',
        clientAccountId: 'acc-own',
        channel: 'B2C_SITE',
        status: 'DRAFT',
        segments: [{ id: 's1', productId: 'p1', isIncluded: true, stayFrom: new Date(), stayTo: new Date(), occupancy: null }],
      });
      builder.build.mockResolvedValue(builtItem());
      prisma.quote.create.mockResolvedValue({ id: 'q1', items: [] });

      await service.convertToQuote('it1', { userId: 'guest-1' });

      expect(builder.build).toHaveBeenCalledWith(expect.objectContaining({ occupancy: { adults: 1, children: 0 } }));
    });

    it('segment sa is_included=false se tiho preskače, ne ulazi u Ponudu', async () => {
      const { service, prisma, builder } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.itinerary.findUnique.mockResolvedValue({
        id: 'it1',
        clientAccountId: 'acc-own',
        channel: 'B2C_SITE',
        status: 'DRAFT',
        segments: [
          { id: 's1', productId: 'p1', isIncluded: true, stayFrom: new Date(), stayTo: new Date(), occupancy: null },
          { id: 's2', productId: 'p2', isIncluded: false, stayFrom: new Date(), stayTo: new Date(), occupancy: null },
        ],
      });
      builder.build.mockResolvedValue(builtItem());
      prisma.quote.create.mockResolvedValue({ id: 'q1', items: [] });

      await service.convertToQuote('it1', { userId: 'guest-1' });

      expect(builder.build).toHaveBeenCalledTimes(1);
      expect(builder.build).toHaveBeenCalledWith(expect.objectContaining({ productId: 'p1' }));
    });
  });
});
