import { BadRequestException } from '@nestjs/common';
import { MailboxesService } from './mailboxes.service';

describe('MailboxesService', () => {
  function makeService() {
    const prisma = {
      mailbox: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      mailboxAccess: { findMany: jest.fn(), create: jest.fn(), upsert: jest.fn(), findUnique: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const service = new MailboxesService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  describe('create (M22 spec §2.1/§2.2)', () => {
    it('automatski dodeljuje REPLY vlasniku pri kreiranju PERSONAL sandučeta', async () => {
      const { service, prisma } = makeService();
      prisma.mailbox.create.mockResolvedValue({ id: 'mb-1', mailboxType: 'PERSONAL', ownerUserId: 'user-1' });

      await service.create(
        { address: 'ana@tt.rs', displayName: 'Ana', mailboxType: 'PERSONAL', ownerUserId: 'user-1', providerConnectionRef: 'mock' },
        'actor-1',
      );

      expect(prisma.mailboxAccess.create).toHaveBeenCalledWith({
        data: { mailboxId: 'mb-1', userId: 'user-1', accessLevel: 'REPLY', grantedBy: 'actor-1' },
      });
    });

    it('ne dodeljuje pristup automatski za SHARED sanduče', async () => {
      const { service, prisma } = makeService();
      prisma.mailbox.create.mockResolvedValue({ id: 'mb-2', mailboxType: 'SHARED', ownerUserId: null });

      await service.create(
        { address: 'rezervacije@tt.rs', displayName: 'Rezervacije', mailboxType: 'SHARED', providerConnectionRef: 'mock' },
        'actor-1',
      );

      expect(prisma.mailboxAccess.create).not.toHaveBeenCalled();
    });

    it('odbija PERSONAL sanduče bez ownerUserId', async () => {
      const { service } = makeService();
      await expect(
        service.create({ address: 'x@tt.rs', displayName: 'X', mailboxType: 'PERSONAL', providerConnectionRef: 'mock' }, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('odbija drugo is_supplier_unified_inbox sanduče (M5 spec §8.8 — najviše jedno)', async () => {
      const { service, prisma } = makeService();
      prisma.mailbox.findFirst.mockResolvedValue({ id: 'existing', address: 'dobavljaci@tt.rs' });

      await expect(
        service.create(
          { address: 'novo@tt.rs', displayName: 'Novo', mailboxType: 'SHARED', providerConnectionRef: 'mock', isSupplierUnifiedInbox: true },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
