import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  function makeService() {
    const prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn() },
      conversation: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      conversationParticipant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
      },
      supplierConversationAccess: { create: jest.fn() },
      aIAgent: { findFirst: jest.fn() },
      presenceStatus: { findMany: jest.fn() },
      message: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    const auditLog = { write: jest.fn() };
    const permissions = { hasPermission: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const service = new ConversationsService(prisma as any, auditLog as any, permissions as any, eventBus as any);
    return { service, prisma, auditLog, permissions, eventBus };
  }

  describe('findAllForUser (M19 spec §2.2/§9.3 scoping)', () => {
    it('vraća isključivo razgovore gde je pozivalac ConversationParticipant', async () => {
      const { service, prisma } = makeService();
      prisma.conversationParticipant.findMany.mockResolvedValue([
        { conversationId: 'c1', lastReadAt: null, conversation: { id: 'c1', type: 'DIRECT', name: null, supplierId: null, createdAt: new Date() } },
      ]);
      prisma.message.findFirst.mockResolvedValue(null);

      const result = await service.findAllForUser('staff-1');

      expect(prisma.conversationParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'staff-1' } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });
  });

  describe('create — DIRECT/GROUP (M19 spec §2.2)', () => {
    it('odbija učesnika koji nije STAFF', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF' });
      permissions.hasPermission.mockResolvedValue(true);
      prisma.user.findMany.mockResolvedValue([{ id: 'contact-1', accountType: 'SUPPLIER_CONTACT' }]);

      await expect(
        service.create({ type: 'DIRECT', participantUserIds: ['contact-1'] } as any, 'staff-1'),
      ).rejects.toThrow(/isključivo interne/);
    });

    it('zahteva M19/conversation/CREATE dozvolu', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF' });
      permissions.hasPermission.mockResolvedValue(false);

      await expect(
        service.create({ type: 'DIRECT', participantUserIds: ['staff-2'] } as any, 'staff-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('kreira DIRECT razgovor sa oba STAFF učesnika', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF' });
      permissions.hasPermission.mockResolvedValue(true);
      prisma.user.findMany.mockResolvedValue([{ id: 'staff-2', accountType: 'STAFF' }]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.create.mockResolvedValue({ id: 'c1', type: 'DIRECT' });

      const result = await service.create({ type: 'DIRECT', participantUserIds: ['staff-2'] } as any, 'staff-1');

      expect(prisma.conversationParticipant.createMany).toHaveBeenCalledWith({
        data: [{ conversationId: 'c1', userId: 'staff-1' }, { conversationId: 'c1', userId: 'staff-2' }],
      });
      expect(result).toEqual({ id: 'c1', type: 'DIRECT' });
    });
  });

  describe('create — EXTERNAL_SUPPLIER (M19 spec §9.3/§9.4)', () => {
    it('zahteva M19/supplier-conversation/GRANT_ACCESS, ne obično CREATE', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF' });
      permissions.hasPermission.mockResolvedValue(false);

      await expect(
        service.create({ type: 'EXTERNAL_SUPPLIER', supplierId: 'sup-1' } as any, 'staff-1'),
      ).rejects.toThrow(/GRANT_ACCESS/);
    });

    it('self-grant: tvorac odmah dobija SupplierConversationAccess + ConversationParticipant', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF' });
      permissions.hasPermission.mockResolvedValue(true);
      prisma.conversation.create.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER', supplierId: 'sup-1' });

      await service.create({ type: 'EXTERNAL_SUPPLIER', supplierId: 'sup-1' } as any, 'staff-1');

      expect(prisma.conversationParticipant.create).toHaveBeenCalledWith({ data: { conversationId: 'c1', userId: 'staff-1' } });
      expect(prisma.supplierConversationAccess.create).toHaveBeenCalledWith({
        data: { conversationId: 'c1', userId: 'staff-1', grantedBy: 'staff-1' },
      });
    });
  });

  describe('createMessage / assertParticipant (M19 spec §9.4 — nevidljivo bez pristupa)', () => {
    it('baca NotFoundException (ne 403) za korisnika koji nije učesnik — razgovor ostaje nevidljiv', async () => {
      const { service, prisma } = makeService();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);

      await expect(service.createMessage('c1', { body: 'zdravo' }, 'staff-bez-pristupa')).rejects.toThrow(NotFoundException);
    });

    it('SUPPLIER_CONTACT sme da šalje bez posebne M19 dozvole (§9.6) čim je učesnik', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({ conversationId: 'c1', userId: 'contact-1' });
      prisma.user.findUnique.mockImplementation(({ where }: any) =>
        where.id === 'contact-1' ? { id: 'contact-1', accountType: 'SUPPLIER_CONTACT' } : { id: 'contact-1', fullName: 'Dobavljač' },
      );
      prisma.message.create.mockResolvedValue({ id: 'm1', conversationId: 'c1', senderId: 'contact-1', body: 'zdravo' });
      prisma.conversationParticipant.findMany.mockResolvedValue([]);
      prisma.presenceStatus.findMany.mockResolvedValue([]);

      await service.createMessage('c1', { body: 'zdravo' }, 'contact-1');

      expect(permissions.hasPermission).not.toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'c1', senderId: 'contact-1', body: 'zdravo', draftedByAi: false, draftedByAgentId: null },
      });
    });

    it('STAFF na EXTERNAL_SUPPLIER razgovoru mora imati M19/supplier-conversation/SEND_MESSAGE', async () => {
      const { service, prisma, permissions } = makeService();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({ conversationId: 'c1', userId: 'staff-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF' });
      permissions.hasPermission.mockResolvedValue(false);

      await expect(service.createMessage('c1', { body: 'zdravo' }, 'staff-1')).rejects.toThrow(ForbiddenException);
    });

    it('emituje message.recipient_offline za učesnike čiji PresenceStatus nije ONLINE (§3)', async () => {
      const { service, prisma, permissions, eventBus } = makeService();
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'DIRECT' });
      prisma.conversationParticipant.findUnique.mockResolvedValue({ conversationId: 'c1', userId: 'staff-1' });
      prisma.user.findUnique.mockImplementation(({ where }: any) =>
        where.id === 'staff-1' ? { id: 'staff-1', accountType: 'STAFF', fullName: 'Marko' } : null,
      );
      permissions.hasPermission.mockResolvedValue(true);
      prisma.message.create.mockResolvedValue({ id: 'm1', conversationId: 'c1', senderId: 'staff-1', body: 'ćao' });
      prisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: 'c1', userId: 'staff-2' }]);
      prisma.presenceStatus.findMany.mockResolvedValue([{ userId: 'staff-2', status: 'OFFLINE' }]);

      await service.createMessage('c1', { body: 'ćao' }, 'staff-1');

      expect(eventBus.emit).toHaveBeenCalledWith(
        'M19',
        'message.recipient_offline',
        expect.objectContaining({ recipientUserId: 'staff-2' }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith('M19', 'message.new', expect.objectContaining({ conversationId: 'c1' }));
    });
  });

  describe('createMessage — evidencija AI porekla (M19 spec §2.3/§9.5)', () => {
    function mockStaffSendOn(type: string) {
      const ctx = makeService();
      ctx.prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type });
      ctx.prisma.conversationParticipant.findUnique.mockResolvedValue({ conversationId: 'c1', userId: 'staff-1' });
      ctx.prisma.user.findUnique.mockResolvedValue({ id: 'staff-1', accountType: 'STAFF', fullName: 'Marko' });
      ctx.permissions.hasPermission.mockResolvedValue(true);
      ctx.prisma.message.create.mockResolvedValue({ id: 'm1' });
      ctx.prisma.conversationParticipant.findMany.mockResolvedValue([]);
      ctx.prisma.presenceStatus.findMany.mockResolvedValue([]);
      return ctx;
    }

    it('poruka otkucana od nule nema oznaku AI porekla', async () => {
      const { service, prisma } = mockStaffSendOn('EXTERNAL_SUPPLIER');

      await service.createMessage('c1', { body: 'ručno napisan tekst' }, 'staff-1');

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ draftedByAi: false, draftedByAgentId: null }) }),
      );
      expect(prisma.aIAgent.findFirst).not.toHaveBeenCalled();
    });

    it('poruka iz AI nacrta nosi draftedByAi + agentov nalog, a senderId ostaje čovek', async () => {
      const { service, prisma } = mockStaffSendOn('EXTERNAL_SUPPLIER');
      prisma.aIAgent.findFirst.mockResolvedValue({ id: 'agent-1', userId: 'agent-user-1' });

      await service.createMessage('c1', { body: 'nacrt koji je čovek pregledao', draftedByAi: true }, 'staff-1');

      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'c1',
          senderId: 'staff-1',
          body: 'nacrt koji je čovek pregledao',
          draftedByAi: true,
          draftedByAgentId: 'agent-user-1',
        },
      });
    });

    it('agent razrešava server preko SUPPLIER_DRAFT_AGENT uloge — klijent ne bira nalog', async () => {
      const { service, prisma } = mockStaffSendOn('EXTERNAL_SUPPLIER');
      prisma.aIAgent.findFirst.mockResolvedValue({ id: 'agent-1', userId: 'agent-user-1' });

      await service.createMessage('c1', { body: 'nacrt', draftedByAi: true } as any, 'staff-1');

      expect(prisma.aIAgent.findFirst).toHaveBeenCalledWith({ where: { agentRole: 'SUPPLIER_DRAFT_AGENT' } });
    });

    it('bez seedovanog agentskog naloga poreklo se i dalje beleži, samo bez pokazivača na nalog', async () => {
      const { service, prisma } = mockStaffSendOn('EXTERNAL_SUPPLIER');
      prisma.aIAgent.findFirst.mockResolvedValue(null);

      await service.createMessage('c1', { body: 'nacrt', draftedByAi: true }, 'staff-1');

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ draftedByAi: true, draftedByAgentId: null }) }),
      );
    });

    it('odbija draftedByAi na DIRECT razgovoru — AI nacrt postoji samo za dobavljače (§9.5)', async () => {
      const { service } = mockStaffSendOn('DIRECT');

      await expect(service.createMessage('c1', { body: 'nacrt', draftedByAi: true }, 'staff-1')).rejects.toThrow(
        /EXTERNAL_SUPPLIER/,
      );
    });
  });

  describe('editMessage/deleteMessage — samo pošiljalac (M19 spec §2.3)', () => {
    it('odbija izmenu poruke koju nije poslao pozivalac', async () => {
      const { service, prisma } = makeService();
      prisma.message.findUniqueOrThrow.mockResolvedValue({ id: 'm1', senderId: 'staff-1', deletedAt: null });

      await expect(service.editMessage('m1', { body: 'nova' }, 'staff-2')).rejects.toThrow(ForbiddenException);
    });

    it('meko briše poruku (deletedAt), ne fizički', async () => {
      const { service, prisma } = makeService();
      prisma.message.findUniqueOrThrow.mockResolvedValue({ id: 'm1', senderId: 'staff-1', deletedAt: null });
      prisma.message.update.mockResolvedValue({ id: 'm1', deletedAt: new Date() });

      await service.deleteMessage('m1', 'staff-1');

      expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { deletedAt: expect.any(Date) } });
    });
  });
});
