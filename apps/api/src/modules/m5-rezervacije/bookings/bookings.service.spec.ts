import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('BookingsService (M5 spec §4/§6.4)', () => {
  function makeService() {
    const prisma: any = {
      quote: { findUnique: jest.fn(), update: jest.fn() },
      product: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
      providerConfig: { findUnique: jest.fn() },
      rateLine: { findUniqueOrThrow: jest.fn(), findUnique: jest.fn() },
      booking: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn(), findMany: jest.fn() },
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
          { id: 'qi-1', productId: 'p1', sourceType: 'CONTRACTED', rateLineId: 'rl1', occupancy: { adults: 2, children: 0 }, finalPrice: 10000, finalPriceCurrency: 'EUR' },
          { id: 'qi-2', productId: 'p2', sourceType: 'CONTRACTED', rateLineId: 'rl2', occupancy: { adults: 2, children: 0 }, finalPrice: 8000, finalPriceCurrency: 'EUR' },
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

      await expect(service.confirmQuote('quote-1', {}, { userId: 'actor-1' })).rejects.toThrow(BadRequestException);

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
      await expect(service.confirmQuote('quote-2', {}, { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
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
      await expect(service.confirmQuote('quote-3', {}, { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
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
});
