import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('BookingsService (M5 spec §4/§6.4)', () => {
  function makeService() {
    const prisma: any = {
      quote: { findUnique: jest.fn(), update: jest.fn() },
      product: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
      providerConfig: { findUnique: jest.fn() },
      rateLine: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
      booking: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      // `aggregate` ima podrazumevanu vrednost otkako otkazivanje i dodavanje doplate
      // preračunavaju ukupno zaduženje (§6.7a) — bez nje bi svaki test koji ne mari za zbir
      // pucao na `undefined._sum`. Testovi kojima je zbir bitan i dalje postavljaju svoju.
      bookingItem: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { finalPrice: 0 } }),
      },
      ancillaryService: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      markupRule: { findUnique: jest.fn().mockResolvedValue({ id: 'mr-1', percentage: 0, fixedAmount: 0 }) },
      bookingItemGuest: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      subagent: { findUnique: jest.fn().mockResolvedValue(null) },
      userRole: { findFirst: jest.fn().mockResolvedValue(null) },
      bookingHandoffRequest: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    };
    const auditLog = { write: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const contractPeriods = { reserve: jest.fn(), release: jest.fn().mockResolvedValue({ released: true }) };
    const integrations = { confirmBooking: jest.fn(), cancelBooking: jest.fn() };
    const builder = { build: jest.fn() };
    const compliance = {
      checkTravelGuaranteeUtilization: jest.fn().mockResolvedValue({ allowed: true }),
      checkCreditLimitIfSubagent: jest.fn().mockResolvedValue({ isSubagent: false, allowed: true }),
      isActiveSubagentWithinCreditLimit: jest.fn().mockResolvedValue(false),
    };
    const clientContractStub = { hasGeneratedContract: jest.fn().mockResolvedValue(false) };
    const changeNotices = { prepareDraft: jest.fn() };
    const supplierManifests = { supersedeIfOnSentManifest: jest.fn(), prepareForBooking: jest.fn() };
    const subagentStub = { resolveClientAccountIdForSubagentContact: jest.fn().mockResolvedValue(null) };
    // M5 spec §6.6 (31.8.2026) — podrazumevano VIEW_ALL=true u testovima da postojeći
    // testovi (pisani pre ovog mehanizma) i dalje vide sve, bez potrebe za dodatnim mock-om
    // po testu; testovi specifični za §6.5/§6.6 ga eksplicitno menjaju gde je bitno.
    const permissions = { hasPermission: jest.fn().mockResolvedValue(true) };

    const service = new BookingsService(
      prisma,
      auditLog as any,
      eventBus as any,
      contractPeriods as any,
      integrations as any,
      builder as any,
      compliance as any,
      clientContractStub as any,
      changeNotices as any,
      supplierManifests as any,
      subagentStub as any,
      permissions as any,
    );
    return { service, prisma, auditLog, eventBus, contractPeriods, integrations, compliance, permissions, builder, supplierManifests };
  }

  describe('confirmQuote — sve ili ništa (§4, korak 3)', () => {
    it('oslobađa već rezervisanu prvu stavku kad druga stavka ne uspe, ne kreira Booking', async () => {
      const { service, prisma, contractPeriods } = makeService();

      const quote = {
        id: 'quote-1',
        status: 'DRAFT',
        expiresAt: new Date(Date.now() + 60_000),
        channel: 'INTERNAL_PANEL',
        contractTermsAccepted: false,
        clientAccountId: 'client-1',
        items: [
          { id: 'qi-1', productId: 'p1', sourceType: 'CONTRACTED', rateLineId: 'rl1', occupancy: { adults: 2, children: 0 }, finalPrice: 10000, finalPriceCurrency: 'EUR', unitCount: 1 },
          { id: 'qi-2', productId: 'p2', sourceType: 'CONTRACTED', rateLineId: 'rl2', occupancy: { adults: 2, children: 0 }, finalPrice: 8000, finalPriceCurrency: 'EUR', unitCount: 1 },
        ],
      };
      prisma.quote.findUnique.mockResolvedValue(quote);

      // §4.0a — oba proizvoda dele isti tip_nastupanja (POSREDNIK), bez konflikta.
      prisma.product.findUniqueOrThrow.mockResolvedValue({ sourceContract: { defaultTipNastupanja: 'POSREDNIK' } });

      prisma.rateLine.findUniqueOrThrow.mockImplementation(({ where }: any) => {
        if (where.id === 'rl1') return Promise.resolve({ contractPeriodId: 'period-1', contractPeriod: {} });
        return Promise.resolve({ contractPeriodId: 'period-2', contractPeriod: {} });
      });

      // Prva stavka uspeva, druga pada (nema kapaciteta).
      contractPeriods.reserve.mockImplementation((periodId: string) => {
        if (periodId === 'period-1') return Promise.resolve({ reserved: true, unitsSold: 1, remaining: 0 });
        return Promise.reject(new BadRequestException('Nema dovoljno preostalog kapaciteta'));
      });

      await expect(service.confirmQuote('quote-1', {} as any, { userId: 'actor-1' })).rejects.toThrow(BadRequestException);

      // §4 korak 3 — već rezervisana prva stavka MORA biti oslobođena.
      expect(contractPeriods.release).toHaveBeenCalledWith('period-1', 1, 'actor-1');
      // Nijedan Booking nije kreiran — "sve ili ništa".
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('odbija potvrdu kad Quote.client_account_id nije popunjen', async () => {
      const { service, prisma } = makeService();
      prisma.quote.findUnique.mockResolvedValue({
        id: 'quote-2',
        status: 'DRAFT',
        expiresAt: new Date(Date.now() + 60_000),
        channel: 'B2C_SITE',
        contractTermsAccepted: true,
        clientAccountId: null,
        items: [],
      });
      await expect(service.confirmQuote('quote-2', {} as any, { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('korak 1a — poziva M11 proveru garancije putovanja i blokira ORGANIZATOR potvrdu kad M11 vrati allowed=false', async () => {
      const { service, prisma, compliance } = makeService();
      compliance.checkTravelGuaranteeUtilization.mockResolvedValue({ allowed: false, reason: 'test-blokada-garancije' });
      prisma.quote.findUnique.mockResolvedValue({
        id: 'quote-3',
        status: 'DRAFT',
        expiresAt: new Date(Date.now() + 60_000),
        channel: 'INTERNAL_PANEL',
        contractTermsAccepted: false,
        clientAccountId: 'client-1',
        items: [{ id: 'qi-1', productId: 'p1', sourceType: 'CONTRACTED', finalPrice: 10000, finalPriceCurrency: 'EUR', unitCount: 1 }],
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ sourceContract: { defaultTipNastupanja: 'ORGANIZATOR' } });

      await expect(service.confirmQuote('quote-3', {} as any, { userId: 'actor-1' })).rejects.toThrow('test-blokada-garancije');
      expect(compliance.checkTravelGuaranteeUtilization).toHaveBeenCalledWith({ bookingTotalPrice: 10000, currency: 'EUR' });
      expect(prisma.booking.create).not.toHaveBeenCalled();
    });

    it('korak 1a — ne poziva M11 proveru garancije za POSREDNIK rezervacije (M11 spec §2.2)', async () => {
      const { service, prisma, contractPeriods, compliance } = makeService();
      prisma.quote.findUnique.mockResolvedValue({
        id: 'quote-4',
        status: 'DRAFT',
        expiresAt: new Date(Date.now() + 60_000),
        channel: 'INTERNAL_PANEL',
        contractTermsAccepted: false,
        clientAccountId: 'client-1',
        buyerName: 'Petar Petrović',
        buyerType: 'FIZICKO_LICE',
        items: [{ id: 'qi-1', productId: 'p1', sourceType: 'CONTRACTED', rateLineId: 'rl1', occupancy: { adults: 2, children: 0 }, finalPrice: 10000, finalPriceCurrency: 'EUR', unitCount: 1 }],
      });
      prisma.product.findUniqueOrThrow.mockResolvedValue({ sourceContract: { defaultTipNastupanja: 'POSREDNIK' } });
      prisma.rateLine.findUniqueOrThrow.mockResolvedValue({ contractPeriodId: 'period-1', contractPeriod: {} });
      contractPeriods.reserve.mockResolvedValue({ reserved: true, unitsSold: 1, remaining: 5 });
      prisma.booking.create.mockResolvedValue({ id: 'booking-4', items: [] });
      prisma.booking.findUnique.mockImplementation(({ where }: any) => {
        if (where.bookingNumber) return Promise.resolve(null); // §4 nextBookingNumber uniqueness check
        return Promise.resolve({
          id: 'booking-4',
          items: [],
          status: 'CONFIRMED',
          voucherUrl: null,
          paymentStatus: 'UNPAID',
          clientAccountId: 'client-1',
          tipNastupanja: 'POSREDNIK',
        });
      });

      await service.confirmQuote('quote-4', { buyerName: 'Petar Petrović', buyerType: 'FIZICKO_LICE' } as any, { userId: 'actor-1' });

      expect(compliance.checkTravelGuaranteeUtilization).not.toHaveBeenCalled();
    });

    it('rezerviše broj jedinica iz QuoteItem.unitCount, ne pretpostavlja uvek 1 (§4.2 dopuna v1.14)', async () => {
      const { service, prisma, contractPeriods } = makeService();

      const quote = {
        id: 'quote-multi',
        status: 'DRAFT',
        expiresAt: new Date(Date.now() + 60_000),
        channel: 'INTERNAL_PANEL',
        contractTermsAccepted: false,
        clientAccountId: 'client-1',
        items: [
          { id: 'qi-1', productId: 'p1', sourceType: 'CONTRACTED', rateLineId: 'rl1', occupancy: { adults: 4, children: 0, roomConfig: [{ adults: 2, children: 0 }, { adults: 2, children: 0 }] }, finalPrice: 20000, finalPriceCurrency: 'EUR', unitCount: 2 },
        ],
      };
      prisma.quote.findUnique.mockResolvedValue(quote);
      prisma.product.findUniqueOrThrow.mockResolvedValue({ sourceContract: { defaultTipNastupanja: 'POSREDNIK' } });
      prisma.rateLine.findUniqueOrThrow.mockResolvedValue({ contractPeriodId: 'period-multi', contractPeriod: {} });
      contractPeriods.reserve.mockResolvedValue({ reserved: true, unitsSold: 2, remaining: 0 });
      prisma.booking.create.mockResolvedValue({ id: 'booking-multi', items: [{ id: 'bi-1' }] });
      // prvi poziv: provera jedinstvenosti booking_number (nextBookingNumber) -> "ne postoji";
      // drugi poziv: findOne posle kreiranja, radi serializeBooking odgovora.
      prisma.booking.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: 'booking-multi', items: [] });

      await service.confirmQuote(
        'quote-multi',
        { buyerName: 'Petar Petrović', buyerType: 'FIZICKO_LICE' } as any,
        { userId: 'actor-1' },
      );

      expect(contractPeriods.reserve).toHaveBeenCalledWith('period-multi', 2, 'actor-1');
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ buyerName: 'Petar Petrović', buyerType: 'FIZICKO_LICE' }),
        }),
      );
    });

    it('odbija potvrdu kad je buyerType PRAVNO_LICE bez buyerTaxId (§4.1 dopuna v1.17)', async () => {
      const { service, prisma } = makeService();
      prisma.quote.findUnique.mockResolvedValue({
        id: 'quote-pravno',
        status: 'DRAFT',
        expiresAt: new Date(Date.now() + 60_000),
        channel: 'INTERNAL_PANEL',
        contractTermsAccepted: false,
        clientAccountId: 'client-1',
        items: [],
      });
      await expect(
        service.confirmQuote(
          'quote-pravno',
          { buyerName: 'Firma DOO', buyerType: 'PRAVNO_LICE' } as any,
          { userId: 'actor-1' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('odbija potvrdu samouslužnog kanala bez contract_terms_accepted (§3.1)', async () => {
      const { service, prisma } = makeService();
      prisma.quote.findUnique.mockResolvedValue({
        id: 'quote-3',
        status: 'DRAFT',
        expiresAt: new Date(Date.now() + 60_000),
        channel: 'B2C_SITE',
        contractTermsAccepted: false,
        clientAccountId: 'client-1',
        items: [],
      });
      await expect(service.confirmQuote('quote-3', {} as any, { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('gost NE može da potvrdi tuđu Ponudu — 404 (§6.2 dopuna)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'acc-own' });
      prisma.quote.findUnique.mockResolvedValue({
        id: 'quote-tudj',
        status: 'DRAFT',
        expiresAt: new Date(Date.now() + 60_000),
        channel: 'B2C_SITE',
        contractTermsAccepted: true,
        clientAccountId: 'acc-tudj',
        items: [],
      });

      await expect(service.confirmQuote('quote-tudj', {} as any, { userId: 'guest-1' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel — provera duplikata pre otkazivanja (§6.4)', () => {
    it('vraća upozorenje bez otkazivanja kad postoji podudaranje po imenu i preklapajućim datumima', async () => {
      const { service, prisma, contractPeriods } = makeService();

      const activeItem = {
        id: 'item-1',
        bookingId: 'booking-1',
        productId: 'product-1',
        sourceType: 'CONTRACTED',
        rateLineId: 'rl1',
        itemStatus: 'CONFIRMED',
        stayFrom: new Date('2027-05-10'),
        stayTo: new Date('2027-05-15'),
      };
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', items: [activeItem] });
      prisma.bookingItemGuest.findMany.mockResolvedValue([{ guestFirstName: 'Petar', guestLastName: 'Petrović' }]);

      const conflictingItem = {
        id: 'item-2',
        bookingId: 'booking-2',
        productId: 'product-1',
        itemStatus: 'CONFIRMED',
        booking: { bookingNumber: 'TT-2027-000002', paymentStatus: 'PAID' },
        guests: [{ guestFirstName: 'Petar', guestLastName: 'Petrovic' }], // bez dijakritike — i dalje "isto ime"
      };
      prisma.bookingItem.findMany.mockResolvedValue([conflictingItem]);

      const result: any = await service.cancel('booking-1', {}, { userId: 'actor-1' });

      expect(result.duplicateWarning).toBe(true);
      expect(result.conflictItemId).toBe('item-2');
      // Otkazivanje NIJE izvršeno — kapacitet nije oslobođen, stavka nije menjana.
      expect(contractPeriods.release).not.toHaveBeenCalled();
      expect(prisma.bookingItem.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel — oslobađanje kapaciteta i refund% (§6, §4.2 dopuna v1.14)', () => {
    it('oslobađa TAČAN broj rezervisanih jedinica (unit_count), ne uvek 1 — regresioni test za bivši bug', async () => {
      const { service, prisma, contractPeriods } = makeService();

      const item = {
        id: 'item-multi',
        bookingId: 'booking-multi',
        productId: 'product-1',
        sourceType: 'CONTRACTED',
        rateLineId: 'rl1',
        itemStatus: 'CONFIRMED',
        unitCount: 3,
        stayFrom: new Date(Date.now() + 40 * 86_400_000),
        stayTo: new Date(Date.now() + 45 * 86_400_000),
      };
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-multi', items: [item] });
      prisma.bookingItemGuest.findMany.mockResolvedValue([]); // nema gostiju vezanih -> nema duplikata, prolazi direktno
      prisma.rateLine.findUnique.mockResolvedValue({ contractPeriodId: 'period-multi', contractPeriod: { cancellationRules: [] } });
      prisma.bookingItem.count.mockResolvedValue(0);
      prisma.booking.update.mockResolvedValue({ id: 'booking-multi', items: [] });

      await service.cancel('booking-multi', {}, { userId: 'actor-1' });

      expect(contractPeriods.release).toHaveBeenCalledWith('period-multi', 3, 'actor-1');
    });

    it('računa refund% za API stavku iz cancellation_policy_snapshot, deterministički (§4.2 dopuna v1.14)', async () => {
      const { service, prisma } = makeService();

      const item = {
        id: 'item-api',
        bookingId: 'booking-api',
        productId: 'product-api',
        sourceType: 'API',
        rateLineId: null,
        supplierReference: 'ext-ref-1',
        itemStatus: 'CONFIRMED',
        unitCount: 1,
        cancellationPolicySnapshot: [
          { daysBeforeStay: 30, refundPercentage: 100 },
          { daysBeforeStay: 7, refundPercentage: 50 },
          { daysBeforeStay: 0, refundPercentage: 0 },
        ],
        stayFrom: new Date(Date.now() + 10 * 86_400_000),
        stayTo: new Date(Date.now() + 15 * 86_400_000),
      };
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-api', items: [item] });
      prisma.bookingItemGuest.findMany.mockResolvedValue([]);
      prisma.product.findUnique.mockResolvedValue({ sourceProvider: 'travelgate' });
      prisma.bookingItem.count.mockResolvedValue(0);
      prisma.booking.update.mockResolvedValue({ id: 'booking-api', items: [] });

      await service.cancel('booking-api', {}, { userId: 'actor-1' });

      // 10 dana do polaska -> primenjuje se pravilo za 7 dana pre (najspecifičnije koje je <= 10) -> 50%.
      expect(prisma.bookingItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cancellationRefundPercentage: 50 }) }),
      );
    });
  });

  describe('findOne — kontekst i vlasništvo (§6.2 dopuna, priprema za M8)', () => {
    const bookingItem = {
      id: 'item-1',
      productId: 'p1',
      sourceType: 'CONTRACTED',
      supplierReference: 'supplier-secret-ref',
      stayFrom: new Date(),
      stayTo: new Date(),
      baseCost: 5000,
      baseCostCurrency: 'EUR',
      rateLineId: 'rl1',
      markupRuleId: 'mr1',
      finalPrice: 8000,
      finalPriceCurrency: 'EUR',
      itemStatus: 'CONFIRMED',
      cancellationRefundPercentage: null,
      unitCount: 2,
      // §4.5 dopuna (1.9.2026) — šta je kupljeno i ko putuje; `findOne` ih uključuje u upit.
      product: {
        id: 'p1',
        type: 'ACCOMMODATION',
        destinationCity: 'Budva',
        destinationCountry: 'ME',
        translations: [
          { languageCode: 'sr', name: 'Hotel Slovenska Plaža' },
          { languageCode: 'en', name: 'Hotel Slovenska Plaza' },
        ],
      },
      guests: [{ id: 'g1', guestFirstName: 'Marko', guestLastName: 'Marković', guestProfileId: 'gp1' }],
    };

    it('interno osoblje (nema User zapis sa account_type GUEST/SUBAGENT_CONTACT) dobija pun prikaz bilo koje rezervacije', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'client-tudj', items: [bookingItem] });

      const result = await service.findOne('b1', 'staff-1');

      expect((result.items[0] as any).supplierReference).toBe('supplier-secret-ref');
    });

    it('gost (account_type GUEST) dobija maskiran prikaz sopstvene rezervacije, bez supplierReference/baseCost/markupRuleId/rateLineId', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'client-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'client-1', items: [bookingItem] });

      const result = await service.findOne('b1', 'guest-1');

      expect(result.items[0]).not.toHaveProperty('supplierReference');
      expect(result.items[0]).not.toHaveProperty('baseCost');
      expect(result.items[0]).not.toHaveProperty('markupRuleId');
      expect(result.items[0]).not.toHaveProperty('rateLineId');
      expect(result.items[0].finalPrice).toBe(8000);
      // §4.5 — gost SME da vidi šta je kupio i ko putuje (prirodan sadržaj vaučera);
      // maskira se isključivo identitet dobavljača i nabavna cena.
      expect((result.items[0] as any).product.name).toBe('Hotel Slovenska Plaža');
      expect((result.items[0] as any).guests).toHaveLength(1);
    });

    it('gost NE može da vidi tuđu rezervaciju — vraća 404, ne otkriva postojanje', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'client-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'client-tudj', items: [bookingItem] });

      await expect(service.findOne('b1', 'guest-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll — ownership se nameće za gost/B2B kontekst (§6.2 dopuna)', () => {
    it('gost ne može da vidi tuđe rezervacije slanjem tuđeg clientAccountId parametra — parametar se ignoriše', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'client-1' });
      prisma.booking.findMany.mockResolvedValue([]);

      await service.findAll({ clientAccountId: 'client-tudj' }, { userId: 'guest-1' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ clientAccountId: 'client-1' }) }),
      );
    });

    it('interno osoblje zadržava puni klijentski clientAccountId filter', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findMany.mockResolvedValue([]);

      await service.findAll({ clientAccountId: 'bilo-koji' }, { userId: 'staff-1' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ clientAccountId: 'bilo-koji' }) }),
      );
    });
  });

  describe('findAll/findOne — VIEW_ALL vidljivost (§6.6, 31.8.2026)', () => {
    it('podrazumevano (VIEW_ALL=true) interno osoblje NE dobija OR filter na vlasništvo/zaduženje', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findMany.mockResolvedValue([]);
      permissions.hasPermission.mockResolvedValue(true);

      await service.findAll({}, { userId: 'staff-1' });

      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
    });

    it('kad je korisnik sužen (DENY na VIEW_ALL), findAll filtrira na owner_id ILI assigned_to_id', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findMany.mockResolvedValue([]);
      permissions.hasPermission.mockResolvedValue(false);

      await service.findAll({}, { userId: 'staff-1' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: [{ ownerId: 'staff-1' }, { assignedToId: 'staff-1' }] }),
        }),
      );
    });

    it('findOne — sužen korisnik NE vidi tuđu (ni vlasnik ni zadužen) rezervaciju, vraća 404', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        clientAccountId: 'c1',
        ownerId: 'neko-drugi',
        assignedToId: 'neko-drugi',
        items: [],
      });
      permissions.hasPermission.mockResolvedValue(false);

      await expect(service.findOne('b1', 'staff-1')).rejects.toThrow(NotFoundException);
    });

    // §4.6/§6.6 dopuna (1.9.2026) — predstavnik na destinaciji nije ni owner ni assignedTo
    // (to su prodajne uloge), pa mu je pristup vezan isključivo za stvarnu dodelu na stavci.
    it('findOne — predstavnik (VODIC) VIDI rezervaciju na kojoj mu je stavka dodeljena', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', ownerId: 'neko-drugi', assignedToId: 'neko-drugi', items: [] });
      permissions.hasPermission.mockResolvedValue(false);
      prisma.bookingItem.count.mockResolvedValue(1);

      await expect(service.findOne('b1', 'vodic-1')).resolves.toBeDefined();
      expect(prisma.bookingItem.count).toHaveBeenCalledWith({ where: { bookingId: 'b1', assignedGuideId: 'vodic-1' } });
    });

    it('findOne — predstavnik NE vidi rezervaciju na kojoj mu ništa nije dodeljeno (404)', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', ownerId: 'neko-drugi', assignedToId: 'neko-drugi', items: [] });
      permissions.hasPermission.mockResolvedValue(false);
      prisma.bookingItem.count.mockResolvedValue(0);

      await expect(service.findOne('b1', 'vodic-2')).rejects.toThrow(NotFoundException);
    });

    it('findOne — sužen korisnik I DALJE vidi rezervaciju gde je zadužen (assigned_to_id), iako nije vlasnik', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        clientAccountId: 'c1',
        ownerId: 'neko-drugi',
        assignedToId: 'staff-1',
        items: [],
      });
      permissions.hasPermission.mockResolvedValue(false);

      const result = await service.findOne('b1', 'staff-1');
      expect((result as any).id).toBe('b1');
    });

    it('findAll — franšizni STAFF nalog dobija dodatni filter na sopstveni franchise_subagent_id, čak i sa VIEW_ALL=true', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: 'subagent-fr-1' });
      prisma.subagent.findUnique.mockResolvedValue({ id: 'subagent-fr-1', privilegeLevel: 'FRANCHISE' });
      prisma.booking.findMany.mockResolvedValue([]);
      permissions.hasPermission.mockResolvedValue(true);

      await service.findAll({}, { userId: 'franchise-staff-1' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ franchiseSubagentId: 'subagent-fr-1' }) }),
      );
    });
  });

  // Faza 8 IDOR pregled (31.8.2026). Nalaz: `cancel`/`modify`/`updatePaymentStatus`/
  // `voucherOverride`/`assignGuide` učitavali su rezervaciju/stavku direktno po ID-u bez ikakve
  // provere konteksta — samo `findOne` je proveravao vlasništvo/zaduženje. Gost/sužen STAFF je
  // mogao pogađanjem ID-a da izmeni/otkaže TUĐU rezervaciju. Ispravljeno deljenim proverivačem
  // `assertBookingAccessible`, ovde se proverava da svaka od tih metoda sada odbija tuđu rezervaciju.
  describe('cancel/modify/updatePaymentStatus/voucherOverride/assignGuide — IDOR ispravka (31.8.2026)', () => {
    it('gost NE može da otkaže tuđu rezervaciju — vraća 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'client-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'client-tudj', items: [] });

      await expect(service.cancel('b1', {}, { userId: 'guest-1' })).rejects.toThrow(NotFoundException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('gost NE može da izmeni stavku tuđe rezervacije — vraća 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'client-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'client-tudj', items: [] });

      await expect(service.modify('b1', { bookingItemId: 'item-1' } as any, { userId: 'guest-1' })).rejects.toThrow(NotFoundException);
    });

    it('gost NE može da promeni status plaćanja tuđe rezervacije — vraća 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'client-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'client-tudj' });

      await expect(service.updatePaymentStatus('b1', 'PAID' as any, { userId: 'guest-1' })).rejects.toThrow(NotFoundException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('gost NE može da izdejstvuje voucher override na tuđoj rezervaciji — vraća 404', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'client-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'client-tudj' });

      await expect(service.voucherOverride('b1', 'razlog', { userId: 'guest-1' })).rejects.toThrow(NotFoundException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('sužen STAFF (bez VIEW_ALL, nije vlasnik ni zadužen) NE može da dodeli vodiča na stavci tuđe rezervacije — vraća 404', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.bookingItem.findUnique.mockResolvedValue({ id: 'item-1', bookingId: 'b1', assignedGuideId: null });
      prisma.booking.findUniqueOrThrow.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', ownerId: 'neko-drugi', assignedToId: 'neko-drugi' });
      permissions.hasPermission.mockResolvedValue(false);

      await expect(service.assignGuide('item-1', 'guide-1', { userId: 'staff-1' })).rejects.toThrow(NotFoundException);
      expect(prisma.bookingItem.update).not.toHaveBeenCalled();
    });

    it('sužen STAFF I DALJE može da otkaže rezervaciju gde je zadužen (assigned_to_id)', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      const item = {
        id: 'item-1',
        bookingId: 'b1',
        productId: 'p1',
        sourceType: 'CONTRACTED',
        rateLineId: 'rl1',
        itemStatus: 'CONFIRMED',
        unitCount: 1,
        stayFrom: new Date(Date.now() + 40 * 86_400_000),
        stayTo: new Date(Date.now() + 45 * 86_400_000),
      };
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        clientAccountId: 'c1',
        ownerId: 'neko-drugi',
        assignedToId: 'staff-1',
        items: [item],
      });
      prisma.bookingItemGuest.findMany.mockResolvedValue([]);
      prisma.rateLine.findUnique.mockResolvedValue({ contractPeriodId: 'period-1', contractPeriod: { cancellationRules: [] } });
      prisma.bookingItem.count.mockResolvedValue(0);
      prisma.booking.update.mockResolvedValue({ id: 'b1', items: [] });
      permissions.hasPermission.mockResolvedValue(false);

      await expect(service.cancel('b1', {}, { userId: 'staff-1' })).resolves.toBeDefined();
    });
  });

  // Dopuna (2.9.2026, na zahtev vlasnika — "podaci predstavnika treba automatski da se pojave
  // na vaučeru"): javan sadržaj vaučera, uklj. kontakt predstavnika po stavci.
  describe('getVoucherContent (§6, dopuna 2.9.2026)', () => {
    it('baca 404 kad vaučer još nije izdat (voucher_url prazan)', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', voucherUrl: null, items: [] });

      await expect(service.getVoucherContent('b1')).rejects.toThrow(NotFoundException);
    });

    it('vraća maskiran sadržaj sa kontaktom predstavnika, bez supplier polja', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        bookingNumber: 'TT-2027-000123',
        buyerName: 'Jovana Marković',
        totalPrice: 120000,
        currency: 'EUR',
        voucherUrl: 'http://localhost:3200/rezervacija/vaucer/b1',
        items: [
          {
            id: 'item-1',
            assignedGuideId: 'guide-1',
            stayFrom: new Date('2027-08-10'),
            stayTo: new Date('2027-08-17'),
            unitCount: 1,
            guests: [{ guestFirstName: 'Ana', guestLastName: 'Anić' }],
            product: { type: 'ACCOMMODATION', destinationCity: 'Sitonija', destinationCountry: 'GR', translations: [{ languageCode: 'sr', name: 'Hotel Test' }] },
          },
        ],
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'guide-1', fullName: 'Ana Vodić', phone: '+381601234567', email: 'ana@tt.rs' }]);

      const result = await service.getVoucherContent('b1');

      expect(result.bookingNumber).toBe('TT-2027-000123');
      expect(result.items[0].productName).toBe('Hotel Test');
      expect(result.items[0].representative).toEqual({ fullName: 'Ana Vodić', phone: '+381601234567', email: 'ana@tt.rs' });
      expect(result).not.toHaveProperty('supplierReference');
      expect(JSON.stringify(result)).not.toMatch(/rateLine|markupRule|baseCost/i);
    });
  });

  // Dopuna (2.9.2026, na zahtev vlasnika — kartica Aranžman): `modify` sad prima opcioni
  // `productId` (zamena USLUGE, ne samo datuma) i postoji `previewModify` (ista logika, ništa
  // ne upisuje — "provera cene" pre potvrde).
  describe('modify — izmena usluge + previewModify (§6, dopuna 2.9.2026)', () => {
    function baseItem() {
      return {
        id: 'item-1',
        bookingId: 'b1',
        productId: 'p-old',
        sourceType: 'CONTRACTED' as const,
        rateLineId: null, // bez rate_line_id — releaseItemCapacity je no-op, testu ne treba dodatan mock
        itemStatus: 'CONFIRMED' as const,
        unitCount: 1,
        finalPrice: 10000,
        finalPriceCurrency: 'EUR',
        stayFrom: new Date(Date.now() + 40 * 86_400_000),
        stayTo: new Date(Date.now() + 45 * 86_400_000),
      };
    }
    function builtReplacement(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        productId: 'p-new',
        sourceType: 'CONTRACTED',
        stayFrom: new Date(),
        stayTo: new Date(),
        baseCost: 9000,
        baseCostCurrency: 'EUR',
        rateLineId: 'rl-new',
        markupRuleId: 'mr-1',
        finalPrice: 12000,
        finalPriceCurrency: 'EUR',
        unitCount: 1,
        cancellationPolicySnapshot: null,
        occupancy: { adults: 2, children: 0 },
        ...overrides,
      };
    }

    it('odbija izmenu kad nova usluga nije istog tipa proizvoda kao postojeća stavka', async () => {
      const { service, prisma, builder } = makeService();
      const item = baseItem();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', items: [item] });
      prisma.product.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === 'p-old' ? { id: 'p-old', type: 'ACCOMMODATION' } : { id: 'p-new', type: 'TRANSFER' }),
      );

      await expect(
        service.modify('b1', { bookingItemId: 'item-1', productId: 'p-new', stayFrom: '2027-01-01', stayTo: '2027-01-05', occupancy: { adults: 2, children: 0 } } as any, {
          userId: 'staff-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(builder.build).not.toHaveBeenCalled();
      expect(prisma.bookingItem.create).not.toHaveBeenCalled();
    });

    it('modify prosleđuje novi productId builder-u kad je dat (izmena usluge, isti tip)', async () => {
      const { service, prisma, builder, contractPeriods } = makeService();
      const item = baseItem();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', items: [item] });
      prisma.product.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.id === 'p-old' ? { id: 'p-old', type: 'ACCOMMODATION' } : { id: 'p-new', type: 'ACCOMMODATION' }),
      );
      const built = builtReplacement();
      builder.build.mockResolvedValue([built]);
      prisma.rateLine.findUniqueOrThrow.mockResolvedValue({ contractPeriodId: 'period-new' });
      contractPeriods.reserve.mockResolvedValue({ reserved: true });
      prisma.bookingItem.create.mockResolvedValue({ id: 'item-2', ...built });
      prisma.bookingItem.aggregate.mockResolvedValue({ _sum: { finalPrice: 12000 } });
      prisma.booking.update.mockResolvedValue({ id: 'b1', items: [] });

      await service.modify(
        'b1',
        { bookingItemId: 'item-1', productId: 'p-new', stayFrom: '2027-01-01', stayTo: '2027-01-05', occupancy: { adults: 2, children: 0 } } as any,
        { userId: 'staff-1' },
      );

      expect(builder.build).toHaveBeenCalledWith(expect.objectContaining({ productId: 'p-new' }));
      expect(prisma.bookingItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ productId: 'p-new' }) }));
    });

    it('previewModify vraća novu cenu bez ijedne rezervacije/upisa', async () => {
      const { service, prisma, builder, contractPeriods } = makeService();
      const item = baseItem();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', items: [item] });
      const built = builtReplacement({ finalPrice: 15000 });
      builder.build.mockResolvedValue([built]);

      const result = await service.previewModify(
        'b1',
        { bookingItemId: 'item-1', stayFrom: '2027-02-01', stayTo: '2027-02-10', occupancy: { adults: 2, children: 0 } } as any,
        { userId: 'staff-1' },
      );

      expect(result).toEqual({ currentPrice: 10000, currentCurrency: 'EUR', newPrice: 15000, newCurrency: 'EUR', priceDifference: 5000 });
      expect(contractPeriods.reserve).not.toHaveBeenCalled();
      expect(prisma.bookingItem.create).not.toHaveBeenCalled();
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });
  });

  // M5 spec §6.7 (3.9.2026, vlasnikov nalaz) — dodavanje NOVE usluge na postojeću rezervaciju.
  describe('addItem/previewAddItem (§6.7, 3.9.2026)', () => {
    function builtNew(overrides: Record<string, unknown> = {}) {
      return {
        productId: 'p-transfer',
        sourceType: 'CONTRACTED',
        stayFrom: new Date(),
        stayTo: new Date(),
        baseCost: 3000,
        baseCostCurrency: 'EUR',
        rateLineId: 'rl-t',
        markupRuleId: 'mr-1',
        finalPrice: 4000,
        finalPriceCurrency: 'EUR',
        unitCount: 1,
        cancellationPolicySnapshot: null,
        occupancy: { adults: 2, children: 0 },
        ...overrides,
      };
    }
    const dto = { productId: 'p-transfer', stayFrom: '2027-01-01', stayTo: '2027-01-02', occupancy: { adults: 2, children: 0 } } as any;

    it('dodaje stavku, preračunava ukupno i pokreće NOVU najavu za CONTRACTED (odluka vlasnika)', async () => {
      const { service, prisma, contractPeriods, builder, supplierManifests, eventBus } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', totalPrice: 10000, items: [] });
      builder.build.mockResolvedValue([builtNew()]);
      prisma.rateLine.findUniqueOrThrow.mockResolvedValue({ contractPeriodId: 'period-t' });
      contractPeriods.reserve.mockResolvedValue({ reserved: true });
      prisma.bookingItem.create.mockResolvedValue({ id: 'item-new' });
      prisma.bookingItem.aggregate.mockResolvedValue({ _sum: { finalPrice: 14000 } });
      prisma.booking.update.mockResolvedValue({ id: 'b1', items: [] });

      await service.addItem('b1', dto, { userId: 'staff-1' });

      // kapacitet PRE upisa stavke — obrnut redosled bi ostavio stavku bez pokrivenog kapaciteta
      expect(contractPeriods.reserve).toHaveBeenCalled();
      expect(prisma.bookingItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ productId: 'p-transfer', announcedAt: null }) }),
      );
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'MODIFIED', totalPrice: 14000 }) }),
      );
      expect(supplierManifests.prepareForBooking).toHaveBeenCalledWith('b1', 'staff-1');
      expect(eventBus.emit).toHaveBeenCalledWith('M5', 'booking.item_added', expect.objectContaining({ bookingId: 'b1' }));
    });

    it('API stavka je najavljena istog trenutka i ne pokreće pripremu najave (§8.6)', async () => {
      const { service, prisma, integrations, builder, supplierManifests } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', totalPrice: 0, items: [] });
      builder.build.mockResolvedValue([builtNew({ sourceType: 'API', rateLineId: null })]);
      prisma.product.findUniqueOrThrow.mockResolvedValue({ id: 'p-transfer', sourceProvider: 'PROV', sourceExternalId: 'x1' });
      integrations.confirmBooking.mockResolvedValue({ status: 'CONFIRMED', providerBookingReference: 'REF-1' });
      prisma.bookingItem.create.mockResolvedValue({ id: 'item-new' });
      prisma.bookingItem.aggregate.mockResolvedValue({ _sum: { finalPrice: 4000 } });
      prisma.booking.update.mockResolvedValue({ id: 'b1', items: [] });

      await service.addItem('b1', dto, { userId: 'staff-1' });

      const created = prisma.bookingItem.create.mock.calls[0][0].data;
      expect(created.announcedAt).toBeInstanceOf(Date);
      expect(created.supplierConfirmedAt).toBeInstanceOf(Date);
      expect(supplierManifests.prepareForBooking).not.toHaveBeenCalled();
    });

    it('odbija dodavanje iz B2B (subagentskog) konteksta — dodaje isključivo interni tim', async () => {
      const { service, prisma, builder } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'SUBAGENT_CONTACT', linkedProfileId: 'sub-1' });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', totalPrice: 0, items: [] });

      await expect(service.addItem('b1', dto, { userId: 'sub-user' })).rejects.toThrow();
      expect(builder.build).not.toHaveBeenCalled();
      expect(prisma.bookingItem.create).not.toHaveBeenCalled();
    });

    it('odbija dodavanje na otkazanu rezervaciju i PACKAGE proizvod', async () => {
      const { service, prisma, builder } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CANCELLED', totalPrice: 0, items: [] });
      await expect(service.addItem('b1', dto, { userId: 'staff-1' })).rejects.toThrow(BadRequestException);

      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', totalPrice: 0, items: [] });
      builder.build.mockResolvedValue([builtNew(), builtNew()]); // PACKAGE gradi više stavki odjednom
      await expect(service.addItem('b1', dto, { userId: 'staff-1' })).rejects.toThrow(BadRequestException);
      expect(prisma.bookingItem.create).not.toHaveBeenCalled();
    });

    it('previewAddItem vraća cenu i novo ukupno, bez ijedne rezervacije/upisa', async () => {
      const { service, prisma, builder, contractPeriods } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', totalPrice: 10000, items: [] });
      builder.build.mockResolvedValue([builtNew({ finalPrice: 4500 })]);

      const result = await service.previewAddItem('b1', dto, { userId: 'staff-1' });

      expect(result).toEqual({ newPrice: 4500, newCurrency: 'EUR', bookingTotalBefore: 10000, bookingTotalAfter: 14500 });
      expect(contractPeriods.reserve).not.toHaveBeenCalled();
      expect(prisma.bookingItem.create).not.toHaveBeenCalled();
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });
  });

  // M5 spec §6.7a (3.9.2026) — doplate i popusti kao VEZANE stavke.
  describe('doplate i popusti kao vezane stavke (§6.7a, 3.9.2026)', () => {
    function parentItem(over: Record<string, unknown> = {}) {
      return {
        id: 'item-1',
        bookingId: 'b1',
        productId: 'p1',
        sourceType: 'CONTRACTED' as const,
        supplierReference: 'REF',
        stayFrom: new Date('2027-07-01'),
        stayTo: new Date('2027-07-08'), // 7 noći
        baseCost: 70000,
        baseCostCurrency: 'EUR',
        rateLineId: 'rl-1',
        markupRuleId: 'mr-1',
        finalPrice: 84000,
        finalPriceCurrency: 'EUR',
        itemStatus: 'CONFIRMED' as const,
        unitCount: 1,
        parentItemId: null,
        payable: 'AGENCY' as const,
        announcedAt: null,
        supplierConfirmedAt: null,
        guests: [{ id: 'g1' }, { id: 'g2' }],
        ...over,
      };
    }
    function ancillary(over: Record<string, unknown> = {}) {
      return {
        id: 'anc-1',
        name: 'Parking',
        kind: 'SURCHARGE',
        pricingMode: 'FLAT_PER_UNIT',
        flatAmount: 500,
        percentageOfNightlyRate: null,
        priceBasis: 'PER_ROOM_PER_NIGHT',
        coversPersons: 4,
        maxAdults: null,
        maxChildren: null,
        childMaxAge: null,
        payable: 'AGENCY',
        isMandatory: false,
        isRefundable: false,
        maxQuantity: null,
        notes: null,
        ...over,
      };
    }

    it('dodaje doplatu kao vezanu stavku i računa cenu iz osnove (7 noći × 1 soba × 5,00)', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', items: [parentItem()] });
      prisma.ancillaryService.findUnique.mockResolvedValue(ancillary());
      prisma.bookingItem.create.mockResolvedValue({ id: 'anc-item' });
      prisma.booking.update.mockResolvedValue({ id: 'b1', items: [] });

      await service.addAncillaryToItem('b1', 'item-1', { ancillaryServiceId: 'anc-1' } as any, { userId: 'staff-1' });

      const data = prisma.bookingItem.create.mock.calls[0][0].data;
      expect(data.baseCost).toBe(3500);
      expect(data.parentItemId).toBe('item-1');
      expect(data.ancillaryServiceId).toBe('anc-1');
      // nasleđuje dobavljača matične stavke — bez toga vaučer i najava po dobavljaču ne rade
      expect(data.supplierReference).toBe('REF');
      expect(data.productId).toBe('p1');
    });

    it('popust ulazi sa minusom i BEZ marže (prolazi gostu 1:1)', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findUnique.mockResolvedValue({ id: 'mr-1', percentage: 20, fixedAmount: 0 });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', items: [parentItem()] });
      prisma.ancillaryService.findUnique.mockResolvedValue(ancillary({ kind: 'DISCOUNT', priceBasis: 'PER_ROOM_PER_STAY', flatAmount: 2000 }));
      prisma.bookingItem.create.mockResolvedValue({ id: 'anc-item' });
      prisma.booking.update.mockResolvedValue({ id: 'b1', items: [] });

      await service.addAncillaryToItem('b1', 'item-1', { ancillaryServiceId: 'anc-1' } as any, { userId: 'staff-1' });

      const data = prisma.bookingItem.create.mock.calls[0][0].data;
      expect(data.baseCost).toBe(-2000);
      expect(data.finalPrice).toBe(-2000);
    });

    it('ON_SITE doplata dobija cenu bez marže i NE ulazi u ukupno zaduženje', async () => {
      const { service, prisma } = makeService();
      prisma.markupRule.findUnique.mockResolvedValue({ id: 'mr-1', percentage: 50, fixedAmount: 0 });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', items: [parentItem()] });
      prisma.ancillaryService.findUnique.mockResolvedValue(ancillary({ payable: 'ON_SITE', priceBasis: 'PER_ROOM_PER_STAY', flatAmount: 1000 }));
      prisma.bookingItem.create.mockResolvedValue({ id: 'anc-item' });
      prisma.booking.update.mockResolvedValue({ id: 'b1', items: [] });

      await service.addAncillaryToItem('b1', 'item-1', { ancillaryServiceId: 'anc-1' } as any, { userId: 'staff-1' });

      expect(prisma.bookingItem.create.mock.calls[0][0].data.finalPrice).toBe(1000);
      // zbir se traži samo za AGENCY stavke — ON_SITE se ne sabira (§6.7a)
      const aggWhere = prisma.bookingItem.aggregate.mock.calls.at(-1)[0].where;
      expect(aggWhere.payable).toBe('AGENCY');
    });

    it('odbija doplatu čiji uslov po sastavu gostiju nije ispunjen i količinu preko max_quantity', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        clientAccountId: 'c1',
        status: 'CONFIRMED',
        items: [parentItem({ guests: [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }] })],
      });
      prisma.ancillaryService.findUnique.mockResolvedValue(ancillary({ coversPersons: 2 }));
      await expect(service.addAncillaryToItem('b1', 'item-1', { ancillaryServiceId: 'anc-1' } as any, { userId: 'staff-1' })).rejects.toThrow(
        BadRequestException,
      );

      prisma.ancillaryService.findUnique.mockResolvedValue(ancillary({ maxQuantity: 1 }));
      await expect(
        service.addAncillaryToItem('b1', 'item-1', { ancillaryServiceId: 'anc-1', quantity: 3 } as any, { userId: 'staff-1' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.bookingItem.create).not.toHaveBeenCalled();
    });

    it('otkazivanje matične stavke otkazuje i vezanu doplatu, i kad nije navedena u itemIds', async () => {
      const { service, prisma } = makeService();
      const parent = parentItem({ rateLineId: null }); // bez rate_line_id — releaseItemCapacity je no-op
      const child = { ...parentItem({ rateLineId: null }), id: 'anc-item', parentItemId: 'item-1', finalPrice: 3500 };
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', status: 'CONFIRMED', items: [parent, child] });
      prisma.bookingItemGuest.findMany.mockResolvedValue([]); // bez putnika — provera duplikata nema šta da poredi
      prisma.bookingItem.count.mockResolvedValue(0);
      prisma.booking.update.mockResolvedValue({ id: 'b1', items: [] });

      await service.cancel('b1', { reason: 'test', itemIds: ['item-1'], confirmDuplicateOverride: true } as any, { userId: 'staff-1' });

      const cancelled = prisma.bookingItem.update.mock.calls.map((c: any) => c[0].where.id);
      expect(cancelled).toContain('item-1');
      expect(cancelled).toContain('anc-item');
    });

    it('listAncillariesForItem vraća praznu listu za API stavku (doplate su ugovorna kategorija)', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({
        id: 'b1',
        clientAccountId: 'c1',
        status: 'CONFIRMED',
        items: [parentItem({ sourceType: 'API', rateLineId: null })],
      });
      expect(await service.listAncillariesForItem('b1', 'item-1', { userId: 'staff-1' })).toEqual([]);
    });
  });

  // Dopuna (2.9.2026, na zahtev vlasnika — kartica Putnici): dodavanje/izmena/brisanje putnika
  // na već potvrđenoj stavci, nikad ne dira M6 GuestProfile.
  describe('addGuest/updateGuest/removeGuest (§4.3, dopuna 2.9.2026)', () => {
    it('addGuest dodaje putnika na stavku', async () => {
      const { service, prisma } = makeService();
      prisma.bookingItem.findUnique.mockResolvedValue({ id: 'item-1', bookingId: 'b1' });
      prisma.booking.findUniqueOrThrow.mockResolvedValue({ id: 'b1', clientAccountId: 'c1' });
      prisma.bookingItemGuest.findFirst.mockResolvedValue(null);
      prisma.bookingItemGuest.create.mockResolvedValue({ id: 'g1', bookingItemId: 'item-1', guestFirstName: 'Ana', guestLastName: 'Anić' });

      const result = await service.addGuest('item-1', { guestFirstName: 'Ana', guestLastName: 'Anić' }, { userId: 'staff-1' });

      expect(prisma.bookingItemGuest.create).toHaveBeenCalledWith({
        data: { bookingItemId: 'item-1', guestFirstName: 'Ana', guestLastName: 'Anić' },
      });
      expect(result.id).toBe('g1');
    });

    it('addGuest odbija duplikat imena/prezimena na istoj stavci', async () => {
      const { service, prisma } = makeService();
      prisma.bookingItem.findUnique.mockResolvedValue({ id: 'item-1', bookingId: 'b1' });
      prisma.booking.findUniqueOrThrow.mockResolvedValue({ id: 'b1', clientAccountId: 'c1' });
      prisma.bookingItemGuest.findFirst.mockResolvedValue({ id: 'g-postojeci' });

      await expect(service.addGuest('item-1', { guestFirstName: 'Ana', guestLastName: 'Anić' }, { userId: 'staff-1' })).rejects.toThrow(BadRequestException);
      expect(prisma.bookingItemGuest.create).not.toHaveBeenCalled();
    });

    it('updateGuest menja ime/prezime, odbija putnika koji ne pripada stavci', async () => {
      const { service, prisma } = makeService();
      prisma.bookingItem.findUnique.mockResolvedValue({ id: 'item-1', bookingId: 'b1' });
      prisma.booking.findUniqueOrThrow.mockResolvedValue({ id: 'b1', clientAccountId: 'c1' });
      prisma.bookingItemGuest.findUnique.mockResolvedValue({ id: 'g1', bookingItemId: 'item-drugi', guestFirstName: 'Ana', guestLastName: 'Anić' });

      await expect(service.updateGuest('item-1', 'g1', { guestFirstName: 'Ana', guestLastName: 'Marić' }, { userId: 'staff-1' })).rejects.toThrow(NotFoundException);
      expect(prisma.bookingItemGuest.update).not.toHaveBeenCalled();
    });

    it('removeGuest briše putnika i piše audit trag', async () => {
      const { service, prisma, auditLog } = makeService();
      prisma.bookingItem.findUnique.mockResolvedValue({ id: 'item-1', bookingId: 'b1' });
      prisma.booking.findUniqueOrThrow.mockResolvedValue({ id: 'b1', clientAccountId: 'c1' });
      prisma.bookingItemGuest.findUnique.mockResolvedValue({ id: 'g1', bookingItemId: 'item-1', guestFirstName: 'Ana', guestLastName: 'Anić' });

      await service.removeGuest('item-1', 'g1', { userId: 'staff-1' });

      expect(prisma.bookingItemGuest.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'booking_item_guest.removed', resourceId: 'g1' }));
    });

    it('gost NE može da doda putnika na tuđu rezervaciju — vraća 404 (IDOR)', async () => {
      const { service, prisma } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'GUEST', linkedProfileId: 'client-1' });
      prisma.bookingItem.findUnique.mockResolvedValue({ id: 'item-1', bookingId: 'b1' });
      prisma.booking.findUniqueOrThrow.mockResolvedValue({ id: 'b1', clientAccountId: 'client-tudj' });

      await expect(service.addGuest('item-1', { guestFirstName: 'Ana', guestLastName: 'Anić' }, { userId: 'guest-1' })).rejects.toThrow(NotFoundException);
      expect(prisma.bookingItemGuest.create).not.toHaveBeenCalled();
    });
  });

  describe('transferOwnership (§6.5, 31.8.2026)', () => {
    it('trenutni vlasnik sme da prenese sopstvenu rezervaciju', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', ownerId: 'owner-1' });
      prisma.userRole.findFirst.mockResolvedValue(null); // nije Vlasnik/Direktor
      prisma.booking.update.mockResolvedValue({ id: 'b1', ownerId: 'novi-vlasnik' });

      await service.transferOwnership('b1', 'novi-vlasnik', { userId: 'owner-1' });

      expect(prisma.booking.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { ownerId: 'novi-vlasnik' } });
    });

    it('korisnik koji NIJE vlasnik ni Vlasnik/Direktor ne sme da prenese vlasništvo', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', ownerId: 'owner-1' });
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(service.transferOwnership('b1', 'novi-vlasnik', { userId: 'neko-drugi' })).rejects.toThrow(ForbiddenException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('Vlasnik/Direktor prenose vlasništvo bez obzira ko je trenutni vlasnik', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', ownerId: 'owner-1' });
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' }); // JESTE Vlasnik/Direktor
      prisma.booking.update.mockResolvedValue({ id: 'b1', ownerId: 'novi-vlasnik' });

      await service.transferOwnership('b1', 'novi-vlasnik', { userId: 'direktor-1' });

      expect(prisma.booking.update).toHaveBeenCalled();
    });
  });

  describe('predaja zaduženja — propose/accept/decline/cancel (§6.5, 31.8.2026)', () => {
    it('proposeHandoff od strane Vlasnika/Direktora izvršava odmah (ACCEPTED), menja assigned_to_id bez čekanja', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', ownerId: 'x', assignedToId: 'x', items: [] });
      prisma.userRole.findFirst.mockResolvedValue({ id: 'ur1' });
      prisma.bookingHandoffRequest.create.mockResolvedValue({ id: 'h1', bookingId: 'b1', status: 'ACCEPTED' });

      await service.proposeHandoff('b1', 'novi-zaduzeni', { userId: 'direktor-1' });

      expect(prisma.bookingHandoffRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }),
      );
      expect(prisma.booking.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { assignedToId: 'novi-zaduzeni' } });
    });

    it('proposeHandoff odbija novi predlog kad već postoji PENDING za istu rezervaciju (ne-bypass put)', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', ownerId: 'x', assignedToId: 'x', items: [] });
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.bookingHandoffRequest.findFirst.mockResolvedValue({ id: 'postojeci', status: 'PENDING' });

      await expect(service.proposeHandoff('b1', 'novi-cilj', { userId: 'agent-1' })).rejects.toThrow(BadRequestException);
      expect(prisma.bookingHandoffRequest.create).not.toHaveBeenCalled();
    });

    it('proposeHandoff od strane redovnog korisnika ostaje PENDING, ne menja assigned_to_id odmah', async () => {
      const { service, prisma } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', ownerId: 'x', assignedToId: 'x', items: [] });
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.bookingHandoffRequest.create.mockResolvedValue({ id: 'h1', bookingId: 'b1', status: 'PENDING' });

      await service.proposeHandoff('b1', 'novi-zaduzeni', { userId: 'agent-1' });

      expect(prisma.bookingHandoffRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
      );
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('acceptHandoff — samo primalac sme da prihvati, tada se assigned_to_id menja', async () => {
      const { service, prisma } = makeService();
      prisma.bookingHandoffRequest.findUnique.mockResolvedValue({ id: 'h1', bookingId: 'b1', fromUserId: 'a', toUserId: 'b', status: 'PENDING' });
      prisma.bookingHandoffRequest.update.mockResolvedValue({ id: 'h1', status: 'ACCEPTED' });

      await service.acceptHandoff('h1', { userId: 'b' });

      expect(prisma.booking.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { assignedToId: 'b' } });
    });

    it('acceptHandoff — neko ko nije primalac ne sme da prihvati', async () => {
      const { service, prisma } = makeService();
      prisma.bookingHandoffRequest.findUnique.mockResolvedValue({ id: 'h1', bookingId: 'b1', fromUserId: 'a', toUserId: 'b', status: 'PENDING' });

      await expect(service.acceptHandoff('h1', { userId: 'trece-lice' })).rejects.toThrow(ForbiddenException);
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('declineHandoff — samo primalac sme da odbije, status prelazi u DECLINED', async () => {
      const { service, prisma } = makeService();
      prisma.bookingHandoffRequest.findUnique.mockResolvedValue({ id: 'h1', bookingId: 'b1', fromUserId: 'a', toUserId: 'b', status: 'PENDING' });
      prisma.bookingHandoffRequest.update.mockResolvedValue({ id: 'h1', status: 'DECLINED' });

      await service.declineHandoff('h1', { userId: 'b' });

      expect(prisma.bookingHandoffRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DECLINED' }) }),
      );
    });

    it('cancelHandoff — predlagač sme da otkaže sopstveni predlog', async () => {
      const { service, prisma } = makeService();
      prisma.bookingHandoffRequest.findUnique.mockResolvedValue({ id: 'h1', bookingId: 'b1', fromUserId: 'a', toUserId: 'b', status: 'PENDING' });
      prisma.userRole.findFirst.mockResolvedValue(null);
      prisma.bookingHandoffRequest.update.mockResolvedValue({ id: 'h1', status: 'CANCELLED' });

      await service.cancelHandoff('h1', { userId: 'a' });

      expect(prisma.bookingHandoffRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
    });

    it('cancelHandoff — treće lice (ni predlagač ni Vlasnik/Direktor) ne sme da otkaže', async () => {
      const { service, prisma } = makeService();
      prisma.bookingHandoffRequest.findUnique.mockResolvedValue({ id: 'h1', bookingId: 'b1', fromUserId: 'a', toUserId: 'b', status: 'PENDING' });
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(service.cancelHandoff('h1', { userId: 'trece-lice' })).rejects.toThrow(ForbiddenException);
    });

    it('listHandoffRequests vraća listu za vidljivu rezervaciju, najnoviji prvi', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', ownerId: 'x', assignedToId: 'x', items: [] });
      permissions.hasPermission.mockResolvedValue(true);
      prisma.bookingHandoffRequest.findMany = jest.fn().mockResolvedValue([{ id: 'h1' }]);

      const result = await service.listHandoffRequests('b1', 'staff-1');

      expect(prisma.bookingHandoffRequest.findMany).toHaveBeenCalledWith({ where: { bookingId: 'b1' }, orderBy: { createdAt: 'desc' } });
      expect(result).toEqual([{ id: 'h1' }]);
    });

    it('listHandoffRequests poštuje istu vidljivost kao findOne — nevidljiva rezervacija baca 404', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ accountType: 'STAFF', linkedProfileId: null });
      prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientAccountId: 'c1', ownerId: 'neko-drugi', assignedToId: 'neko-drugi', items: [] });
      permissions.hasPermission.mockResolvedValue(false);

      await expect(service.listHandoffRequests('b1', 'staff-1')).rejects.toThrow(NotFoundException);
    });

    it('accept/decline/cancel odbijaju predlog koji više nije PENDING', async () => {
      const { service, prisma } = makeService();
      prisma.bookingHandoffRequest.findUnique.mockResolvedValue({ id: 'h1', bookingId: 'b1', fromUserId: 'a', toUserId: 'b', status: 'ACCEPTED' });

      await expect(service.acceptHandoff('h1', { userId: 'b' })).rejects.toThrow(BadRequestException);
    });
  });
});
