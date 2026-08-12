import { M11EventSubscribersService } from './m11-event-subscribers.service';

describe('M11EventSubscribersService (M11 spec §2.3)', () => {
  function makeService() {
    const eventListener = { on: jest.fn() };
    const prisma: any = { booking: { findUnique: jest.fn() } };
    const registrations = { createForBooking: jest.fn(), releaseForBooking: jest.fn() };
    const service = new M11EventSubscribersService(eventListener as any, prisma, registrations as any);
    return { service, eventListener, prisma, registrations };
  }

  it('registruje handlere za M5 booking.confirmed i booking.cancelled pri pokretanju', () => {
    const { service, eventListener } = makeService();
    service.onModuleInit();
    expect(eventListener.on).toHaveBeenCalledWith('M5', 'booking.confirmed', expect.any(Function));
    expect(eventListener.on).toHaveBeenCalledWith('M5', 'booking.cancelled', expect.any(Function));
  });

  describe('onBookingConfirmed', () => {
    it('kreira registraciju za ORGANIZATOR rezervaciju', async () => {
      const { service, prisma, registrations } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', tipNastupanja: 'ORGANIZATOR' });

      await service.onBookingConfirmed('booking-1');

      expect(registrations.createForBooking).toHaveBeenCalledWith('booking-1');
    });

    it('ne dira POSREDNIK rezervacije (M11 spec §2.2 — ne troše kapacitet sopstvene garancije)', async () => {
      const { service, prisma, registrations } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', tipNastupanja: 'POSREDNIK' });

      await service.onBookingConfirmed('booking-1');

      expect(registrations.createForBooking).not.toHaveBeenCalled();
    });
  });

  describe('onBookingCancelled', () => {
    it('oslobađa registraciju za ORGANIZATOR rezervaciju', async () => {
      const { service, prisma, registrations } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', tipNastupanja: 'ORGANIZATOR' });

      await service.onBookingCancelled('booking-1');

      expect(registrations.releaseForBooking).toHaveBeenCalledWith('booking-1');
    });

    it('ne dira POSREDNIK rezervacije', async () => {
      const { service, prisma, registrations } = makeService();
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', tipNastupanja: 'POSREDNIK' });

      await service.onBookingCancelled('booking-1');

      expect(registrations.releaseForBooking).not.toHaveBeenCalled();
    });
  });
});
