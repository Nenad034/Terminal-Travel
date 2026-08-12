import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('BookingsService (M5 spec §4/§6.4)', () => {
  function makeService() {
    const prisma: any = {
      quote: { findUnique: jest.fn(), update: jest.fn() },
      product: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
      providerConfig: { findUnique: jest.fn() },
      rateLine: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
      booking: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      bookingItem: { findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
      bookingItemGuest: { findMany: jest.fn() },
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
    const supplierManifests = { supersedeIfOnSentManifest: jest.fn() };

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
    );
    return { service, prisma, auditLog, eventBus, contractPeriods, integrations, compliance };
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
});
