import { ReconciliationService } from './reconciliation.service';

describe('ReconciliationService (M10 spec §5.3)', () => {
  function makeService() {
    const prisma: any = { booking: { findMany: jest.fn() }, payment: { aggregate: jest.fn() } };
    const eventBus = { emit: jest.fn() };
    const service = new ReconciliationService(prisma, eventBus as any);
    return { service, prisma, eventBus };
  }

  it('prijavljuje MISSING_FISCAL_DOCUMENT kad je puna uplata ali nema aktivnog fiskalnog dokumenta', async () => {
    const { service, prisma } = makeService();
    prisma.booking.findMany.mockResolvedValue([{ id: 'booking-1', totalPrice: 100000, confirmedAt: new Date(), fiscalDocuments: [] }]);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

    const mismatches = await service.findMismatches();

    expect(mismatches).toEqual([{ bookingId: 'booking-1', reason: 'MISSING_FISCAL_DOCUMENT' }]);
  });

  it('ne prijavljuje ništa kad postoji ISSUED fiskalni dokument i puna uplata', async () => {
    const { service, prisma } = makeService();
    prisma.booking.findMany.mockResolvedValue([
      { id: 'booking-1', totalPrice: 100000, confirmedAt: new Date(), fiscalDocuments: [{ status: 'ISSUED' }] },
    ]);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

    const mismatches = await service.findMismatches();

    expect(mismatches).toEqual([]);
  });

  it('prijavljuje PARTIAL_PAYMENT_STALE kad je delimična uplata starija od praga', async () => {
    const { service, prisma } = makeService();
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    prisma.booking.findMany.mockResolvedValue([
      { id: 'booking-1', totalPrice: 100000, confirmedAt: twentyDaysAgo, fiscalDocuments: [] },
    ]);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 30000 } });

    const mismatches = await service.findMismatches(14);

    expect(mismatches).toEqual([{ bookingId: 'booking-1', reason: 'PARTIAL_PAYMENT_STALE' }]);
  });

  it('checkAndEmitSignals emituje jedan događaj po neusklađenosti', async () => {
    const { service, prisma, eventBus } = makeService();
    prisma.booking.findMany.mockResolvedValue([{ id: 'booking-1', totalPrice: 100000, confirmedAt: new Date(), fiscalDocuments: [] }]);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });

    await service.checkAndEmitSignals();

    expect(eventBus.emit).toHaveBeenCalledWith('M10', 'reconciliation_mismatch', { bookingId: 'booking-1', reason: 'MISSING_FISCAL_DOCUMENT' });
  });
});
