import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SupplierConversationsService } from './supplier-conversations.service';

describe('SupplierConversationsService', () => {
  function makeService() {
    const prisma = {
      conversation: { findUnique: jest.fn() },
      user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      supplierContact: { findUnique: jest.fn(), update: jest.fn() },
      supplierConversationAccess: { findMany: jest.fn(), upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      conversationParticipant: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    };
    const auditLog = { write: jest.fn() };
    const permissions = { hasPermission: jest.fn() };
    const auth = { createInviteToken: jest.fn() };
    const service = new SupplierConversationsService(prisma as any, auditLog as any, permissions as any, auth as any);
    return { service, prisma, auditLog, permissions, auth };
  }

  describe('grantAccess (M19 spec §9.4)', () => {
    it('zahteva M19/supplier-conversation/GRANT_ACCESS', async () => {
      const { service, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(false);

      await expect(service.grantAccess('c1', { userId: 'staff-2' }, 'staff-1')).rejects.toThrow(ForbiddenException);
    });

    it('odbija ciljanje EXTERNAL_SUPPLIER pristupa nekom ko nije STAFF', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(true);
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
      prisma.user.findUnique.mockResolvedValue({ id: 'contact-1', accountType: 'SUPPLIER_CONTACT' });

      await expect(service.grantAccess('c1', { userId: 'contact-1' }, 'staff-1')).rejects.toThrow(BadRequestException);
    });

    it('upisuje i SupplierConversationAccess i ConversationParticipant u istoj transakciji', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(true);
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER' });
      prisma.user.findUnique.mockResolvedValue({ id: 'staff-2', accountType: 'STAFF' });
      prisma.supplierConversationAccess.upsert.mockResolvedValue({ id: 'acc-1', conversationId: 'c1', userId: 'staff-2' });

      await service.grantAccess('c1', { userId: 'staff-2' }, 'staff-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.supplierConversationAccess.upsert).toHaveBeenCalled();
      expect(prisma.conversationParticipant.upsert).toHaveBeenCalled();
    });
  });

  describe('inviteContact (M19 spec §9.2 koraci 1-3)', () => {
    function withConversationAndContact(prisma: any) {
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER', supplierId: 'sup-1' });
      prisma.supplierContact.findUnique.mockResolvedValue({
        id: 'contact-1',
        supplierId: 'sup-1',
        fullName: 'Ana',
        email: 'ana@hotel.rs',
        phone: '060',
        linkedUserId: null,
      });
    }

    it('kreira User(account_type=SUPPLIER_CONTACT), token, i popunjava linked_user_id', async () => {
      const { service, prisma, permissions, auth } = makeService();
      permissions.hasPermission.mockResolvedValue(true);
      withConversationAndContact(prisma);
      prisma.conversationParticipant.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue(null); // nema postojećeg naloga sa tim email-om
      prisma.user.create.mockResolvedValue({ id: 'new-user-1' });
      auth.createInviteToken.mockResolvedValue('raw-token-123');

      const result = await service.inviteContact('c1', { supplierContactId: 'contact-1' }, 'staff-1');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'ana@hotel.rs', accountType: 'SUPPLIER_CONTACT', status: 'INVITED' }),
        }),
      );
      expect(auth.createInviteToken).toHaveBeenCalledWith('new-user-1');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ user: { id: 'new-user-1' }, inviteToken: 'raw-token-123' });
    });

    it('odbija ako kontakt već ima portal nalog', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(true);
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', type: 'EXTERNAL_SUPPLIER', supplierId: 'sup-1' });
      prisma.supplierContact.findUnique.mockResolvedValue({ id: 'contact-1', supplierId: 'sup-1', linkedUserId: 'already-linked' });

      await expect(service.inviteContact('c1', { supplierContactId: 'contact-1' }, 'staff-1')).rejects.toThrow(BadRequestException);
    });

    it('odbija ako razgovor već ima dodeljenu SUPPLIER_CONTACT osobu (§9.3 — tačno jedan)', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(true);
      withConversationAndContact(prisma);
      prisma.conversationParticipant.findMany.mockResolvedValue([{ conversationId: 'c1', userId: 'existing-contact' }]);
      prisma.user.findMany.mockResolvedValue([{ id: 'existing-contact', accountType: 'SUPPLIER_CONTACT' }]);

      await expect(service.inviteContact('c1', { supplierContactId: 'contact-1' }, 'staff-1')).rejects.toThrow(BadRequestException);
    });

    it('odbija ako email kontakta već pripada postojećem nalogu', async () => {
      const { service, prisma, permissions } = makeService();
      permissions.hasPermission.mockResolvedValue(true);
      withConversationAndContact(prisma);
      prisma.conversationParticipant.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.inviteContact('c1', { supplierContactId: 'contact-1' }, 'staff-1')).rejects.toThrow(ConflictException);
    });
  });
});
