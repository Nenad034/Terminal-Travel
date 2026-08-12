import { M20EventSubscribersService } from './m20-event-subscribers.service';

describe('M20EventSubscribersService (M20 spec §3.1/§3.4)', () => {
  function makeService() {
    const eventListener = { on: jest.fn() };
    const clientContracts = { generateForBooking: jest.fn(), voidAndRegenerateForModification: jest.fn() };
    const service = new M20EventSubscribersService(eventListener as any, clientContracts as any);
    return { service, eventListener, clientContracts };
  }

  it('registruje handlere za booking.confirmed i booking.modified, ne za booking.cancelled', () => {
    const { service, eventListener } = makeService();
    service.onModuleInit();
    expect(eventListener.on).toHaveBeenCalledWith('M5', 'booking.confirmed', expect.any(Function));
    expect(eventListener.on).toHaveBeenCalledWith('M5', 'booking.modified', expect.any(Function));
    expect(eventListener.on).not.toHaveBeenCalledWith('M5', 'booking.cancelled', expect.any(Function));
  });

  it('booking.confirmed poziva generateForBooking', async () => {
    const { service, eventListener, clientContracts } = makeService();
    service.onModuleInit();
    const handler = eventListener.on.mock.calls.find((c: any[]) => c[1] === 'booking.confirmed')[2];

    await handler({ bookingId: 'booking-1' });

    expect(clientContracts.generateForBooking).toHaveBeenCalledWith('booking-1');
  });

  it('booking.modified poziva voidAndRegenerateForModification', async () => {
    const { service, eventListener, clientContracts } = makeService();
    service.onModuleInit();
    const handler = eventListener.on.mock.calls.find((c: any[]) => c[1] === 'booking.modified')[2];

    await handler({ bookingId: 'booking-1' });

    expect(clientContracts.voidAndRegenerateForModification).toHaveBeenCalledWith('booking-1');
  });
});
