import { M10EventSubscribersService } from './m10-event-subscribers.service';

describe('M10EventSubscribersService (M10 spec §6.0/§8.0/§5.4.2)', () => {
  function makeService() {
    const eventListener = { on: jest.fn() };
    const prisma: any = { bookingItem: { findMany: jest.fn() } };
    const fiscalDocuments = { prepareDraft: jest.fn() };
    const clientPaymentSchedules = { createForBooking: jest.fn() };
    const supplierObligations = { createFromBookingItem: jest.fn() };
    const service = new M10EventSubscribersService(
      eventListener as any,
      prisma,
      fiscalDocuments as any,
      clientPaymentSchedules as any,
      supplierObligations as any,
    );
    return { service, eventListener, prisma, fiscalDocuments, clientPaymentSchedules, supplierObligations };
  }

  it('registruje handler za M5 booking.confirmed pri pokretanju', () => {
    const { service, eventListener } = makeService();
    service.onModuleInit();
    expect(eventListener.on).toHaveBeenCalledWith('M5', 'booking.confirmed', expect.any(Function));
  });

  it('onBookingConfirmed priprema fiskalni nacrt, raspored plaćanja i obaveze za CONTRACTED/CONFIRMED stavke', async () => {
    const { service, prisma, fiscalDocuments, clientPaymentSchedules, supplierObligations } = makeService();
    prisma.bookingItem.findMany.mockResolvedValue([{ id: 'bi-1' }, { id: 'bi-2' }]);

    await service.onBookingConfirmed('booking-1');

    expect(fiscalDocuments.prepareDraft).toHaveBeenCalledWith('booking-1');
    expect(clientPaymentSchedules.createForBooking).toHaveBeenCalledWith('booking-1');
    expect(prisma.bookingItem.findMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', sourceType: 'CONTRACTED', itemStatus: 'CONFIRMED' },
    });
    expect(supplierObligations.createFromBookingItem).toHaveBeenCalledWith('bi-1');
    expect(supplierObligations.createFromBookingItem).toHaveBeenCalledWith('bi-2');
  });
});
