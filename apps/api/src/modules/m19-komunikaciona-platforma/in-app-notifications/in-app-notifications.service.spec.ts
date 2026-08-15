import { InAppNotificationsService } from './in-app-notifications.service';

describe('InAppNotificationsService (M19 spec §5 — M18 CRITICAL → IN_APP)', () => {
  function makeService() {
    const prisma = {
      user: { findUnique: jest.fn() },
      role: { findMany: jest.fn() },
      userRole: { findMany: jest.fn() },
      conversation: { findMany: jest.fn(), create: jest.fn() },
      conversationParticipant: { createMany: jest.fn() },
      message: { create: jest.fn() },
    };
    const eventListener = { on: jest.fn() };
    const service = new InAppNotificationsService(prisma as any, eventListener as any);
    return { service, prisma, eventListener };
  }

  it('se pretplaćuje na M18/health-signal.critical pri onModuleInit', () => {
    const { service, eventListener } = makeService();
    service.onModuleInit();
    expect(eventListener.on).toHaveBeenCalledWith('M18', 'health-signal.critical', expect.any(Function));
  });

  it('ubacuje sistemsku poruku u "Obaveštenja" DIRECT razgovor svakog Vlasnik/Direktor korisnika', async () => {
    const { service, prisma, eventListener } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'system-user-1', email: InAppNotificationsService.SYSTEM_USER_EMAIL });
    prisma.role.findMany.mockResolvedValue([{ id: 'role-vlasnik' }, { id: 'role-direktor' }]);
    prisma.userRole.findMany.mockResolvedValue([{ userId: 'owner-1' }]);
    prisma.conversation.findMany.mockResolvedValue([]); // nema postojeći "Obaveštenja" razgovor
    prisma.conversation.create.mockResolvedValue({ id: 'conv-notif-1' });

    service.onModuleInit();
    const handler = eventListener.on.mock.calls[0][2];
    await handler({ signalId: 'sig-1', sourceModule: 'M4', signalType: 'PROVIDER_ERROR_SPIKE', details: { errorCount: 20 } });

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'DIRECT', createdBy: 'system-user-1' }) }),
    );
    expect(prisma.conversationParticipant.createMany).toHaveBeenCalledWith({
      data: [
        { conversationId: 'conv-notif-1', userId: 'owner-1' },
        { conversationId: 'conv-notif-1', userId: 'system-user-1' },
      ],
    });
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ conversationId: 'conv-notif-1', senderId: 'system-user-1' }),
      }),
    );
    const bodyArg = prisma.message.create.mock.calls[0][0].data.body;
    expect(bodyArg).toContain('CRITICAL');
    expect(bodyArg).toContain('M4');
  });

  it('ponovo koristi postojeći "Obaveštenja" razgovor umesto duplikata', async () => {
    const { service, prisma, eventListener } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'system-user-1' });
    prisma.role.findMany.mockResolvedValue([{ id: 'role-vlasnik' }]);
    prisma.userRole.findMany.mockResolvedValue([{ userId: 'owner-1' }]);
    prisma.conversation.findMany.mockResolvedValue([
      { id: 'existing-conv', participants: [{ userId: 'owner-1' }, { userId: 'system-user-1' }] },
    ]);

    service.onModuleInit();
    const handler = eventListener.on.mock.calls[0][2];
    await handler({ signalId: 'sig-1', sourceModule: 'M10', signalType: 'PAYMENT_FAILURE_SPIKE', details: {} });

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conversationId: 'existing-conv' }) }),
    );
  });
});
