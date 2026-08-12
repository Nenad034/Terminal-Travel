import { M6EventSubscribersService } from './m6-event-subscribers.service';

// M6 spec §3.2 (lojalnost), §4.3 (post-trip anketa) i §6 (M1 user.registered.guest → ClientAccount).
describe('M6EventSubscribersService', () => {
  function makeService() {
    const eventListener = { on: jest.fn() };
    const prisma: any = { booking: { findUnique: jest.fn() }, user: { update: jest.fn().mockResolvedValue({}) } };
    const loyaltyStatus = { recalculate: jest.fn() };
    const postTripSurveys = { createForBooking: jest.fn() };
    const clientAccounts = { create: jest.fn() };
    const service = new M6EventSubscribersService(
      eventListener as any,
      prisma,
      loyaltyStatus as any,
      postTripSurveys as any,
      clientAccounts as any,
    );
    return { service, eventListener, prisma, loyaltyStatus, postTripSurveys, clientAccounts };
  }

  function capturedHandler(eventListener: { on: jest.Mock }, module: string, event: string) {
    const call = eventListener.on.mock.calls.find((c) => c[0] === module && c[1] === event);
    if (!call) throw new Error(`Handler za ${module}.${event} nije registrovan`);
    return call[2] as (payload: Record<string, unknown>) => Promise<void>;
  }

  it('registruje handler za M1 user.registered.guest pri pokretanju', () => {
    const { service, eventListener } = makeService();
    service.onModuleInit();
    expect(eventListener.on).toHaveBeenCalledWith('M1', 'user.registered.guest', expect.any(Function));
  });

  describe('user.registered.guest', () => {
    it('kreira ClientAccount(INDIVIDUAL) i povezuje ga na User.linked_profile_id, bez GuestProfile', async () => {
      const { service, eventListener, prisma, clientAccounts } = makeService();
      clientAccounts.create.mockResolvedValue({ id: 'account-1' });
      service.onModuleInit();

      const handler = capturedHandler(eventListener, 'M1', 'user.registered.guest');
      await handler({ userId: 'user-1', email: 'gost@tt.rs', fullName: 'Gost Gostić' });

      expect(clientAccounts.create).toHaveBeenCalledWith({
        accountType: 'INDIVIDUAL',
        fullName: 'Gost Gostić',
        email: 'gost@tt.rs',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { linkedProfileId: 'account-1' } });
    });
  });
});
